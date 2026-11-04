/// <reference path="../pb_data/types.d.ts" />
// Izinkan stok realtime (stok_3) ditimpa langsung untuk impor/koreksi dari luar.
// Aturan masuk operasional sebelumnya (1792358000) membatasi update produk pada
// `stok_3:changed = false`; klausa itu dihapus sehingga produk mengikuti aturan
// akun aktif yang sama dengan koleksi operasional lain.
// Konsistensi riwayat log_stock dijaga hook produk (reanchorStock).
migrate((app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  const produk = app.findCollectionByNameOrId('produk');
  produk.updateRule = active;
  app.save(produk);
}, (app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  const produk = app.findCollectionByNameOrId('produk');
  produk.updateRule = `(${active}) && @request.body.stok_3:changed = false`;
  app.save(produk);
});
