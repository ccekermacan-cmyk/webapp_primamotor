# Petunjuk agent

Baca DATASOURCE.md sebelum mengubah koneksi, Docker, database, atau izin CRUD.

- `datasource` adalah satu sumber alamat layanan, port host, dan lokasi data. Gunakan `./compose` agar Compose memuat file tersebut. Jangan menduplikasi alamat produksi di kode atau .env frontend.
- Pertahankan atomic ledger PocketBase dan receipt idempotensi. Edit/hapus wajib membalik nilai transaksi lama, lalu menerapkan nilai baru dalam satu transaksi.
- Semua akun aktif dapat tambah/ubah data operasional. Jangan melonggarkan aturan hapus, privasi gaji, atau hak administrasi login tanpa permintaan pengguna.
- Gunakan migrasi tambahan; jangan mengandalkan edit migrasi yang sudah diterapkan. Folder hook/migrasi terpasang langsung ke Docker operasional: perubahan bisa aktif segera.
- Jalankan tes terisolasi; jangan memakai record bisnis nyata untuk pengujian mutasi. Dokumentasikan hasil tes dan kebutuhan restart/build.
