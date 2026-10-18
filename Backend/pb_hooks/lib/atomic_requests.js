// A receipt is committed in the same transaction as its business records.
// Resolution takes a write lock and records a cancellation when no commit exists;
// a late original request then rolls back instead of creating a duplicate.
exports.key = (e, requestId) => {
  if (!e.auth || (e.auth.collection().name !== '_superusers' && e.auth.getString('status').toLowerCase() !== 'active')) throw new UnauthorizedError('Sesi tidak aktif.');
  if (!/^[a-zA-Z0-9_-]{15,80}$/.test(requestId)) throw new BadRequestError('ID transaksi tidak valid.');
  return e.auth.id + ':' + requestId;
};
exports.get = (app, key) => {
  const result = arrayOf(new DynamicModel({response_json:''}));
  app.db().newQuery('SELECT response_json FROM _pm_atomic_requests WHERE id = {:key}').bind({key}).all(result);
  return result.length ? JSON.parse(result[0].response_json) : null;
};
exports.commit = (app, key, operations) => {
  if (!key) return;
  const results = JSON.parse(operations).map(op => ({status:op.method === 'DELETE' ? 204 : 200,
    body:op.method === 'DELETE' ? null : app.findRecordById(op.collection,op.id).publicExport()}));
  results.push({status:200,body:{atomic:true}});
  app.db().newQuery('INSERT INTO _pm_atomic_requests(id,response_json) VALUES ({:key},{:response})')
    .bind({key,response:JSON.stringify({status:'committed',results})}).execute();
};
exports.resolve = (app, key) => {
  let result;
  app.runInTransaction(tx => {
    tx.db().newQuery('INSERT OR IGNORE INTO _pm_atomic_requests(id,response_json) VALUES ({:key},{:response})')
      .bind({key,response:JSON.stringify({status:'cancelled'})}).execute();
    result = exports.get(tx,key);
  });
  return result;
};
