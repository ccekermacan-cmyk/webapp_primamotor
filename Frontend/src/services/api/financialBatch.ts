import { pb } from '../pocketbase/client';
import { flushPendingSync, type SyncEvent } from './laravel';
import { createRecordId } from '../../lib/ids';
import { ensureAtomicLedger, rememberAtomicRequest, clearAtomicRequest, resolveAtomicRequest, announcePendingAtomic, transactionError, type AtomicResult } from './atomic';

// Records, balances, stock, linked loans and reports commit inside PocketBase's transaction.
export function createFinancialBatch(options: {draftKey?: string} = {}) {
  const batch = pb.createBatch();
  const requestId = createRecordId(24);
  const operations: Array<{event: string; id: string}> = [];
  let sending: Promise<AtomicResult[]> | undefined;
  function mutable() { if (sending) throw new Error('Batch sudah dikirim dan tidak dapat diubah.'); }
  function confirmed(results: AtomicResult[]): AtomicResult[] {
    if (results.length !== operations.length + 1 || results.at(-1)?.body?.atomic !== true) {
      throw new Error('Konfirmasi commit batch tidak lengkap.');
    }
    operations.forEach((op,index) => {
      const result = results[index];
      if (!result || result.status < 200 || result.status >= 300 || (op.event !== 'deleted' && result.body?.id !== op.id)) {
        throw new Error('Respons record batch tidak valid.');
      }
    });
    return results.slice(0,-1);
  }
  return {
    collection(name: string) {
      const service = batch.collection(name);
      return {
        create(data: Record<string, unknown> | FormData) {
          mutable();
          const id = String(data instanceof FormData ? data.get('id') || createRecordId() : data.id || createRecordId());
          const payload = data instanceof FormData ? new FormData() : {...data,id};
          if (data instanceof FormData && payload instanceof FormData) data.forEach((value,key) => payload.append(key,value));
          if (payload instanceof FormData) payload.set('id',id);
          operations.push({event:'created',id}); service.create(payload);
        },
        update(id: string, data: Record<string, unknown> | FormData) {
          mutable(); operations.push({event:'updated',id}); service.update(id,data);
        },
        delete(id: string) { mutable(); operations.push({event:'deleted',id}); service.delete(id); },
      };
    },
    send(extraEvents: SyncEvent[] = [], onPersisted?: () => void): Promise<AtomicResult[]> {
      if (sending) return sending;
      sending = (async () => {
        if (extraEvents.length) throw new Error('Semua perubahan wajib dimasukkan ke dalam batch yang sama.');
        await flushPendingSync(); // Drain only the old application's durable outbox.
        await ensureAtomicLedger();
        rememberAtomicRequest(requestId,options.draftKey);
        let results: AtomicResult[];
        try {
          results = confirmed(await batch.send({query:{atomic_request_id:requestId},requestKey:null}));
        } catch (error) {
          // The server resolves under a write lock: committed receipt OR a cancellation
          // that prevents a late request from committing. Never guess based on HTTP status.
          let recovery;
          try {
            recovery = await resolveAtomicRequest(requestId);
          } catch {
            announcePendingAtomic();
            throw new Error(`${transactionError(error).message} Status transaksi belum dapat dikonfirmasi. Login ulang jika diperlukan, lalu periksa transaksi sebelum mengirim ulang.`);
          }
          if (recovery.status === 'committed') results = confirmed(recovery.results!);
          else { clearAtomicRequest(requestId); throw transactionError(error); }
        }
        clearAtomicRequest(requestId);
        onPersisted?.();
        return results;
      })();
      return sending;
    },
  };
}
