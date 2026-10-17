export const productNumericFields = ['beli','sell_1','sell_2','sell_3','sell_4','sell_5','sell_6','min_1','min_2','min_3','stok_1','stok_2','stok_3'] as const;
export function normalizeProductCode(value: unknown): string {
  const code = String(value ?? '').trim();
  return /^\d+$/.test(code) ? code.replace(/^0+(?=\d)/, '') : code;
}
export function displayProductCode(value: unknown): string {
  const code = String(value ?? '').trim();
  if (!code) return 'N/A';
  return /^\d+$/.test(code) ? code.padStart(5, '0') : code;
}
export function productValidationError(data: Record<string, unknown>): string {
  for (const field of ['kategori','merk','unit']) if (!String(data[field] ?? '').trim()) return `${field} wajib diisi.`;
  for (const field of productNumericFields) {
    const value = Number(data[field] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) return `${field} harus bilangan bulat nol atau lebih.`;
  }
  if (Number(data.sell_6 || 0) <= 0) return 'Harga retail harus lebih dari nol.';
  return '';
}
export function isProductCodeConflict(error: unknown): boolean {
  const response = (error as {response?: unknown})?.response;
  const inspect = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    if ((record.id_lama as {code?: string})?.code === 'validation_not_unique') return true;
    return Object.values(record).some(inspect);
  };
  return inspect(response);
}
/** Absolute edits must not silently overwrite stock changed by another transaction. */
export function stockAdjustment(previous: number, requested: number, current: number): number {
  if (![previous, requested, current].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Stok tidak valid.');
  if (requested === previous) return 0;
  if (current !== previous) throw new Error('Stok berubah sejak form dibuka. Tutup dan buka kembali produk sebelum menyesuaikan stok.');
  return requested - current;
}
export function isProductVideo(file: string | {name: string; type?: string} | undefined): boolean {
  if (!file) return false;
  if (typeof file !== 'string' && file.type?.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test((typeof file === 'string' ? file : file.name).split(/[?#]/)[0]);
}
