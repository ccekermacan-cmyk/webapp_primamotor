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
