import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/posTransactions.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {isIncomeTransaction,settlementRemaining,matchUnusedStockLog}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('service and servis settlements both credit cash instead of debiting it',()=>{
 for(const kind of ['Penjualan','Service','Servis Motor']) assert.equal(isIncomeTransaction(kind),true);
 assert.equal(isIncomeTransaction('Pembelian'),false);
});
test('settlements reject already-paid or reduced balances rather than recording a duplicate payment',()=>{
 assert.equal(settlementRemaining(100,40,60),0);
 assert.throws(()=>settlementRemaining(100,100,60),/Sisa tagihan/);
 assert.throws(()=>settlementRemaining(100,80,60),/Sisa tagihan/);
 assert.throws(()=>settlementRemaining(100,0,NaN),/tidak valid/);
});
test('repeated product rows each match their own stock log and explicit relations take precedence',()=>{
 const rows=[{id:'a',item_baru:'p',item:'SKU'},{id:'b',item_baru:'p',item:'SKU'},{id:'c',item_baru:'other',item:'SKU'}];
 const used=new Set();
 assert.equal(matchUnusedStockLog(rows,'p','SKU',used).id,'a');used.add('a');
 assert.equal(matchUnusedStockLog(rows,'p','SKU',used).id,'b');used.add('b');
 assert.equal(matchUnusedStockLog(rows,'p','SKU',used),undefined);
 assert.equal(matchUnusedStockLog([{id:'legacy',item:'SKU'}],'p','SKU',new Set()).id,'legacy');
});
