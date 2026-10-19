# Sumber data dan konfigurasi Prima Motor

File `datasource` di root adalah sumber konfigurasi koneksi aplikasi dan port Docker. File ini format KEY=VALUE tanpa ekspansi variabel dan tanpa rahasia. Jangan menambahkan URL/port produksi ke komponen React, hook PocketBase, atau konfigurasi Laravel. Jangan memakai `VITE_PB_URL`/`VITE_LARAVEL_API_URL` lama: frontend membaca `datasource` saat build.

## Dari mana data dimuat dan ke mana input disimpan?

- Frontend memuat dan menyimpan record melalui PocketBase (`PB_PUBLIC_URL`). Koleksi utama: menu, cashflow, produk, log_stock, ongkos, gaji, bon, dropdown, user, report.
- Data tersimpan di SQLite `PB_DATA_DIR/data.db` pada host. Dengan nilai bawaan, lokasi itu `Backend/pb_data/data.db`. Upload PocketBase berada di `PB_DATA_DIR/storage`. Cadangkan seluruh direktori data, bukan hanya frontend.
- PocketBase memasang direktori data tersebut pada `/pocketbase/pb_data`; Laravel memasang direktori yang sama pada `/var/www/html/pb_data`. Laravel tidak menggunakan database bisnis terpisah.
- Laravel melayani endpoint tambahan lewat `API_PUBLIC_URL`, membaca SQLite yang sama, dan memverifikasi sesi melalui `PM_PB_INTERNAL_URL`.
- Input keuangan menggunakan batch PocketBase dan hook atomic ledger: perubahan induk, detail, saldo, stok, serta pembalikan saat edit/hapus diproses dalam transaksi database. Jangan mengembalikan pola simpan record lalu memperbarui saldo melalui request lain.
- Profil pengguna ditulis ke koleksi user; file menggunakan penyimpanan PocketBase. localStorage hanya menyimpan sesi/draft/status request, bukan database utama.

## Docker dan Cloudflare

Jalankan Compose melalui wrapper agar selalu membaca file ini:

```sh
./compose config --quiet
npm --prefix Frontend run build
./compose up -d --build
./compose exec pm-laravel-api php artisan config:clear
```

Bentuk setara: `docker compose --env-file datasource ...`. Perintah Compose tanpa `--env-file` sengaja gagal jika variabel wajib tidak tersedia, agar tidak diam-diam menggunakan port berbeda.

| Hostname Cloudflare | Tujuan tunnel saat ini | Sumber port |
| --- | --- | --- |
| backend.primamotorgladag.my.id | http://host.docker.internal:8090 | PB_HOST_PORT |
| api.primamotorgladag.my.id | http://host.docker.internal:8000 | API_HOST_PORT |

WEB_HOST_PORT menyediakan frontend pada host (bawaan 8080). WEB_PUBLIC_URL mencatat domain frontend; rute tunnel frontend harus mengarah ke Nginx. Pengaturan Cloudflare dikelola di dashboard Cloudflare, tidak berubah otomatis oleh file lokal ini.

Untuk mengganti port host, ubah PB_HOST_PORT/API_HOST_PORT/WEB_HOST_PORT di `datasource`, build ulang frontend, jalankan `./compose up -d`, lalu sesuaikan tujuan tunnel di Cloudflare. URL publik tidak perlu berubah jika hostname tetap. Port internal container tetap; jangan mengganti PM_PB_INTERNAL_URL hanya karena port host berubah. PM_API_INTERNAL_URL adalah alamat Laravel melalui Nginx untuk proxy PocketBase.

Frontend memakai localhost dan port datasource saat dibuka melalui localhost/127.0.0.1; domain lain memakai URL HTTPS publik. Build menghasilkan URL publik saja, tidak membocorkan path database atau alamat internal Docker. Vite dev harus dimulai ulang setelah datasource berubah. Laravel CLI lokal juga membaca datasource; DB_DATABASE/POCKETBASE_URL tetap boleh di-override hanya untuk pengujian terisolasi. Docker memasok nilai dari datasource melalui env_file.

Mengganti PB_DATA_DIR adalah pemindahan data, bukan sekadar perubahan port: salin/cadangkan database dan file sebelum mengarahkannya ke lokasi baru. Jangan menunjuk folder kosong pada sistem operasional.

## Kebijakan akses

Akun login berstatus Active/active boleh menambah dan mengubah data operasional tanpa pembatasan level. Aturan hapus tetap seperti sebelumnya. Pembacaan gaji tetap pribadi, kecuali level 1 dapat membaca semua. Administrasi login (level/status pengguna) tetap dilindungi. Stok realtime dan saldo hasil ledger tetap dilindungi; gunakan transaksi/koreksi stok yang tercatat. Hak koreksi saldo manual administrator yang sudah ada tetap dipertahankan.

## Verifikasi

```sh
npm --prefix Frontend test
npm --prefix Frontend run typecheck
php8.3 Backend/vendor/bin/phpunit -c Backend/phpunit.xml --do-not-cache-result
python3 Backend/tests/integration/pocketbase_transactions.py
```

Tes integrasi menggunakan database dan server sementara. Jangan menguji create/edit/delete memakai data pelanggan nyata.
