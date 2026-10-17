import { createRecordId } from '../../lib/ids';
import { pb } from '../pocketbase/client';

export const getLaravelApiUrl = (): string => {
  if (import.meta.env.VITE_LARAVEL_API_URL) return import.meta.env.VITE_LARAVEL_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname.includes('primamotorgladag')) {
    return 'https://api.primamotorgladag.my.id/api';
  }
  return 'http://127.0.0.1:8000/api';
};
export const LARAVEL_API_URL = getLaravelApiUrl();

export function laravelFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (pb.authStore.token) headers.set('Authorization', `Bearer ${pb.authStore.token}`);
  return fetch(url, { ...options, headers });
}

export interface SyncEvent {
  collection: string;
  event: 'created' | 'updated' | 'deleted';
  id: string;
  old_data?: Record<string, unknown>;
  record?: Record<string, unknown>;
}
interface PendingSync { request_id: string; events: SyncEvent[] }
const monitored = new Set(['menu', 'log_stock', 'cashflow', 'ongkos', 'bon']);
const queueKey = () => `prima_pending_sync:${pb.authStore.record?.id || 'anonymous'}`;
export const hasPendingSync = () => !!localStorage.getItem(queueKey());
const announce = () => window.dispatchEvent(new Event('prima:sync-change'));

export class PendingSyncError extends Error {
  constructor() { super('Data telah tersimpan, tetapi sinkronisasi belum selesai. Coba sinkronisasi ulang; jangan membuat transaksi yang sama lagi.'); }
}

async function send(entry: PendingSync): Promise<void> {
  const response = await laravelFetch(`${getLaravelApiUrl()}/webhooks/batch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new PendingSyncError();
  const result = await response.json();
  if (result.status !== 'success') throw new PendingSyncError();
}

const flushes = new Map<string, Promise<void>>();
export function flushPendingSync(): Promise<void> {
  const key = queueKey();
  const active = flushes.get(key);
  if (active) return active;
  const flushing = (async () => {
    // Re-read after each request: another save may have appended work while the request was in flight.
    while (true) {
      if (queueKey() !== key) throw new PendingSyncError();
      const pending: PendingSync[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!pending.length) return;
      const entry = pending[0];
      await send(entry);
      const remaining: PendingSync[] = JSON.parse(localStorage.getItem(key) || '[]');
      const next = remaining.filter(item => item.request_id !== entry.request_id);
      if (next.length) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    }
  })().finally(() => { flushes.delete(key); announce(); });
  flushes.set(key, flushing);
  return flushing;
}

export async function syncLaravelEvents(events: SyncEvent[]): Promise<void> {
  const tracked = events.filter(e => monitored.has(e.collection));
  if (!tracked.length) return;
  if (tracked.some(e => !e.id)) throw new Error('ID hasil batch tidak valid; sinkronisasi dihentikan.');
  // Persist new work before any network await, even when an older request is still pending.
  const key = queueKey();
  const pending: PendingSync[] = JSON.parse(localStorage.getItem(key) || '[]');
  const entry = { request_id: createRecordId(24), events: tracked };
  pending.push(entry);
  localStorage.setItem(key, JSON.stringify(pending));
  announce();
  try {
    // An empty flush may already be finishing when this save appends its entry.
    // Return only after this particular entry has been acknowledged.
    while ((JSON.parse(localStorage.getItem(key) || '[]') as PendingSync[]).some(item => item.request_id === entry.request_id)) {
      if (queueKey() !== key) throw new PendingSyncError();
      await flushPendingSync();
    }
  } catch { throw new PendingSyncError(); }
}

export async function notifyLaravelApi(collection: string, event: SyncEvent['event'], id?: string, oldData?: Record<string, unknown>): Promise<boolean> {
  if (!monitored.has(collection)) return true;
  if (!id) return false;
  try {
    const record = event === 'deleted' ? await pb.collection(collection).getOne(id) : undefined;
    await syncLaravelEvents([{ collection, event, id, old_data: oldData, record }]);
    return true;
  } catch (error) {
    console.warn(`[Laravel] ${collection}/${event}/${id}:`, error);
    return false;
  }
}

export async function deleteFinancialRecord(collection: string, id: string): Promise<void> {
  await flushPendingSync();
  const response = await laravelFetch(`${getLaravelApiUrl()}/transactions/${collection}/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Penghapusan belum berhasil. Muat ulang data sebelum mencoba lagi.');
}
