export interface AccountIdentity { id: string; username: string; level?: number }
export interface LoanEntry { nominal?: number; jenis?: string }
export interface SalaryEntry {
  qty?: number; total?: number; pokok?: number; tunjangan?: number;
  bonus_1?: number; bonus_2?: number; bonus_3?: number; bonus_4?: number;
  program?: number; lembur?: number; alfa?: number; setengah_hari?: number;
  sakit?: number; telat?: number; bpjs?: number; bon_diambil?: number; bon_dibayar?: number;
  expand?: { ref_baru?: { qty?: number } };
}
/** Only level 1 can list all salaries; loan history stays personal. */
export function accountHistoryFilters(identity: AccountIdentity) {
  if (!identity.id || !identity.username.trim()) return { salary: 'id = ""', loans: 'id = ""' };
  const id = JSON.stringify(identity.id);
  const username = JSON.stringify(identity.username);
  return {
    salary: identity.level === 1 ? '' : `person = ${username}`,
    loans: `user = ${id} || (user = "" && (persontext = ${username} || person.id_lama = ${username} || ref_gaji.person = ${username} || ref_cashflow.persontext = ${username}))`,
  };
}
export function salaryDetails(gaji: SalaryEntry) {
  const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const qty = Math.max(1, numeric(gaji.qty ?? gaji.expand?.ref_baru?.qty) || 1);
  const t1 = {
    pokok: numeric(gaji.pokok), tunjangan: numeric(gaji.tunjangan), bonus_1: numeric(gaji.bonus_1),
    bonus_2: numeric(gaji.bonus_2), bonus_3: numeric(gaji.bonus_3), bonus_4: numeric(gaji.bonus_4),
    program: numeric(gaji.program), lembur: numeric(gaji.lembur),
  };
  const dasar = (t1.pokok + t1.tunjangan) / qty;
  const t2 = { alfa: dasar * numeric(gaji.alfa), setengah_hari: dasar / 2 * numeric(gaji.setengah_hari), sakit: dasar * 0.9 * numeric(gaji.sakit), telat: numeric(gaji.telat) * 1000 };
  const t3 = { bpjs: numeric(gaji.bpjs), bon_diambil: numeric(gaji.bon_diambil), bon_dibayar: numeric(gaji.bon_dibayar) };
  const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);
  const total1 = sum(t1), total2 = sum(t2), total3 = sum(t3);
  const grandTotal = gaji.total != null && Number.isFinite(Number(gaji.total)) ? Number(gaji.total) : total1 - total2 - total3;
  return { t1, total1, t2, total2, t3, total3, grandTotal };
}
export function loanSummary(entries: LoanEntry[], balance: number) {
  let borrowed = 0, repaid = 0;
  for (const entry of entries) {
    const amount = Number(entry.nominal);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (entry.jenis === 'out') borrowed += amount;
    if (entry.jenis === 'in') repaid += amount;
  }
  return { borrowed, repaid, balance: Number.isFinite(Number(balance)) ? Number(balance) : 0,
    rate: borrowed > 0 ? Math.min(100, Math.round(repaid / borrowed * 100)) : null };
}
export function passwordChangeError(value: {oldPassword: string; password: string; passwordConfirm: string}): string {
  if (!value.oldPassword && !value.password && !value.passwordConfirm) return '';
  if (!value.oldPassword || !value.password || !value.passwordConfirm) return 'Lengkapi password lama, password baru, dan konfirmasi password.';
  if (value.password.length < 8) return 'Password baru minimal 8 karakter.';
  if (value.password !== value.passwordConfirm) return 'Konfirmasi password baru tidak cocok.';
  return '';
}
