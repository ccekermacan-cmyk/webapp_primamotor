/** Calendar dates in the shop's business timezone, independent of browser timezone. */
export function businessDate(value: string | Date = new Date()): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
export function businessDateBoundary(value: string, nextDay = false): string {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}
export function csvIncludes(value: unknown, token: string): boolean {
  return String(value ?? '').split(',').map(part => part.trim()).includes(token);
}
export function editableBalance(balance: number, account: string, old?: {account_1: string; account_2: string; mutasi: string; nominal: number}): number {
  if (!old) return balance;
  const outgoing = ['out', 'keluar'].includes(old.mutasi.toLowerCase());
  if (old.account_1 === account) balance += outgoing ? Number(old.nominal) : -Number(old.nominal);
  if (outgoing && old.account_2 === account) balance -= Number(old.nominal);
  return balance;
}
