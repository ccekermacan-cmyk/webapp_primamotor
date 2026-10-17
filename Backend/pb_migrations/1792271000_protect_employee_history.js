/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  const finance = '(@request.auth.level >= 1 && @request.auth.level <= 6)';
  const salary = app.findCollectionByNameOrId('gaji');
  const ownSalary = "(@request.auth.username != '' && person = @request.auth.username)";
  salary.listRule = `(${active}) && (${finance} || ${ownSalary})`;
  salary.viewRule = salary.listRule;
  salary.createRule = `(${active}) && ${finance}`;
  salary.updateRule = salary.createRule;
  salary.deleteRule = salary.createRule;
  app.save(salary);

  const bon = app.findCollectionByNameOrId('bon');
  const ownBon = `(user = @request.auth.id || (user = '' && @request.auth.username != '' && (persontext = @request.auth.username || person.id_lama = @request.auth.username || ref_gaji.person = @request.auth.username || ref_cashflow.persontext = @request.auth.username)))`;
  bon.listRule = `(${active}) && (${finance} || ${ownBon})`;
  bon.viewRule = bon.listRule;
  bon.createRule = `(${active}) && ${finance}`;
  bon.updateRule = bon.createRule;
  bon.deleteRule = bon.createRule;
  app.save(bon);
}, (_) => { /* Retain protection for employee salary and loan records. */ });
