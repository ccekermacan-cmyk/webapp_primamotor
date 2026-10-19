migrate(app => {
  const c = app.findCollectionByNameOrId('dropdown');
  c.updateRule = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active') && @request.body.number_1:changed = false";
  app.save(c);
}, () => {});
