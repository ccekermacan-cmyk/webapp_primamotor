/// <reference path="../pb_data/types.d.ts" />
// The batch's final synthetic request runs before PocketBase commits or returns success.
onBatchRequest((e) => {
  const ledger = require(`${__hooks}/lib/atomic_ledger.js`);
  if (!ledger.ready(e.app)) { e.next(); return; }
  const requestId = String(e.requestInfo().query.atomic_request_id || '');
  if (requestId) {
    const receipts = require(`${__hooks}/lib/atomic_requests.js`);
    const key = receipts.key(e,requestId), previous = receipts.get(e.app,key);
    if (previous) {
      if (previous.status === 'committed') return e.json(200,previous.results);
      throw new BadRequestError('Permintaan ini sudah dibatalkan. Silakan kirim ulang setelah memuat data terbaru.');
    }
    const operations = e.batch.map(request => {
      const match = request.url.match(/^\/api\/collections\/([^/?]+)\/records(?:\/([^/?]+))?(?:\?.*)?$/);
      if (!match || !['POST','PATCH','DELETE'].includes(request.method)) throw new BadRequestError('Operasi batch tidak didukung.');
      const id = match[2] || (request.body || {}).id;
      if (!id) throw new BadRequestError('Setiap record baru wajib memiliki ID sebelum batch dikirim.');
      return {collection:match[1],id,method:request.method};
    });
    e.set('pmAtomicReceipt',key);
    e.set('pmAtomicOperations',JSON.stringify(operations));
  }
  const nonce = $security.randomString(24);
  e.set('pmAtomicBatch',nonce);
  e.batch.push({method:'POST',url:'/api/collections/_pm_atomic_commit/records',body:{nonce}});
  e.next();
});
onRecordCreateRequest((e) => {
  if (e.requestInfo().context !== 'batch' || e.record.getString('nonce') !== e.get('pmAtomicBatch')) throw new BadRequestError('Commit hanya dapat dijalankan di dalam batch.');
  require(`${__hooks}/lib/atomic_ledger.js`).finish(e.app,e.record.getString('nonce'));
  require(`${__hooks}/lib/atomic_requests.js`).commit(e.app,e.get('pmAtomicReceipt'),e.get('pmAtomicOperations'));
  return e.json(200,{atomic:true});
}, '_pm_atomic_commit');

onRecordCreateRequest((e) => {
  e.record.set('_pm_internal',false);
  e.record.set('_pm_expected',JSON.stringify(e.requestInfo().body.atomic_expected || null));
  e.record.set('_pm_expected_stock',JSON.stringify(e.requestInfo().body.expected_stock ?? null));
  e.record.set('_pm_batch',e.requestInfo().context === 'batch' ? e.get('pmAtomicBatch') : '');
  e.next();
}, 'menu','cashflow','log_stock','ongkos','bon');
onRecordUpdateRequest((e) => {
  e.record.set('_pm_internal',false);
  e.record.set('_pm_expected',JSON.stringify(e.requestInfo().body.atomic_expected || null));
  e.record.set('_pm_expected_stock',JSON.stringify(e.requestInfo().body.expected_stock ?? null));
  e.record.set('_pm_batch',e.requestInfo().context === 'batch' ? e.get('pmAtomicBatch') : '');
  e.next();
}, 'menu','cashflow','log_stock','ongkos','bon');
onRecordDeleteRequest((e) => {
  require(`${__hooks}/lib/atomic_ledger.js`).authorize(e,true);
  e.record.set('_pm_internal',false);
  e.record.set('_pm_expected',JSON.stringify(e.requestInfo().body.atomic_expected || null));
  e.record.set('_pm_expected_stock',JSON.stringify(e.requestInfo().body.expected_stock ?? null));
  e.record.set('_pm_batch',e.requestInfo().context === 'batch' ? e.get('pmAtomicBatch') : '');
  e.next();
}, 'menu','cashflow','log_stock','ongkos','bon');
onRecordCreate((e) => { require(`${__hooks}/lib/atomic_ledger.js`).mutation(e,'created'); }, 'menu','cashflow','log_stock','ongkos','bon');
onRecordUpdate((e) => { require(`${__hooks}/lib/atomic_ledger.js`).mutation(e,'updated'); }, 'menu','cashflow','log_stock','ongkos','bon');
onRecordDelete((e) => { require(`${__hooks}/lib/atomic_ledger.js`).mutation(e,'deleted'); }, 'menu','cashflow','log_stock','ongkos','bon');
routerAdd('GET','/api/financial/health',(e) => {
  if (!require(`${__hooks}/lib/atomic_ledger.js`).ready(e.app)) return e.json(503,{message:'Migrasi atomic ledger belum diterapkan.'});
  return e.json(200,{atomic_ledger:1});
});

routerAdd('POST','/api/financial/requests/{id}/resolve',(e) => {
  const receipts = require(`${__hooks}/lib/atomic_requests.js`);
  const key = receipts.key(e,e.request.pathValue('id'));
  return e.json(200,receipts.resolve(e.app,key));
});

onRecordUpdateRequest((e) => {
  e.record.set('_pm_submitted',JSON.stringify(Object.keys(e.requestInfo().body)));
  e.record.set('_pm_recalculate_person',e.requestInfo().body.recalculate_person === true);
  e.next();
}, 'user','produk','dropdown');
onRecordUpdate((e) => {
  const submitted = e.record.getString('_pm_submitted');
  if (!submitted) { e.next(); return; }
  e.app.runInTransaction(app => {
    e.app = app;
    const fields = JSON.parse(submitted), name = e.record.collection().name;
    const protectedFields = name === 'user' ? ['number','level','status'] : name === 'produk' ? ['stok_3','beli'] : ['number_1','number_2','number_3','number_4','number_5'];
    const current = app.findRecordById(name,e.record.id);
    for (const field of protectedFields) if (!fields.includes(field)) e.record.set(field,current.get(field));
    if (name === 'dropdown' && e.record.getBool('_pm_recalculate_person')) {
      e.record.set('number_1',require(`${__hooks}/lib/atomic_ledger.js`).personBalance(app,current));
    }
    e.next();
  });
}, 'user','produk','dropdown');
