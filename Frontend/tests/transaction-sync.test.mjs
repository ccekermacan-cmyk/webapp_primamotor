import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let serial = 0;
function load(sourcePath, imports) {
  let source = fs.readFileSync(new URL(sourcePath, import.meta.url), 'utf8');
  source = imports + source.replace(/^import .*;\n/gm, '').replace('import.meta.env', '({})');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js + `\n//${serial++}`).toString('base64')}`);
}
let requests;
beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  globalThis.window = new EventTarget();
  window.location = { hostname: 'localhost' };
  globalThis.testPb = { authStore: { record: { id: 'cashier' }, token: 'valid-token' } };
  requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return Response.json({ status: 'success' }); };
});
const loadApi = () => load('../src/services/api/laravel.ts', 'const pb = globalThis.testPb; const createRecordId = () => crypto.randomUUID();\n');

test('legacy sync never blocks writes after a backend failure', async () => {
  const api = await loadApi();
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return new Response('', { status: 503 }); };
  // Obsolete legacy events must not throw; the native atomic ledger already applied them.
  await api.syncLaravelEvents([{ collection: 'cashflow', event: 'created', id: 'c1' }]);
  assert.equal(api.hasPendingSync(), false);
  assert.equal(requests.length, 1);
});

test('concurrent saves are appended and neither notification is lost', async () => {
  const api = await loadApi();
  let release;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    if (requests.length === 1) await new Promise(resolve => { release = resolve; });
    return Response.json({ status: 'success' });
  };
  const first = api.syncLaravelEvents([{ collection: 'cashflow', event: 'created', id: 'c1' }]);
  const second = api.syncLaravelEvents([{ collection: 'log_stock', event: 'created', id: 'l1' }]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(requests.map(r => JSON.parse(r.body).events[0].id), ['c1', 'l1']);
  assert.equal(api.hasPendingSync(), false);
});

test('a failed legacy payload is dropped instead of blocking', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => Response.json({ status: 'error' });
  await api.syncLaravelEvents([{ collection: 'menu', event: 'created', id: 'm1' }]);
  assert.equal(api.hasPendingSync(), false);
});

test('record IDs are valid for PocketBase without requiring randomUUID', async () => {
  const ids = await load('../src/lib/ids.ts', '');
  const values = new Set(Array.from({ length: 100 }, () => ids.createRecordId()));
  assert.equal(values.size, 100);
  for (const id of values) assert.match(id, /^[a-z0-9]{15}$/);
});


test('a save arriving while an empty flush finishes is still sent before success', async () => {
  const api = await loadApi();
  const empty = api.flushPendingSync();
  const save = api.syncLaravelEvents([{ collection: 'menu', event: 'created', id: 'm1' }]);
  await Promise.all([empty, save]);
  assert.equal(requests.length, 1);
  assert.equal(api.hasPendingSync(), false);
});

test('legacy sync failure clears the obsolete queue without throwing', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => Response.json({message:'Layanan autentikasi tidak tersedia.'},{status:503});
  await api.syncLaravelEvents([{collection:'menu',event:'created',id:'m1'}]);
  assert.equal(api.hasPendingSync(),false);
  globalThis.fetch = async () => Response.json({status:'success'});
  await api.flushPendingSync();
  assert.equal(api.hasPendingSync(),false);
});

test('report recalculation propagates backend outages and requires a success acknowledgement', async () => {
  const api=await loadApi();
  globalThis.fetch=async()=>Response.json({message:'Layanan autentikasi tidak tersedia.'},{status:503});
  await assert.rejects(api.recalculateFinancialReport('2026-10-18'),/HTTP 503/);
  globalThis.fetch=async()=>Response.json({status:'error'});
  await assert.rejects(api.recalculateFinancialReport('2026-10-18'),/Respons server tidak valid/);
  globalThis.fetch=async(url,options)=>{requests.push({url,...options});return Response.json({status:'success'});};
  await api.recalculateFinancialReport('2026-10-18');
  assert.equal(JSON.parse(requests.at(-1).body).date,'2026-10-18');
});

test('report recalculation reaches the backend even when the legacy queue cannot drain', async () => {
  const api=await loadApi();
  globalThis.fetch=async()=>Response.json({message:'offline'},{status:503});
  await api.syncLaravelEvents([{collection:'cashflow',event:'created',id:'c1'}]);
  assert.equal(api.hasPendingSync(),false);
  globalThis.fetch=async(url,options)=>{requests.push({url,...options});return Response.json({status:'success'});};
  await api.recalculateFinancialReport('2026-10-18');
  assert.equal(requests.some(request=>request.url.includes('/reports/recalculate')),true);
});
