import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let serial = 0, operations, sends, calls, id;
async function load(path, imports) {
  const source = imports + fs.readFileSync(new URL(path,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace("export { transactionError } from '../../lib/transactionError';", 'export const transactionError = globalThis.testTransactionError;');
  const js = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js+`\n//${serial++}`).toString('base64')}`);
}
const results = () => [...operations.map(op=>({status:op.event==='deleted'?204:200,body:op.event==='deleted'?null:{id:op.id}})),{status:200,body:{atomic:true}}];
beforeEach(()=>{
  operations=[];sends=[];calls=[];id=0;
  const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  globalThis.window=new EventTarget();
  globalThis.testPb={authStore:{record:{id:'employee'}},send:async(path,opts)=>{calls.push({path,opts});return {atomic_ledger:1};},
    createBatch:()=>({collection:name=>({
      create:data=>operations.push({name,event:'created',id:data instanceof FormData?data.get('id'):data.id,data}),
      update:(id,data)=>operations.push({name,event:'updated',id,data}),
      delete:id=>operations.push({name,event:'deleted',id}),
    }),send:async options=>{sends.push(options);return results();}})};
  globalThis.testFlush=async()=>{};
  globalThis.testId=()=>`fixture${String(++id).padStart(8,'0')}`;
});
async function adapter() {
  globalThis.testTransactionError=(await load('../src/lib/transactionError.ts','')).transactionError;
  globalThis.testAtomic=await load('../src/services/api/atomic.ts','const pb=globalThis.testPb;\n');
  return load('../src/services/api/financialBatch.ts',`const pb=globalThis.testPb;const flushPendingSync=globalThis.testFlush;const createRecordId=globalThis.testId;
const {ensureAtomicLedger,rememberAtomicRequest,clearAtomicRequest,resolveAtomicRequest,announcePendingAtomic,transactionError}=globalThis.testAtomic;\n`);
}
test('atomic batch submits stable IDs, preserves repeated file modifiers and accepts only the server commit marker',async()=>{
  const api=await adapter(),batch=api.createFinancialBatch();
  const form=new FormData();form.append('file-', 'old-a.png');form.append('file-', 'old-b.png');form.append('file+',new Blob(['test']), 'new.png');
  batch.collection('menu').create(form);batch.collection('cashflow').update('cash',{nominal:25});batch.collection('bon').delete('loan');
  const rows=await batch.send();
  assert.equal(rows.length,3);assert.equal(form.has('id'),false);
  assert.deepEqual(operations[0].data.getAll('file-'),['old-a.png','old-b.png']);
  assert.equal(operations[0].data.get('file+').name,'new.png');
  assert.equal(sends[0].query.atomic_request_id,'fixture00000001');
  assert.equal(globalThis.testAtomic.hasPendingAtomic(),false);
});
test('double submission of the same batch returns one request and one persistence callback',async()=>{
  const api=await adapter(),batch=api.createFinancialBatch();let callbacks=0;
  batch.collection('cashflow').create({nominal:5});
  const first=batch.send([],()=>callbacks++),second=batch.send([],()=>callbacks++);
  assert.equal(first,second);await Promise.all([first,second]);assert.equal(sends.length,1);assert.equal(callbacks,1);
  assert.throws(()=>batch.collection('cashflow').create({nominal:10}),/sudah dikirim/);
});
test('lost response recovers a committed receipt without resending business mutations',async()=>{
  const api=await adapter();globalThis.testPb.createBatch=()=>({collection:()=>({create:data=>operations.push({event:'created',id:data.id})}),send:async()=>{sends.push(1);throw new TypeError('network error');}});
  globalThis.testPb.send=async path=>path.includes('/resolve')?{status:'committed',results:results()}:{atomic_ledger:1};
  const batch=api.createFinancialBatch();batch.collection('menu').create({});let persisted=false;
  const result=await batch.send([],()=>persisted=true);
  assert.equal(result.length,1);assert.equal(persisted,true);assert.equal(sends.length,1);assert.equal(globalThis.testAtomic.hasPendingAtomic(),false);
});
test('failed transaction exposes nested validation errors only after the server confirms cancellation',async()=>{
  const api=await adapter();globalThis.testPb.createBatch=()=>({collection:()=>({delete:id=>operations.push({event:'deleted',id})}),send:async()=>{throw {response:{data:{requests:{'1':{response:{message:'Saldo akun tidak cukup.',data:{}}}}}}};}});
  globalThis.testPb.send=async path=>path.includes('/resolve')?{status:'cancelled'}:{atomic_ledger:1};
  const batch=api.createFinancialBatch();batch.collection('menu').delete('menu');
  await assert.rejects(batch.send(),/Saldo akun tidak cukup/);assert.equal(globalThis.testAtomic.hasPendingAtomic(),false);
});
test('unresolved connection failure blocks subsequent writes and recovery clears only the committed POS draft',async()=>{
  const api=await adapter();globalThis.testPb.createBatch=()=>({collection:()=>({create:data=>operations.push({event:'created',id:data.id})}),send:async()=>{throw new TypeError('offline');}});
  globalThis.testPb.send=async path=>{if(path.includes('/resolve'))throw new TypeError('offline');return {atomic_ledger:1};};
  localStorage.setItem('pos_draft_cart','cart');
  const batch=api.createFinancialBatch({draftKey:'pos_draft_cart'});batch.collection('menu').create({});await assert.rejects(batch.send());
  assert.equal(globalThis.testAtomic.hasPendingAtomic(),true);
  const second=api.createFinancialBatch();second.collection('menu').create({});await assert.rejects(second.send(),/sebelumnya/);
  globalThis.testPb.send=async()=>({status:'committed',results:results()});
  await globalThis.testAtomic.recoverPendingAtomic();assert.equal(localStorage.getItem('pos_draft_cart'),null);assert.equal(globalThis.testAtomic.hasPendingAtomic(),false);
});
test('unavailable atomic backend or local persistence fails before any write is sent',async()=>{
  const api=await adapter();globalThis.testPb.send=async()=>({atomic_ledger:0});
  const batch=api.createFinancialBatch();batch.collection('menu').create({});await assert.rejects(batch.send(),/belum siap/);assert.equal(sends.length,0);
  globalThis.testPb.send=async()=>({atomic_ledger:1});localStorage.setItem=()=>{throw new Error('storage full');};
  const next=api.createFinancialBatch();next.collection('menu').create({});await assert.rejects(next.send(),/storage full/);assert.equal(sends.length,0);
});
test('legacy outbox is drained before submitting a new atomic transaction',async()=>{
  const api=await adapter();globalThis.testFlush=async()=>{throw new Error('legacy sync pending');};
  const fresh=await adapter(),batch=fresh.createFinancialBatch();batch.collection('menu').create({});await assert.rejects(batch.send(),/legacy sync/);assert.equal(sends.length,0);
});

test('unconfirmed rejection retains the original reason and pending receipt', async () => {
  const api=await adapter();
  globalThis.testPb.createBatch=()=>({collection:()=>({create:()=>{}}),send:async()=>{throw {status:400,response:{data:{requests:{0:{response:{status:403,message:'Anda tidak memiliki akses ke akun ini.',data:{}}}}}}};}});
  globalThis.testPb.send=async(path)=>{if(path.includes('/health'))return {atomic_ledger:1};throw new Error('offline');};
  const batch=api.createFinancialBatch();batch.collection('menu').create({});
  await assert.rejects(batch.send(), /izin.*akun kas.*Status transaksi belum dapat dikonfirmasi/);
  assert.equal(globalThis.testAtomic.hasPendingAtomic(),true);
});
