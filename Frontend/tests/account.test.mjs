import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/account.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { accountHistoryFilters, salaryDetails, loanSummary, passwordChangeError } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('personal history never falls back to all records when identity is missing', () => {
  assert.deepEqual(accountHistoryFilters({id:'',username:''}), {salary:'id = ""',loans:'id = ""'});
  assert.equal(accountHistoryFilters({id:'admin',username:'owner'}).salary, 'person = "owner"');
  const filter = accountHistoryFilters({id:'staff',username:'a" || id != "'});
  assert.ok(filter.salary.includes('a\\"'));
  assert.ok(filter.loans.startsWith('user = "staff" || (user = ""'));
});
test('only level 1 sees all salaries while every other level is scoped to its username', () => {
  assert.equal(accountHistoryFilters({id:'admin',username:'owner',level:1}).salary,'');
  for (const level of [2,3,4,5,6,7,8,9,10,0,undefined]) {
    assert.equal(accountHistoryFilters({id:'staff',username:'employee',level}).salary,'person = "employee"');
  }
  assert.equal(accountHistoryFilters({id:'admin',username:'owner',level:1}).loans,accountHistoryFilters({id:'admin',username:'owner',level:2}).loans);
  assert.equal(accountHistoryFilters({id:'',username:'',level:1}).salary,'id = ""');
});
test('salary uses period quantity from the actual parent relation', () => {
  const result = salaryDetails({pokok:3000000,tunjangan:300000,alfa:1,expand:{ref_baru:{qty:30}}});
  assert.equal(result.t2.alfa,110000);
  assert.equal(result.grandTotal,3190000);
});
test('salary totals normalize numeric inputs and preserve an explicit zero', () => {
  assert.equal(salaryDetails({pokok:'100',tunjangan:'20',bpjs:'5'}).grandTotal,115);
  assert.equal(salaryDetails({pokok:100,total:0}).grandTotal,0);
  assert.equal(salaryDetails({pokok:NaN}).grandTotal,0);
});
test('loan summary counts authoritative entries once across every page and includes repayments', () => {
  const entries = [...Array.from({length:6},()=>({jenis:'out',nominal:100})),{jenis:'in',nominal:300}];
  assert.deepEqual(loanSummary(entries,350),{borrowed:600,repaid:300,balance:350,rate:50});
  assert.equal(loanSummary([],0).rate,null);
  assert.equal(loanSummary([{jenis:'in',nominal:200},{jenis:'out',nominal:100}],-100).rate,100);
});
test('password change rejects incomplete or mismatched changes without sending requests', () => {
  assert.equal(passwordChangeError({oldPassword:'',password:'',passwordConfirm:''}),'');
  assert.ok(passwordChangeError({oldPassword:'old',password:'',passwordConfirm:''}));
  assert.ok(passwordChangeError({oldPassword:'old',password:'short',passwordConfirm:'short'}));
  assert.ok(passwordChangeError({oldPassword:'old',password:'new-password',passwordConfirm:'different'}));
  assert.equal(passwordChangeError({oldPassword:'old',password:'new-password',passwordConfirm:'new-password'}),'');
});
