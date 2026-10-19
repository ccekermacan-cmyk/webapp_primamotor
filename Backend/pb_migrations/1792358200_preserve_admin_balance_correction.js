migrate(app => {
  const c = app.findCollectionByNameOrId('dropdown');
  // Preserve existing administrator correction access; other users enter cashflow instead.
  c.updateRule = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active') && (@request.auth.level = 1 || @request.body.number_1:changed = false)";
  app.save(c);
}, () => {});
