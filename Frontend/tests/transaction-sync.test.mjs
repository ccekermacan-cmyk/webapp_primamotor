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

test('sync retries keep the same request ID and preserve pending work after a failed response', async () => {
  const api = await loadApi();
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return new Response('', { status: 503 }); };
  await assert.rejects(api.syncLaravelEvents([{ collection: 'cashflow', event: 'created', id: 'c1' }]));
  assert.equal(api.hasPendingSync(), true);
  const firstId = JSON.parse(requests[0].body).request_id;
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return Response.json({ status: 'success' }); };
  await api.flushPendingSync();
  assert.equal(JSON.parse(requests[1].body).request_id, firstId);
  assert.equal(requests[1].headers.get('Authorization'), 'Bearer valid-token');
  assert.equal(api.hasPendingSync(), false);
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

test('a non-success payload never clears the pending transaction', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => Response.json({ status: 'error' });
  await assert.rejects(api.syncLaravelEvents([{ collection: 'menu', event: 'created', id: 'm1' }]));
  assert.equal(api.hasPendingSync(), true);
});

test('batch IDs map to response.body with unmonitored requests and a separately created parent', async () => {
  const effects = [];
  const operations = [];
  const snapshots = { l1: { id: 'l1', qty: 2 }, c1: { id: 'c1', nominal: 25 } };
  globalThis.testPb = {
    collection: name => ({ getOne: async id => snapshots[id] }),
    createBatch: () => ({
      collection: name => ({
        create: data => operations.push({ name, data }),
        update: (id,data) => operations.push({ name,id,data }),
        delete: id => operations.push({ name,id }),
      }),
      send: async () => operations.map((op,i) => ({ status: 200, body: { id: op.id || `new-${i}` } })),
    }),
  };
  globalThis.testApi = { flushPendingSync: async () => {}, syncLaravelEvents: async events => effects.push(...events) };
  const adapter = await load('../src/services/api/financialBatch.ts', 'const pb = globalThis.testPb; const {flushPendingSync, syncLaravelEvents} = globalThis.testApi;\n');
  const batch = adapter.createFinancialBatch();
  batch.collection('gaji').create({ person: 'employee' });
  batch.collection('cashflow').create({ nominal: 25 });
  batch.collection('log_stock').delete('l1');
  batch.collection('cashflow').update('c1', { nominal: 30 });
  await batch.send([{ collection: 'menu', event: 'created', id: 'parent' }]);
  assert.deepEqual(effects.map(e => e.id), ['parent', 'new-1', 'l1', 'c1']);
  assert.equal(effects[2].record.qty, 2);
  assert.equal(effects[3].old_data.nominal, 25);
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

test('delete reports the actual authentication outage instead of a generic reload error', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => Response.json({message:'Layanan autentikasi tidak tersedia.'},{status:503});
  await assert.rejects(api.deleteFinancialRecord('menu','m1'),error => error.status===503 && /HTTP 503/.test(error.message) && /autentikasi/.test(error.message));
});

test('delete exposes business validation reasons and never reports a rejected delete as success', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => Response.json({message:'The given data was invalid.',errors:{nominal:['Saldo akun tidak cukup untuk perubahan ini.']}},{status:422});
  await assert.rejects(api.deleteFinancialRecord('menu','m1'),/Saldo akun tidak cukup/);
});

test('HTTP 200 HTML or a JSON error payload is not a transaction acknowledgement', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => new Response('<!doctype html><html>SPA fallback</html>',{status:200,headers:{'Content-Type':'text/html'}});
  await assert.rejects(api.deleteFinancialRecord('menu','m1'),/Respons server tidak valid/);
  globalThis.fetch = async () => Response.json({status:'error'});
  await assert.rejects(api.deleteFinancialRecord('menu','m1'),/Respons server tidak valid/);
});

test('successful delete requires an acknowledgement and requests JSON with bearer authentication', async () => {
  const api = await loadApi();
  await api.deleteFinancialRecord('menu','m1');
  assert.equal(requests[0].method,'DELETE');
  assert.equal(requests[0].headers.get('Accept'),'application/json');
  assert.equal(requests[0].headers.get('Authorization'),'Bearer valid-token');
});

test('sync failure retains both the durable queue and the backend reason for the retry panel', async () => {
  const api = await loadApi();
  globalThis.fetch = async () => Response.json({message:'Layanan autentikasi tidak tersedia.'},{status:503});
  await assert.rejects(api.syncLaravelEvents([{collection:'menu',event:'created',id:'m1'}]),/HTTP 503/);
  assert.equal(api.hasPendingSync(),true);
  assert.match(api.getPendingSyncError(),/autentikasi/);
  globalThis.fetch = async () => Response.json({status:'success'});
  await api.flushPendingSync();
  assert.equal(api.hasPendingSync(),false);
  assert.equal(api.getPendingSyncError(),'');
});

test('lost delete responses describe uncertain status and do not trigger an unsafe PocketBase fallback', async () => {
  const api = await loadApi();
  let count=0;
  globalThis.fetch = async () => {count++;throw new TypeError('Network error');};
  await assert.rejects(api.deleteFinancialRecord('menu','m1'),/Status penghapusan belum dapat dipastikan/);
  assert.equal(count,1);
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

test('reports cannot recalculate against financial records with pending synchronization', async () => {
  const api=await loadApi();
  globalThis.fetch=async()=>Response.json({message:'offline'},{status:503});
  await assert.rejects(api.syncLaravelEvents([{collection:'cashflow',event:'created',id:'c1'}]));
  globalThis.fetch=async(url,options)=>{requests.push({url,...options});return Response.json({message:'offline'},{status:503});};
  await assert.rejects(api.recalculateFinancialReport('2026-10-18'));
  assert.equal(requests.some(request=>request.url.includes('/reports/recalculate')),false);
});
