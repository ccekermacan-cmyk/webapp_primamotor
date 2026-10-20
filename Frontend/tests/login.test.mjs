import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/login.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {loginErrorMessage} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('credential rejection gives actionable feedback without claiming which credential is wrong', () => {
  for (const status of [400,401]) assert.match(loginErrorMessage({status}), /Username\/email atau password tidak cocok/);
});
test('network, access, throttling, server and cancellation failures are distinct from credential rejection', () => {
  for (const [error, expected] of [[{status:0},/koneksi internet/],[{status:403},/ditolak/],[{status:429},/Terlalu banyak/],[{status:503},/gangguan/],[{status:0,isAbort:true},/terhenti/]]) {
    assert.match(loginErrorMessage(error), expected);
    assert.doesNotMatch(loginErrorMessage(error), /password tidak cocok/);
  }
});
test('browser storage and unexpected errors are not mislabeled as incorrect credentials or leaked', () => {
  assert.match(loginErrorMessage({name:'QuotaExceededError'}), /Penyimpanan browser/);
  assert.match(loginErrorMessage({name:'SecurityError'}), /Penyimpanan browser/);
  for (const err of [null,undefined,new Error('secret payload'),{status:404}]) {
    assert.match(loginErrorMessage(err), /belum dapat diselesaikan/);
    assert.doesNotMatch(loginErrorMessage(err), /secret payload/);
  }
});
