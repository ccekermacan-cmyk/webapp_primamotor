# Checklist rilis POS Android

Tanggal mulai: 27-11-2026. Perangkat uji: OPPO CPH2461, Android 14, arm64-v8a.

## Sudah diukur otomatis

- [x] APK rilis `arm64-v8a` ≤ 12 MB: **2,4 MB** (`app/build/outputs/apk/release/`)
- [x] Cold start ≤ 2000 ms, tiga kali berturut: **1119 ms / 987 ms / 1137 ms**
- [x] Unit test JVM: **54/54 lulus**
- [x] Instrumented test di HP fisik: **52/52 lulus**
- [x] Integrasi server (PocketBase + Laravel, data sintetis): **26/26 lulus**, termasuk field `barcode`
- [x] Migrasi `barcode` aditif: field, backfill dari `id_lama`, indeks `idx_produk_barcode`
- [x] Aplikasi rilis terpasang dan membuka layar login tanpa crash
- [x] Logout: outbox tetap, cache gaji bersih dibuang, printer tersimpan per perangkat
- [x] Sinkron otomatis: setelah login, saat jaringan tersambung kembali, dan saat aplikasi kembali ke depan
- [x] Menu utama memakai drawer (sidebar web); POS memakai grid produk dan panel keranjang di layar lebar

## Perlu diuji manual di toko (belum dijalankan di sini)

- [ ] Mode pesawat: transaksi baru → sambungkan internet → sinkron → saldo/stok server cocok
- [ ] Printer 58 mm nyata: cetak struk, matikan printer di tengah cetak, nyalakan, cetak ulang
- [ ] Barcode cetak: pindai dengan kamera dan dengan pemindai gun; produk benar terbuka
- [ ] Reboot HP saat masih offline: transaksi outbox tetap ada dan terkirim setelah login
- [ ] Data 30 hari (nota 180 hari): buka riwayat, kas, dan laporan tanpa jeda berarti
- [ ] Dua akun di satu HP: ganti pengguna, pastikan gaji pengguna sebelumnya tidak terlihat
- [ ] Transaksi ditolak server (stok kurang saat online): muncul di strip atas, coba kirim ulang dan batalkan
- [ ] Cetak struk pelunasan nota tempo
- [ ] Login pertama dengan jaringan lambat/putus di tengah: pesan jelas, tidak ada transaksi ganda

## Sebelum menyerahkan ke toko

- [ ] Isi `Android/keystore.properties` dengan keystore rilis nyata (bukan debug)
- [ ] Pastikan `PB_PUBLIC_URL` di `datasource` menunjuk server yang benar, lalu build ulang
- [ ] Simpan salinan keystore dan kata sandi di luar repo
- [ ] Catat nomor versi (`versionName`) yang dipasang di tiap HP
- [ ] Siapkan prosedur hapus aplikasi: transaksi yang belum terkirim hilang jika aplikasi dihapus
- [ ] Sinkronkan sekali sebelum menutup toko pada hari pemasangan
