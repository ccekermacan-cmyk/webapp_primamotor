/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const products = app.findCollectionByNameOrId('produk');
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  products.deleteRule = `(${active}) && @request.auth.level = 1`;
  products.updateRule = `(${active}) && @request.body.stok_3:changed = false && (@request.auth.level = 1 || @request.body.beli:changed = false) && (@request.auth.level = 1 || @request.auth.level = 5 || @request.body.stok_1:changed = false) && (@request.auth.level = 1 || @request.auth.level = 6 || @request.auth.level = 7 || @request.auth.level = 10 || @request.body.stok_2:changed = false)`;
  app.save(products);
}, (_) => { /* Keep stock and product history protections enabled. */ });
