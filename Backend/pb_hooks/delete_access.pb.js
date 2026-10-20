// Read-only permission preview. Actual DELETE always rechecks rules and ledger constraints.
routerAdd('POST', '/api/permissions/delete', e => {
  if (!e.auth || e.auth.collection().name !== 'user' || !['Active','active'].includes(e.auth.getString('status'))) throw new UnauthorizedError('Silakan login dengan akun aktif.');
  const records = e.requestInfo().body.records;
  if (!Array.isArray(records) || records.length > 200) throw new BadRequestError('Daftar pemeriksaan izin tidak valid.');
  const info = new RequestInfo({auth:e.auth,method:'DELETE',body:{}});
  const results = records.map(item => {
    let allowed = false;
    if (!item || !['menu','cashflow','produk','dropdown','user','bon','gaji'].includes(item.collection) || typeof item.id !== 'string') return {allowed:false};
    try {
      let record = e.app.findRecordById(item.collection,item.id);
      if (!e.app.canAccessRecord(record,info,record.collection().viewRule)) return {collection:item.collection,id:item.id,allowed:false};
      // The bon action deletes its cashflow parent, as in the existing UI handler.
      if (item.collection === 'bon' && record.getString('ref_cashflow')) record = e.app.findRecordById('cashflow',record.getString('ref_cashflow'));
      allowed = e.app.canAccessRecord(record,info,record.collection().viewRule) && e.app.canAccessRecord(record,info,record.collection().deleteRule);
      if (allowed && ['menu','cashflow','bon'].includes(record.collection().name)) require(`${__hooks}/lib/atomic_ledger.js`).authorize({app:e.app,auth:e.auth,record},true);
      if (allowed && record.collection().name === 'produk') require(`${__hooks}/lib/products.js`).deletion({app:e.app,record});
    } catch (_) { allowed = false; }
    return {collection:item.collection,id:item.id,allowed};
  });
  return e.json(200,{results});
});
