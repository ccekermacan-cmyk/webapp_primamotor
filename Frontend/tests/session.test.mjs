import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(name) {
 const s=fs.readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');
 const js=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const {installSessionGuard,checkSessionExpiry}=await load('session');
const {transactionError}=await load('transactionError');
function fixture(verify=async()=>true) {
 const saved=new Map([['user_level','2'],['prima_atomic_pending:employee','receipt'],['pos_draft_cart','draft']]);
 globalThis.localStorage={removeItem:k=>saved.delete(k)};
 globalThis.sessionStorage={setItem:(k,v)=>saved.set(k,v)};
 const client={authStore:{token:'original',isValid:true,clear(){this.token='';this.isValid=false;}}};
 installSessionGuard(client,verify);
 return {client,saved,respond:(status,data={},token='original')=>client.afterSend({status},data,{headers:{Authorization:token}})};
}
test('expired token clears session but preserves pending financial receipt and draft',()=>{
 const {client,saved}=fixture();client.authStore.isValid=false;checkSessionExpiry(client);
 assert.equal(client.authStore.token,'');assert.equal(saved.get('prima_atomic_pending:employee'),'receipt');assert.equal(saved.get('pos_draft_cart'),'draft');assert.equal(saved.has('user_level'),false);
});
test('401 terminates only the session that sent the request',async()=>{
 const a=fixture();await a.respond(401);assert.equal(a.client.authStore.token,'');
 const b=fixture();b.client.authStore.token='new-login';await b.respond(401);assert.equal(b.client.authStore.token,'new-login');
});
test('batch permission rejection keeps valid session; rejected verification terminates session',async()=>{
 const response={data:{requests:{0:{response:{status:403,message:'Anda tidak memiliki akses ke akun ini.'}}}}};
 const a=fixture();await a.respond(400,response);assert.equal(a.client.authStore.token,'original');
 const b=fixture(async()=>false);await b.respond(400,response);assert.equal(b.client.authStore.token,'');
 const c=fixture(async()=>{throw new Error('offline');});await c.respond(400,response);assert.equal(c.client.authStore.token,'original');
});
test('validation, network and server failures never invalidate authentication',async()=>{
 for(const status of [0,400,500,503]) {const a=fixture();await a.respond(status,{message:'validation'});assert.equal(a.client.authStore.token,'original');}
});
test('real nested batch rejection exposes permission reason instead of generic HTTP 400',()=>{
 const e={status:400,response:{message:'Batch transaction failed.',data:{requests:{0:{code:'batch_request_failed',message:'Batch request failed.',response:{status:403,data:{},message:'Anda tidak memiliki akses ke akun ini.'}}}}}};
 assert.match(transactionError(e).message,/izin.*akun kas/);assert.doesNotMatch(transactionError(e).message,/Batch request failed/);
 assert.match(transactionError({response:{data:{nominal:{message:'Must be greater than zero.'}}}}).message,/Nominal: Must be greater/);
 assert.match(transactionError({status:0}).message,/Status transaksi perlu diperiksa/);
});
