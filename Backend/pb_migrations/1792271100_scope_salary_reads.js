/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const salary = app.findCollectionByNameOrId('gaji');
  const rule = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active') && (@request.auth.level = 1 || (@request.auth.username != '' && person = @request.auth.username))";
  salary.listRule = rule;
  salary.viewRule = rule;
  app.save(salary);
}, (_) => { /* Keep personal salary reads protected on rollback. */ });
