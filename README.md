# Prima Motor POS

Aplikasi kasir dan operasional toko/bengkel. Frontend memakai React, TypeScript, dan Vite; PocketBase menyediakan autentikasi, file, dan API data; Laravel menghitung efek transaksi pada database SQLite PocketBase yang sama.

## Alur transaksi

- `menu`: nota induk; `log_stock`: pergerakan stok; `cashflow`: pembayaran dan mutasi rekening; `ongkos`: jasa mekanik.
- `gaji`: slip karyawan. `bon.ref_gaji` menunjuk **record gaji**, `bon.ref_menu` menunjuk nota induk, dan `bon.user` menunjuk karyawan.
- Frontend menyimpan nota beserta detail dalam batch PocketBase. Perubahan stok/saldo hanya dijalankan oleh observer Laravel melalui `/api/webhooks/batch`.
- Satu batch sinkronisasi diproses dalam transaksi database dan memakai `request_id` tetap ketika dicoba ulang. Snapshot lama disertakan untuk edit/hapus.
- Sinkronisasi yang belum selesai disimpan per pengguna di localStorage. Panel sinkronisasi memblokir transaksi berikutnya sampai antrean selesai. Jangan membuat ulang transaksi yang sudah tersimpan, atau menghapus localStorage untuk menghilangkan panel tersebut.
- Penghapusan nota dilakukan melalui `DELETE /api/transactions/menu/{id}` sehingga detail, stok, saldo, dan bon diproses bersama.

## Menjalankan

Gunakan Node yang memenuhi persyaratan Vite 8 (pengujian menggunakan Node 24), PHP dengan `pdo_sqlite` (pengujian menggunakan PHP 8.3), Composer, dan PocketBase.

```sh
cd Frontend
npm ci
npm run dev
```

Konfigurasi frontend: `VITE_PB_URL` dan `VITE_LARAVEL_API_URL`. Konfigurasi Laravel: `DB_CONNECTION=sqlite`, `DB_DATABASE` menunjuk file `Backend/pb_data/data.db`, dan `POCKETBASE_URL` menunjuk layanan PocketBase. Semua panggilan API Laravel membutuhkan token pengguna PocketBase aktif.

Docker Compose di root menjalankan PocketBase, PHP-FPM/Laravel, dan Nginx. Build frontend terlebih dahulu dengan `npm --prefix Frontend run build`.

## Pembaruan skema

Migrasi PocketBase `1792270800_add_transaction_relations.js` menambahkan relasi `menu.person_baru`, `bon.user`, dan `bon.ref_menu` jika belum ada. Terapkan migrasi PocketBase sebelum menggunakan frontend/backend yang diperbarui. PocketBase menjalankan migrasi tertunda saat mulai; pada instalasi lokal, gunakan perintah migrasi dengan direktori data yang benar.

Migrasi PocketBase `1792270900_require_authenticated_access.js` menutup akses anonim pada koleksi bisnis, membatasi perubahan level/status/saldo pengguna, dan melindungi master akun. Sertakan folder `pb_hooks/lib` bersama `cashflow_validation.pb.js` ketika memperbarui layanan PocketBase. Hook memvalidasi nominal, transfer, izin akun, dan saldo sebelum menyimpan record; pemeriksaan saldo terakhir tetap dilakukan Laravel saat sinkronisasi.

Cashflow menghitung ulang snapshot saldo akun terkait setelah edit/hapus histori. Bon manual dapat ditautkan lewat `bon.ref_cashflow`; edit/hapus cashflow memperbarui bon terkait. Pembelian jatuh tempo memakai tanggal bisnis Asia/Jakarta dan seluruh halaman data. Hitung ulang piutang hanya memakai penjualan/service, sedangkan hutang memakai pembelian.

Migrasi `1792271000_protect_employee_history.js` membatasi baca gaji/bon karyawan ke data pribadi untuk level di luar 1–6. Level 1–6 tetap dapat mengelola data keuangan; riwayat bon pada halaman **Akun Saya** selalu memfilter profil sendiri. Migrasi `1792271100_scope_salary_reads.js` membatasi baca gaji: hanya level 1 dapat membaca seluruh gaji, level lainnya hanya gaji dengan username miliknya. Daftar dan total gaji halaman akun mengikuti cakupan tersebut. Hak tulis gaji/bon dibatasi ke level 1–6. Endpoint Laravel bon untuk level lainnya ditolak; riwayat pribadi dibaca lewat PocketBase.

Halaman akun menggunakan `user.level`, relasi `gaji.ref_baru` untuk periode, dan koleksi `bon` untuk riwayat pinjaman/pembayaran. Sisa bon memakai saldo akun (`user.number`), sedangkan rasio pelunasan memakai seluruh mutasi bon, bukan penilaian bulanan atau skor kredit. Verifikasi privasi memakai auth store terpisah; perubahan password memperbarui sesi dan tidak dikirim ke webhook Laravel. Perubahan email memakai tautan konfirmasi PocketBase dan memerlukan layanan email/SMTP yang dikonfigurasi. Tes integrasi memakai SMTP lokal sementara sehingga tidak mengirim email keluar.

Migrasi Laravel `2026_10_17_000001_add_transaction_snapshots.php` menyelaraskan kolom snapshot untuk instalasi/test Laravel. Migrasi tersebut tidak menghapus kolom milik PocketBase ketika di-rollback. Pengujian tidak menjalankan migrasi atau rekonsiliasi transaksi pada database operasional.

## Integritas produk dan stok

Migrasi `1792271200_protect_product_stock.js` melindungi stok realtime dari pembaruan langsung serta menyesuaikan hak edit harga beli/stok dengan form produk. Sertakan `product_validation.pb.js` dan `pb_hooks/lib/products.js` saat memperbarui PocketBase. Hapus produk hanya untuk level 1, dan ditolak jika masih memiliki stok atau histori transaksi.

Produk baru dan log stok awal dikirim dalam satu batch. Penyesuaian manual memakai log harga nol sehingga tidak mengubah harga beli atau omzet. Edit metadata hanya mengirim field yang berubah; penyesuaian stok absolut ditolak jika saldo stok sudah berubah sejak form dibuka. Harga beli pembelian mengikuti log masuk berharga terbaru berdasarkan tanggal, termasuk ketika log dipindahkan produk atau diberi tanggal mundur. Kode alfanumerik dipertahankan dan duplikasi kode dilaporkan tanpa mengganti kode pilihan pengguna.

Validasi menolak stok/kuantitas negatif atau pecahan, mengikuti kolom stok produk PocketBase yang bertipe bilangan bulat. Pilihan kategori/tipe diperbarui setelah simpan; pencarian dan riwayat memakai pengaman respons lama. Foto ditambah dengan `file+` dan dihapus selektif dengan `file-`. Pratinjau membedakan gambar/video, membatasi jumlah lampiran ke 10, dan menyediakan fallback saat media gagal dimuat.

## Verifikasi

```sh
npm --prefix Frontend test
npm --prefix Frontend run typecheck
npm --prefix Frontend run build
cd Backend
php8.3 vendor/bin/phpunit --do-not-cache-result
```

PHPUnit dikonfigurasi menggunakan SQLite `:memory:`. Untuk integrasi PocketBase dan Laravel sungguhan:

```sh
python3 Backend/tests/integration/pocketbase_transactions.py
```

Tes integrasi hanya membaca definisi koleksi dari database lokal, lalu membuat server, database, akun, dan transaksi sementara. Tidak menyalin record atau berkas operasional. Memerlukan port lokal 18080 dan 18090 yang tersedia. Database uji dihapus ketika tes berhasil; log uji disimpan di `/tmp` ketika gagal.

`npm --prefix Frontend run lint` masih melaporkan utang lint pada kode lama, terutama tipe `any` dan aturan React Hooks. Build sekarang menjalankan pemeriksaan TypeScript sebelum bundling.
