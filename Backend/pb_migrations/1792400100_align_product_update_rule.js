/// <reference path="../pb_data/types.d.ts" />
// Selaraskan aturan update produk dengan aturan masuk operasional (1792358000):
// semua akun aktif boleh mengubah data operasional, tanpa batas level tambahan.
// Migrasi sebelumnya (1792400000) hanya melepas proteksi stok_3 dari aturan lama,
// sehingga sempat memunculkan kembali batas level untuk beli/stok_1/stok_2.
migrate((app) => {
  const active = "@request.auth.id != '' && (@request.auth.status = 'Active' || @request.auth.status = 'active')";
  const produk = app.findCollectionByNameOrId('produk');
  produk.updateRule = active;
  app.save(produk);
}, () => { /* Aturan rollback ditangani 1792400000. */ });
