/// <reference path="../pb_data/types.d.ts" />
migrate(app => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  // Only entry permissions change. Keep every existing delete/list/view rule.
  for (const name of ['menu','cashflow','produk','log_stock','ongkos','gaji','bon','dropdown']) {
    const collection = app.findCollectionByNameOrId(name);
    collection.createRule = active;
    collection.updateRule = name === 'produk' ? `(${active}) && @request.body.stok_3:changed = false` : active;
    app.save(collection);
  }
}, () => { /* Preserve explicitly requested entry access. */ });
