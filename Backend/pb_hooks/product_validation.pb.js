/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => { require(`${__hooks}/lib/products.js`).product(e, false); e.next(); }, 'produk');
onRecordUpdateRequest((e) => { require(`${__hooks}/lib/products.js`).product(e, true); e.next(); }, 'produk');
onRecordDeleteRequest((e) => { require(`${__hooks}/lib/products.js`).deletion(e); e.next(); }, 'produk');
onRecordCreateRequest((e) => { require(`${__hooks}/lib/products.js`).stock(e, false); e.next(); }, 'log_stock');
onRecordUpdateRequest((e) => { require(`${__hooks}/lib/products.js`).stock(e, true); e.next(); }, 'log_stock');
