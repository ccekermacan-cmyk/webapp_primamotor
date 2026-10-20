import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/posValidation.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { validateCheckout, FIELD_TAB } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const base = {
  menu: 'Penjualan',
  cartCount: 1,
  mekanik: [],
  cashflow: [{ accountId: 'acc1', nominal: 1000 }],
  isOnline: false,
  marketplace: '',
  adminFee: 0,
  noteMenu: 'catatan',
  payment: 'Tunai',
  tempoDate: '',
};

test('a complete sale has no errors', () => {
  assert.deepEqual(validateCheckout(base), []);
});

test('an empty cart blocks any menu other than service', () => {
  const errors = validateCheckout({ ...base, cartCount: 0 });
  assert.equal(errors[0].field, 'cart');
  assert.equal(FIELD_TAB[errors[0].field], 'items');
  const service = validateCheckout({ ...base, cartCount: 0, menu: 'Service', mekanik: [{ idLama: 'budi', ongkos: 100 }] });
  assert.ok(!service.some(e => e.field === 'cart'));
});

test('service requires one mechanic with a positive ongkos', () => {
  const errors = validateCheckout({ ...base, menu: 'Service', cartCount: 0 });
  assert.equal(errors[0].field, 'mechanic');
  const tanpaOngkos = validateCheckout({ ...base, menu: 'Service', cartCount: 0, mekanik: [{ idLama: 'budi', ongkos: 0 }] });
  assert.ok(tanpaOngkos.some(e => e.field === 'mechanicOngkos'));
  assert.deepEqual(validateCheckout({ ...base, menu: 'Service', cartCount: 0, mekanik: [{ idLama: 'budi', ongkos: 5000 }] }), []);
});

test('payment rows must have both an account and a positive nominal', () => {
  const errors = validateCheckout({ ...base, cashflow: [{ accountId: 'acc1', nominal: 0 }] });
  assert.equal(errors[0].field, 'paymentNominal');
  assert.equal(FIELD_TAB[errors[0].field], 'payment');
  const orphan = validateCheckout({ ...base, cashflow: [{ accountId: '', nominal: 100 }] });
  assert.equal(orphan[0].field, 'paymentAccount');
});

test('online customers need a marketplace and non-negative admin fee', () => {
  const errors = validateCheckout({ ...base, isOnline: true });
  assert.equal(errors[0].field, 'marketplace');
  assert.equal(validateCheckout({ ...base, isOnline: true, marketplace: 'Tokopedia' })[0], undefined);
  assert.equal(validateCheckout({ ...base, isOnline: true, marketplace: 'Tokopedia', adminFee: -1 })[0].field, 'adminFee');
});

test('service needs a note, pembelian needs a note and a tempo date', () => {
  const service = validateCheckout({ ...base, menu: 'Service', cartCount: 0, mekanik: [{ idLama: 'budi', ongkos: 1 }], noteMenu: '' });
  assert.ok(service.some(e => e.field === 'note'));
  const pembelian = validateCheckout({ ...base, menu: 'Pembelian', noteMenu: '' });
  assert.ok(pembelian.some(e => e.field === 'note'));
  const tempo = validateCheckout({ ...base, menu: 'Pembelian', payment: 'Tempo', noteMenu: '' });
  assert.ok(tempo.some(e => e.field === 'tempoDate'));
  const tempoOtomatis = validateCheckout({ ...base, menu: 'Pembelian', payment: 'Tempo', noteMenu: '', tempoDate: '2026-11-01' });
  assert.deepEqual(tempoOtomatis, []);
});
