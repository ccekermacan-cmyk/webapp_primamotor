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

- [ ] POS: harga tier, mekanik + ongkos, cashback, biaya admin, marketplace, media
- [ ] POS: edit/hapus nota dengan pembalikan efek
- [ ] Produk: media, salin, hapus berpassword, stok realtime
- [ ] Cashflow: catat kas, bon, filter tanggal/akun/jenis
- [ ] Verifikasi payload vs `Frontend/src/services/posCheckout.ts`

## Fase 3 — akun & laporan

- [ ] Akun: ubah email/password, slip gaji, paginasi
- [ ] Report: filter tanggal, tabel sortable, ekspor
- [ ] Penyamaan label/empty state/error seluruh layar
- [ ] Uji parity manual per layar + uji lapangan printer/barcode/offline

## Aturan tetap

- Atomic ledger PocketBase dan receipt idempotensi tidak diubah.
- Hapus mengikuti aturan server; tidak ada pelonggaran.
- Gaji hanya untuk pemilik akun.
- Pengujian memakai data sintetis.
