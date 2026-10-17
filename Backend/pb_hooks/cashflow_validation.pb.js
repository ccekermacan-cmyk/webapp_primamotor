/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/cashflow_validation.js`).validate(e, false);
  e.next();
}, 'cashflow');
onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/cashflow_validation.js`).validate(e, true);
  e.next();
}, 'cashflow');
