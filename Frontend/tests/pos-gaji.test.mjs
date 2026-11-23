import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let operations, batchSends;
async function load(path, imports) {
  const source = imports + fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
beforeEach(() => {
  operations = []; batchSends = [];
  globalThis.testPb = { authStore: { model: { username: 'admin' } }, collection: () => ({ getFullList: async () => [] }) };
  globalThis.testCreateRecordId = () => `id${String(operations.length).padStart(6, '0')}`;
  globalThis.testCreateFinancialBatch = () => ({
    collection: name => ({
      create: data => operations.push({ name, event: 'created', data }),
      update: (id, data) => operations.push({ name, event: 'updated', id, data }),
      delete: id => operations.push({ name, event: 'deleted', id }),
    }),
    send: async (extra, onPersisted) => { batchSends.push(extra); onPersisted?.(); return []; },
  });
});
const baseParams = () => ({
  pb: globalThis.testPb, isEditMode: false, gajiEditSession: null, menuId: '',
  gajiItemList: [{ id: 'tmp_1', person: 'cashier', pokok: 1000000, tunjangan: 0, bonus_1: 0, bonus_2: 0, bonus_3: 0, bonus_4: 0, program: 0, lembur: 0, alfa: 0, setengah_hari: 0, sakit: 0, telat: 0, bpjs: 0, bon_diambil: 2000, bon_dibayar: 1000, diterima: 0, note: '', files: [] }],
  gajiHeader: { date: '2026-11-01', qty: 26, note: '' }, grandTotal: 1000000, operatorName: 'admin',
  allUsers: [{ id: 'u1', username: 'cashier', name: 'Cashier' }], allPersons: [],
  onSuccess: () => {}, onError: () => {},
});
async function adapter() {
  return load('../src/services/posGajiService.ts', `const pb=globalThis.testPb;const createRecordId=globalThis.testCreateRecordId;const createFinancialBatch=globalThis.testCreateFinancialBatch;\n`);
}
test('salary bon payloads carry an explicit jenis direction for the atomic ledger', async () => {
  const { saveGajiBatch } = await adapter();
  await saveGajiBatch(baseParams());
  const bons = operations.filter(op => op.name === 'bon');
  assert.equal(bons.length, 2);
  const taken = bons.find(op => op.data.tipe === 'diambil');
  const paid = bons.find(op => op.data.tipe === 'dibayar');
  assert.equal(taken.data.jenis, 'out');
  assert.equal(taken.data.nominal, 2000);
  assert.equal(paid.data.jenis, 'in');
  assert.equal(paid.data.nominal, 1000);
});
test('salary save without bon values creates no bon rows', async () => {
  const params = baseParams();
  params.gajiItemList = params.gajiItemList.map(item => ({ ...item, bon_diambil: 0, bon_dibayar: 0 }));
  const { saveGajiBatch } = await adapter();
  await saveGajiBatch(params);
  assert.equal(operations.filter(op => op.name === 'bon').length, 0);
});