import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/cashflow.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { businessDate, businessDateBoundary, csvIncludes, editableBalance } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('due dates use Jakarta calendar without shifting midnight to the previous day', () => {
  assert.equal(businessDate('2026-10-18T00:00:00+07:00'), '2026-10-18');
  assert.equal(businessDate('2026-10-17T18:00:00Z'), '2026-10-18');
  assert.equal(businessDate('2026-10-18'), '2026-10-18');
});
test('exclusive end boundary includes the last millisecond of the business day', () => {
  const end = businessDateBoundary('2026-10-18', true);
  assert.equal(end, '2026-10-18T17:00:00.000Z');
  assert.ok(new Date('2026-10-18T23:59:59.999+07:00') < new Date(end));
});
test('visibility matches complete roles rather than substrings', () => {
  assert.equal(csvIncludes('10, 2', '1'), false);
  assert.equal(csvIncludes('10, 2', '2'), true);
});
test('expense edits validate available balance after undoing the original record', () => {
  assert.equal(editableBalance(100, 'cash', {account_1:'cash',account_2:'',mutasi:'out',nominal:900}), 1000);
  assert.equal(editableBalance(100, 'bank', {account_1:'cash',account_2:'bank',mutasi:'out',nominal:90}), 10);
});
