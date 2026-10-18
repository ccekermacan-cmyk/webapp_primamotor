import { pb } from '../pocketbase/client';

export interface AtomicResult { status: number; body: Record<string, unknown> | null }
interface Resolution { status: 'committed' | 'cancelled'; results?: AtomicResult[] }
const pendingKey = () => `prima_atomic_pending:${pb.authStore.record?.id || 'anonymous'}`;
export const hasPendingAtomic = () => !!localStorage.getItem(pendingKey());
const announce = () => window.dispatchEvent(new Event('prima:atomic-change'));

export function transactionError(error: unknown): Error {
  const messages: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    // Nested PocketBase batch responses contain the actual field/business error.
    if (obj.data && typeof obj.data === 'object' && Object.keys(obj.data).length) visit(obj.data);
    else if (obj.response) visit(obj.response);
    else if (typeof obj.message === 'string') messages.push(obj.message);
    else Object.values(obj).forEach(visit);
  };
  visit(error);
  return new Error([...new Set(messages)].join(' ') || (error instanceof Error ? error.message : 'Transaksi gagal.'));
}
export async function ensureAtomicLedger(): Promise<void> {
  const result = await pb.send<{atomic_ledger?: number}>('/api/financial/health', {method:'GET',requestKey:null});
  if (result.atomic_ledger !== 1) throw new Error('Backend transaksi belum siap. Terapkan migrasi atomic ledger dan muat ulang aplikasi.');
}
export function rememberAtomicRequest(id: string, draftKey?: string): void {
  if (hasPendingAtomic()) throw new Error('Selesaikan pemeriksaan transaksi sebelumnya terlebih dahulu.');
  // Persist BEFORE the request; if storage fails, no financial write is sent.
  localStorage.setItem(pendingKey(),JSON.stringify({id,draftKey}));
}
export function clearAtomicRequest(id: string): void {
  if (JSON.parse(localStorage.getItem(pendingKey()) || '{}').id === id) localStorage.removeItem(pendingKey());
  announce();
}
export function announcePendingAtomic(): void { announce(); }
export async function resolveAtomicRequest(id: string): Promise<Resolution> {
  const response = await pb.send<Resolution>(`/api/financial/requests/${encodeURIComponent(id)}/resolve`, {method:'POST',body:{},requestKey:null});
  if (response.status !== 'cancelled' && !(response.status === 'committed' && Array.isArray(response.results))) {
    throw new Error('Konfirmasi transaksi belum valid.');
  }
  return response;
}
export async function recoverPendingAtomic(): Promise<Resolution | null> {
  const pending = JSON.parse(localStorage.getItem(pendingKey()) || 'null') as {id:string;draftKey?:string} | null;
  if (!pending) return null;
  const {id,draftKey} = pending;
  const response = await resolveAtomicRequest(id);
  if (response.status === 'committed' && draftKey === 'pos_draft_cart') localStorage.removeItem(draftKey);
  clearAtomicRequest(id);
  return response;
}
