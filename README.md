# Prima Motor POS

Aplikasi kasir, stok produk, cashflow, gaji, dan akun menggunakan React/Vite, PocketBase, Laravel, dan Nginx.

## Konfigurasi dan sumber data

Baca [DATASOURCE.md](DATASOURCE.md) untuk alur data, lokasi penyimpanan, port Docker, dan tujuan tunnel Cloudflare. File **datasource** adalah sumber konfigurasi koneksi. [AGENTS.md](AGENTS.md) memuat petunjuk untuk agent berikutnya.

```sh
npm --prefix Frontend ci
npm --prefix Frontend run build
./compose config --quiet
./compose up -d --build
./compose exec pm-laravel-api php artisan config:clear
```

Untuk pengembangan frontend: `npm --prefix Frontend run dev`. Gunakan Node yang mendukung Vite 8. Backend membutuhkan PHP dengan pdo_sqlite (pengujian memakai PHP 8.3).

## Transaksi dan akses

CRUD keuangan memakai batch PocketBase, hook atomic ledger, dan receipt idempotensi. Record, saldo, stok, hutang/piutang, serta efek edit/hapus harus berhasil atau batal bersama. Request yang responsnya hilang diperiksa melalui receipt sebelum dicoba kembali. Jangan menambahkan pembaruan saldo terpisah setelah transaksi berhasil.

PocketBase dan Laravel memakai SQLite yang sama. Migrasi tambahan dan folder `pb_hooks/lib` wajib disertakan saat deployment. Docker memasang hooks/migrations langsung dari workspace; perubahan dapat aktif segera. Jangan menguji mutasi pada data bisnis nyata.

Seluruh akun aktif boleh tambah/ubah data operasional. Pembatasan hapus tetap berlaku. Gaji hanya dapat dibaca pemiliknya, kecuali level 1 yang dapat membaca semuanya. Administrasi level/status pengguna dan perlindungan saldo/stok tetap berlaku. Perubahan email membutuhkan konfirmasi melalui SMTP PocketBase.

## Pengujian

```sh
npm --prefix Frontend test
npm --prefix Frontend run typecheck
php8.3 Backend/vendor/bin/phpunit -c Backend/phpunit.xml --do-not-cache-result
python3 Backend/tests/integration/pocketbase_transactions.py
PM_SCALE_TEST=1 python3 Backend/tests/integration/pocketbase_transactions.py
```

Tes integrasi hanya membaca skema dari database lokal, lalu membuat server, database, akun, transaksi, dan SMTP sementara. Tidak menyalin record atau file operasional. Memerlukan port uji 18080/18090. Data sementara dihapus saat tes berhasil; log kegagalan disimpan di `/tmp`. Tes skala menambahkan 200.000 histori stok sintetis untuk memeriksa pengembalian stok.
