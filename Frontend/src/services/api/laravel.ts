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
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
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

export class LaravelApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.name = 'LaravelApiError'; this.status = status; }
}

async function requireAcknowledgement(response: Response, action: string): Promise<void> {
  const text = await response.text();
  let payload: {status?: string; message?: string; error?: string; errors?: Record<string, unknown>; title?: string} | null = null;
  try { payload = JSON.parse(text); } catch { /* HTML proxy and SPA responses are not acknowledgements. */ }
  if (response.ok && payload?.status === 'success') return;
  const defaults: Record<number, string> = {
    401: 'Sesi tidak valid atau kedaluwarsa. Masuk kembali lalu coba ulang.',
    403: 'Anda tidak memiliki izin untuk tindakan ini.',
    404: 'Endpoint transaksi tidak ditemukan. Periksa pembaruan backend dan proxy.',
    405: 'Metode transaksi belum didukung endpoint ini. Periksa pembaruan backend dan proxy.',
    409: 'Data berubah atau sedang diproses. Muat ulang sebelum mencoba kembali.',
    422: 'Data transaksi ditolak. Periksa stok, saldo, dan kelengkapan data.',
    429: 'Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba kembali.',
    500: 'Backend gagal memproses transaksi. Periksa log Laravel; jangan membuat ulang transaksi yang sudah tersimpan.',
    502: 'Proxy tidak dapat menghubungi backend Laravel.',
    503: 'Layanan backend/autentikasi tidak tersedia. Periksa koneksi Laravel ke PocketBase.',
    504: 'Backend belum memberikan jawaban. Status transaksi perlu diperiksa sebelum mencoba kembali.',
  };
  let detail = defaults[response.status] || 'Respons server tidak valid; pastikan alamat API mengarah ke backend Laravel.';
  if (response.status === 422 && payload?.errors) {
    const messages = Object.values(payload.errors).flat().filter((value): value is string => typeof value === 'string');
    if (messages.length) detail = [...new Set(messages)].join(' ');
  } else if ([400,403,409,422,503].includes(response.status)) {
    detail = payload?.message || payload?.error || detail;
  }
  if (response.status === 403 && (payload?.title?.includes('1010') || /cloudflare/i.test(text))) detail = 'Akses ditolak Cloudflare. Periksa aturan akses untuk endpoint API.';
  throw new LaravelApiError(`${action} gagal (HTTP ${response.status}). ${detail}`, response.status);
}

export class PendingSyncError extends Error {
  constructor(detail = '') { super('Data telah tersimpan, tetapi sinkronisasi belum selesai. Coba sinkronisasi ulang; jangan membuat transaksi yang sama lagi.' + (detail ? ` ${detail}` : '')); this.name = 'PendingSyncError'; }
}
let lastSyncError = '';
export const getPendingSyncError = () => lastSyncError;

async function send(entry: PendingSync): Promise<void> {
  try {
    const response = await laravelFetch(`${getLaravelApiUrl()}/webhooks/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
      signal: AbortSignal.timeout(30000),
    });
    await requireAcknowledgement(response, 'Sinkronisasi');
  } catch (error) {
    throw new PendingSyncError(error instanceof LaravelApiError ? error.message : 'Koneksi terputus atau waktu tunggu habis.');
  }
}

const flushes = new Map<string, Promise<void>>();
export function flushPendingSync(): Promise<void> {
  const key = queueKey();
  const active = flushes.get(key);
  if (active) return active;
  lastSyncError = '';
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
  })().catch(error => { lastSyncError = error instanceof Error ? error.message : 'Sinkronisasi gagal.'; throw error; }).finally(() => { flushes.delete(key); announce(); });
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
  } catch (error) { throw error instanceof PendingSyncError ? error : new PendingSyncError(error instanceof Error ? error.message : undefined); }
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
  try {
    const response = await laravelFetch(`${getLaravelApiUrl()}/transactions/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: 'DELETE', signal: AbortSignal.timeout(30000) });
    await requireAcknowledgement(response, 'Penghapusan');
  } catch (error) {
    if (error instanceof LaravelApiError) throw error;
    throw new Error('Koneksi terputus atau waktu tunggu penghapusan habis. Status penghapusan belum dapat dipastikan; muat ulang data sebelum mencoba kembali.');
  }
}

export async function recalculateFinancialReport(date: string): Promise<void> {
  await flushPendingSync();
  try {
    const response = await laravelFetch(`${getLaravelApiUrl()}/reports/recalculate`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({date}), signal: AbortSignal.timeout(30000),
    });
    await requireAcknowledgement(response, 'Perhitungan laporan');
  } catch (error) {
    if (error instanceof LaravelApiError) throw error;
    throw new Error('Koneksi perhitungan laporan terputus atau waktu tunggu habis. Muat ulang laporan untuk memeriksa hasilnya.');
  }
}
