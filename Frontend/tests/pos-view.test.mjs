import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/posView.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { readPosView, writePosView, DEFAULT_POS_VIEW, POS_VIEW_KEY } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('an empty storage falls back to the default view', () => {
  assert.deepEqual(readPosView(() => null), DEFAULT_POS_VIEW);
});

test('malformed storage never breaks the page', () => {
  assert.deepEqual(readPosView(() => '{oops'), DEFAULT_POS_VIEW);
});

test('a stored view is restored', () => {
  const stored = JSON.stringify({ search: 'oli', viewMode: 'list', menuFilters: ['oli', 'banjar'] });
  assert.deepEqual(readPosView(() => stored), { search: 'oli', viewMode: 'list', menuFilters: ['oli', 'banjar'] });
});

test('invalid values are replaced by safe defaults', () => {
  const stored = JSON.stringify({ search: 5, viewMode: 'kartu', menuFilters: 'bukan-array' });
  assert.deepEqual(readPosView(() => stored), { search: '', viewMode: 'grid', menuFilters: [] });
});

test('writing stores the state under one key', () => {
  const store = new Map();
  writePosView((k, v) => store.set(k, v), { search: 'oli', viewMode: 'list', menuFilters: ['oli'] });
  assert.ok(store.has(POS_VIEW_KEY));
  assert.deepEqual(readPosView(k => store.get(k) ?? null), { search: 'oli', viewMode: 'list', menuFilters: ['oli'] });
});
