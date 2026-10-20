import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/posDraft.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { readPosDraft, POS_DRAFT_KEY, POS_DRAFT_MAX_AGE_MS } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('returns null when there is nothing stored', () => {
  assert.equal(readPosDraft(() => null, Date.now(), false), null);
});

test('skips the draft while an atomic request is pending', () => {
  const store = { [POS_DRAFT_KEY]: JSON.stringify({ cart: [{ id: 'x' }], savedAt: Date.now() }) };
  assert.equal(readPosDraft(k => store[k] ?? null, Date.now(), true), null);
});

test('ignores malformed JSON and drafts without items', () => {
  assert.equal(readPosDraft(() => '{not-json', Date.now(), false), null);
  assert.equal(readPosDraft(() => JSON.stringify({ cart: [] }), Date.now(), false), null);
  assert.equal(readPosDraft(() => JSON.stringify({ cart: 'nope' }), Date.now(), false), null);
});

test('restores a valid draft with its menu and form', () => {
  const draft = { cart: [{ id: 'a', qty: 2 }], selectedMenu: 'Oli', formBayar: { payment: 'Transfer', nominalBayar: 50000 }, savedAt: Date.now() };
  assert.deepEqual(readPosDraft(() => JSON.stringify(draft), Date.now(), false), draft);
});

test('expires drafts older than 24 hours', () => {
  const now = Date.now();
  const stale = { cart: [{ id: 'a' }], savedAt: now - POS_DRAFT_MAX_AGE_MS - 1 };
  assert.equal(readPosDraft(() => JSON.stringify(stale), now, false), null);
  const fresh = { cart: [{ id: 'a' }], savedAt: now - POS_DRAFT_MAX_AGE_MS + 1 };
  assert.deepEqual(readPosDraft(() => JSON.stringify(fresh), now, false), fresh);
});
