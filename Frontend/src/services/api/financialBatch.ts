import { pb } from '../pocketbase/client';
import { flushPendingSync, syncLaravelEvents, type SyncEvent } from './laravel';

const monitored = new Set(['menu', 'log_stock', 'cashflow', 'ongkos', 'bon']);

// Keep response indices tied to actual PocketBase requests, including unmonitored collections.
export function createFinancialBatch() {
  const batch = pb.createBatch();
  const tracked: Array<{ index: number; entry: SyncEvent }> = [];
  let index = 0;
  return {
    collection(name: string) {
      const service = batch.collection(name);
      return {
        create(data: Record<string, unknown> | FormData) {
          if (monitored.has(name)) tracked.push({ index, entry: { collection: name, event: 'created', id: '' } });
          index++;
          service.create(data);
        },
        update(id: string, data: Record<string, unknown> | FormData) {
          if (monitored.has(name)) tracked.push({ index, entry: { collection: name, event: 'updated', id } });
          index++;
          service.update(id, data);
        },
        delete(id: string) {
          if (monitored.has(name)) tracked.push({ index, entry: { collection: name, event: 'deleted', id } });
          index++;
          service.delete(id);
        },
      };
    },
    async send(extraEvents: SyncEvent[] = [], onPersisted?: () => void) {
      await flushPendingSync();
      await Promise.all(tracked.map(async ({ entry }) => {
        if (entry.event === 'created') return;
        const snapshot = await pb.collection(entry.collection).getOne(entry.id, { requestKey: null });
        if (entry.event === 'updated') entry.old_data = snapshot;
        else entry.record = snapshot;
      }));
      const results = await batch.send();
      for (const item of tracked) {
        const result = results[item.index];
        if (!result || result.status >= 400) throw new Error('Respons batch tidak lengkap.');
        if (item.entry.event === 'created') item.entry.id = result.body?.id || '';
        if (item.entry.event !== 'deleted') item.entry.record = result.body;
      }
      onPersisted?.();
      await syncLaravelEvents([...extraEvents, ...tracked.map(item => item.entry)]);
      return results;
    },
  };
}
