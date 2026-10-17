export function isIncomeTransaction(kind: string): boolean {
  return /penjualan|service|servis/i.test(kind);
}
export function settlementRemaining(total: number, paid: number, amount: number): number {
  if (![total, paid, amount].every(Number.isFinite) || amount <= 0) throw new Error('Nominal pelunasan tidak valid.');
  const remaining = Math.max(0, total - paid);
  if (amount > remaining) throw new Error('Sisa tagihan sudah berubah atau lunas. Muat ulang nota sebelum melakukan pelunasan.');
  return remaining - amount;
}
export function matchUnusedStockLog<T extends {id: string; item_baru?: string; item?: string}>(logs: T[], productId: string, legacyCode: string, used: Set<string>): T | undefined {
  return logs.find(log => !used.has(log.id) && (log.item_baru === productId || (!log.item_baru && !!legacyCode && log.item === legacyCode)));
}
