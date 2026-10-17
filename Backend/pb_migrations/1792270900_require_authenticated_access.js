/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  // Business records must never be accessible through the anonymous REST API.
  for (const name of ['cashflow', 'dropdown', 'bon', 'menu', 'gaji', 'ongkos', 'produk', 'log_stock', 'report', 'user']) {
    let collection;
    try { collection = app.findCollectionByNameOrId(name); } catch (_) { continue; }
    for (const action of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
      collection[action] = active;
    }
    if (name === 'dropdown') {
      collection.updateRule = `(${active}) && (@request.auth.level = 1 || (jenis !~ 'account' && @request.body.jenis:changed = false && @request.body.kategori:changed = false && @request.body.enum_1:changed = false && @request.body.visibilitas:changed = false))`;
      collection.createRule = `(${active}) && (@request.auth.level = 1 || ( @request.body.jenis !~ 'account' && @request.body.kategori ~ 'person'))`;
      collection.deleteRule = `(${active}) && @request.auth.level = 1`;
    }
    if (name === 'user') {
      collection.createRule = `(${active}) && @request.auth.level = 1`;
      collection.deleteRule = collection.createRule;
      collection.updateRule = `(${active}) && (@request.auth.level = 1 || (id = @request.auth.id && @request.body.level:changed = false && @request.body.status:changed = false && @request.body.number:changed = false))`;
    }
    app.save(collection);
  }
}, (_) => { /* Security rules deliberately remain enabled on rollback. */ });
