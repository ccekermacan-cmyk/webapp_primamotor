import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/financialPatch.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {financialPatch}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('editing account metadata never overwrites balance changed by another transaction',()=>{
 const original={number_1:1000,text_1:'Cash'};
 assert.deepEqual(financialPatch({number_1:1000,text_1:'New Name'},original,['number_1'],{number_1:1200}),{text_1:'New Name'});
 assert.equal(original.number_1,1000);
});
test('editing employee metadata preserves a live loan balance and compares numeric strings',()=>{
 assert.deepEqual(financialPatch({name:'Employee',number:'100'},{number:100},['number'],{number:150}),{name:'Employee'});
});
test('explicit corrections reject stale values but allow a correction against an unchanged baseline',()=>{
 assert.throws(()=>financialPatch({number:80},{number:100},['number'],{number:150}),/sudah berubah/);
 assert.deepEqual(financialPatch({number:80},{number:100},['number'],{number:100}),{number:80});
 assert.deepEqual(financialPatch({number:50},null,['number']),{number:50});
});
