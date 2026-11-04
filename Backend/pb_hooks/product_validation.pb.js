/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => { require(`${__hooks}/lib/products.js`).product(e, false); e.next(); }, 'produk');
onRecordUpdateRequest((e) => { require(`${__hooks}/lib/products.js`).product(e, true); e.next(); }, 'produk');
onRecordDeleteRequest((e) => { require(`${__hooks}/lib/products.js`).deletion(e); e.next(); }, 'produk');
onRecordCreateRequest((e) => { require(`${__hooks}/lib/products.js`).stock(e, false); e.next(); }, 'log_stock');
onRecordUpdateRequest((e) => { require(`${__hooks}/lib/products.js`).stock(e, true); e.next(); }, 'log_stock');
// stok_3 boleh diubah langsung; anchor riwayat stok dihitung ulang dalam
// transaksi yang sama sehingga perubahan stok dan riwayatnya commit bersamaan.
onRecordUpdate((e) => {
  const sebelum = e.record.original().getFloat('stok_3');
  const sesudah = e.record.getFloat('stok_3');
  if (sebelum !== sesudah) require(`${__hooks}/lib/atomic_ledger.js`).reanchorStock(e.app, e.record.id, sesudah);
  e.next();
}, 'produk');
