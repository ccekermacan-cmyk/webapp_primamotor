# Rencana Parity Android ↔ Web

Desain: `docs/superpowers/specs/2026-11-27-android-web-parity-design.md`.

## Fase 1 — fondasi (selesai)

- [x] Menu 7 halaman: Kasir, Produk, Person, Cashflow, Report, Akun, Settings
- [x] Aturan tampil menu: Settings level 1, Report level 1–6
- [x] Person: tab People/Customer/Supplier/Karyawan, cari, detail, tambah/ubah, hapus antre
- [x] Settings: master data per jenis/kategori, cari, tambah/ubah/hapus antre, printer & sinkron
- [x] Cashflow: Buku Kas & Saldo, Histori Kas, Jatuh Tempo (level 1/2/5/6)
- [x] Report: Overview, Menu (riwayat + pelunasan), Log Stock, Kas, Ongkos
- [x] Tulis offline lewat outbox untuk `dropdown` dan `user`
- [x] Tes: unit 54/54, instrumented 52/52

## Fase 2 — transaksi penuh

- [x] POS: harga tier, mekanik + ongkos, cashback, biaya admin, marketplace, media
- [x] POS: edit/hapus nota dengan pembalikan efek + pelunasan cepat dari Kasir
- [x] Produk: media, salin, hapus berpassword, field harga lengkap
- [x] Produk: filter stok (semua/menipis/habis) + penyesuaian stok cepat +/- lewat `log_stock`
- [x] Cashflow: catat kas, bon karyawan, hapus dengan pembalikan saldo
- [x] Cashflow: detail transaksi (akun, pihak, ref, operator, saldo) + hapus dari detail
- [x] Verifikasi payload vs `Frontend/src/services/posCheckout.ts`
- [x] Cashflow: filter tanggal/akun/jenis + pencarian + paginasi 20 di tab Histori
- [x] Produk: stok mengikuti cache server + mutasi lokal (pull memperbarui saat sinkron)

## Fase 3 — akun & laporan

- [x] Akun: ubah email/password, slip gaji, privasi nominal, paginasi gaji & bon (5/halaman)
- [x] Akun: update profil (nama + URL avatar + password opsional) dan verifikasi password untuk membuka nominal
- [x] Report: filter tanggal, sort per kolom, cetak/unduh lewat PrintManager
- [x] Report: Overview dari koleksi `report` (omset, laba, pengeluaran, piutang, hutang, insight), rekalkulasi via API Laravel, hapus rekap lewat outbox
- [x] Penyamaan label/empty state/error tiap tab (pesan kosong per layar, label menu = web)
- [ ] Uji parity manual login nyata per layar + uji lapangan printer/barcode/offline

## Catatan implementasi Fase 2–3

- Media memakai kamera sistem + `FileProvider`; file diunggah `MediaUploader` setelah batch keuangan dikonfirmasi server (tabel `pending_media`, migrasi Room 1→2).
- Hapus produk wajib verifikasi password online (`SessionManager.verifyPassword`); hapus tetap dieksekusi batch atomik server.
- Cashflow dan bon menulis outbox + menyesuaikan saldo lokal; server menghitung ulang.
- Edit nota mempertahankan tanggal lama dan mengirim `atomic_expected`.
- Histori Kas: cari multi kata, mutasi masuk/keluar (transfer masuk dihitung untuk akun tujuan), dompet sumber/tujuan, rentang tanggal, jenis, paginasi 20.
- Akun: nominal gaji disembunyikan default seperti web; gaji & bon 5 baris per halaman.
- Report: sort kolom (tanggal, item/jenis/mekanik, qty/nominal) dan cetak/unduh PDF via print service Android.
- Produk: filter stok memakai `stok_3 <= min_3` (menipis) dan `stok_3 <= 0` (habis), sama dengan query web; +/- menulis `log_stock` ke outbox.
- Akun: nominal gaji/bon tersembunyi sampai password diverifikasi online, sama seperti web.
- Report: alamat API Laravel diambil dari `API_PUBLIC_URL` di file `datasource` (`BuildConfig.POS_API_URL`), dipakai hanya untuk rekalkulasi laporan.
- Sengaja beda dari web: riwayat gaji karyawan lain di halaman Person tidak dibuka di Android. Web menarik `gaji` per username tanpa verifikasi; `AGENTS.md` melarang melonggarkan privasi gaji, jadi hanya gaji milik akun login yang tampil di Akun.
- Bukti: unit 65/65, instrumented 57/57, release APK 2,5 MB, cold start 1155 ms di CPH2461.

## Aturan tetap

- Atomic ledger PocketBase dan receipt idempotensi tidak diubah.
- Hapus mengikuti aturan server; tidak ada pelonggaran.
- Gaji hanya untuk pemilik akun.
- Pengujian memakai data sintetis.
