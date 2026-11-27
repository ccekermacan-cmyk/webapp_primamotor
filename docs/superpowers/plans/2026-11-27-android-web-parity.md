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
- [x] Cashflow: catat kas, bon karyawan, hapus dengan pembalikan saldo
- [x] Verifikasi payload vs `Frontend/src/services/posCheckout.ts`
- [ ] Cashflow: filter tanggal/akun/jenis di tab Histori (baru filter mutasi)
- [ ] Produk: stok realtime dari server (masih cache + mutasi lokal)

## Fase 3 — akun & laporan

- [x] Akun: ubah email/password, slip gaji
- [x] Report: filter tanggal, urutan naik/turun
- [ ] Akun: paginasi riwayat gaji
- [ ] Report: ekspor
- [ ] Penyamaan label/empty state/error seluruh layar
- [ ] Uji parity manual per layar + uji lapangan printer/barcode/offline

## Catatan implementasi Fase 2–3

- Media memakai kamera sistem + `FileProvider`; file diunggah `MediaUploader` setelah batch keuangan dikonfirmasi server (tabel `pending_media`, migrasi Room 1→2).
- Hapus produk wajib verifikasi password online (`SessionManager.verifyPassword`); hapus tetap dieksekusi batch atomik server.
- Cashflow dan bon menulis outbox + menyesuaikan saldo lokal; server menghitung ulang.
- Edit nota mempertahankan tanggal lama dan mengirim `atomic_expected`.
- Bukti: unit 54/54, instrumented 52/52, release APK 2,5 MB, cold start 1413 ms di CPH2461.

## Aturan tetap

- Atomic ledger PocketBase dan receipt idempotensi tidak diubah.
- Hapus mengikuti aturan server; tidak ada pelonggaran.
- Gaji hanya untuk pemilik akun.
- Pengujian memakai data sintetis.
