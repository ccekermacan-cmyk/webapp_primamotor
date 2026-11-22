import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/errorBoundary.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;

const { formatErrorMessage, createErrorState } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);

test('createErrorState captures error instance and sets hasError true', () => {
  const err = new Error('Database connection failed');
  const state = createErrorState(err);
  assert.equal(state.hasError, true);
  assert.equal(state.message, 'Database connection failed');
  assert.ok(state.timestamp > 0);
});

test('formatErrorMessage handles Error object, string, and nullish gracefully', () => {
  assert.equal(formatErrorMessage(new Error('Syntax Error')), 'Syntax Error');
  assert.equal(formatErrorMessage('Custom String Error'), 'Custom String Error');
  assert.equal(formatErrorMessage(null), 'Terjadi kendala tidak terduga');
  assert.equal(formatErrorMessage({ message: 'Object error' }), 'Object error');
});
