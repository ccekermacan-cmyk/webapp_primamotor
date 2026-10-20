import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/money.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { formatRupiah, formatNumberID, formatAmount } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('rupiah uses thousands separators without decimals for whole amounts', () => {
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(1500), 'Rp 1.500');
  assert.equal(formatRupiah(1234567), 'Rp 1.234.567');
  assert.equal(formatRupiah('250000'), 'Rp 250.000');
});

test('decimals only show up when the amount really has a fraction', () => {
  assert.equal(formatRupiah(0.5), 'Rp 0,50');
  assert.equal(formatRupiah(1500.25), 'Rp 1.500,25');
  assert.equal(formatRupiah(1500.0), 'Rp 1.500');
});

test('missing data is different from zero', () => {
  assert.equal(formatRupiah(null), 'Rp 0');
  assert.equal(formatRupiah(undefined), 'Rp 0');
  assert.equal(formatRupiah(null, { blank: 'Belum tersedia' }), 'Belum tersedia');
  assert.equal(formatRupiah(undefined, { blank: 'Belum tersedia' }), 'Belum tersedia');
});

test('invalid values never render NaN or Infinity', () => {
  assert.equal(formatRupiah('abc'), 'Rp 0');
  assert.equal(formatRupiah(Number.NaN), 'Rp 0');
  assert.equal(formatRupiah(Number.POSITIVE_INFINITY), 'Rp 0');
  assert.equal(formatNumberID(null), '0');
});

test('negative amounts keep their sign', () => {
  assert.equal(formatRupiah(-1500), 'Rp -1.500');
});
