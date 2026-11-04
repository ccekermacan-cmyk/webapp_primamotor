/// <reference path="../pb_data/types.d.ts" />
// Proteksi lama tetap: stok realtime (stok_3) hanya berubah lewat log_stock.
// Tambahan: API/impor boleh menimpa stok bila body menyertakan `stok_override: true`.
// Perubahan stok lewat jalur override di-anchor ulang ke riwayat log_stock oleh
// hook produk, sehingga stok_awal/stok_akhir tetap konsisten.
migrate((app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  const produk = app.findCollectionByNameOrId('produk');
  produk.updateRule = `(${active}) && (@request.body.stok_3:changed = false || @request.body.stok_override = true)`;
  app.save(produk);
}, (app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  const produk = app.findCollectionByNameOrId('produk');
  produk.updateRule = `(${active}) && @request.body.stok_3:changed = false`;
  app.save(produk);
});
