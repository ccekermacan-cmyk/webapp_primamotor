// Sumber tunggal untuk format nominal uang di seluruh aplikasi.
// Semua nilai uang (total, saldo, nominal) memakai fungsi ini agar tampilan
// konsisten: pemisah ribuan titik, desimal hanya tampil bila memang ada,
// dan "belum ada data" dibedakan dari angka nol.

export const UNKNOWN_AMOUNT = 'Belum tersedia';

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
};

/** Angka dengan pemisah ribuan id-ID. Desimal hanya tampil bila ada pecahan. */
export function formatNumberID(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return '0';
  const hasFraction = Math.abs(n % 1) > 0.000001;
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}

/**
 * Nominal rupiah siap tampil. `null`/`undefined` menghasilkan "Rp 0" kecuali
 * `blank` diisi, dipakai saat data belum tersedia dan bukan berarti nol.
 */
export function formatRupiah(
  value: number | string | null | undefined,
  options: { blank?: string } = {},
): string {
  const n = toNumber(value);
  if (n === null) return options.blank ?? 'Rp 0';
  return `Rp ${formatNumberID(n)}`;
}

/** Nominal tanpa awalan "Rp", untuk dipakai di dalam kalimat/markup. */
export function formatAmount(value: number | string | null | undefined): string {
  return formatNumberID(value);
}
