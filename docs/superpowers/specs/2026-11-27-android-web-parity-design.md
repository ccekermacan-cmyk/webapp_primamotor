# Parity Android ↔ Web

Tanggal: 27-11-2026. Status: fase 1 selesai, fase 2–3 berjalan.

## Tujuan

Aplikasi Android memakai aturan, penamaan, urutan menu, field, dan alur yang sama dengan web
(`Frontend/src`). Server tetap sumber kebenaran; Android hanya cermin + antrean tulis.

## Keputusan

- **Bukan piksel identik.** Web responsif; Android mengikuti breakpoint dan pola yang sama
  (drawer, tab, kartu, tabel jadi kartu di HP). Label, field, aturan, dan data harus sama.
- **Tulis offline, media menunggu jaringan.** Semua input data masuk outbox. Unggah file
  (foto produk, bukti bayar) ditunda sampai online. Hapus tetap mengikuti aturan server.
- **Satu koleksi satu parser.** `dropdown` dipakai Person, Cashflow, Settings; `user` dipakai
  Person (Karyawan) dan login. Tidak ada skema lokal terpisah per layar.

## Peta halaman

| Web | Android | Status |
| --- | --- | --- |
| Kasir (`/`) | `TopRoute.POS` | sebagian: katalog, keranjang, tunai/tempo, cetak. Belum: tier harga, mekanik, cashback, admin, marketplace, media, edit/hapus |
| Produk (`/produk`) | `TopRoute.PRODUCTS` | sebagian: CRUD dasar. Belum: media, salin, hapus berpassword, tier realtime |
| Person (`/person`) | `TopRoute.PERSON` | fase 1: tab People/Customer/Supplier/Karyawan, cari, detail, tambah/ubah, hapus antre |
| Cashflow (`/cashflow`) | `TopRoute.CASHFLOW` | fase 1: Buku Kas & Saldo, Histori Kas, Jatuh Tempo. Belum: catat kas, bon, filter tanggal |
| Report (`/report`) | `TopRoute.REPORT` | fase 1: Overview, Menu (riwayat + pelunasan), Log Stock, Kas, Ongkos. Belum: filter tanggal, ekspor |
| Akun (`/akun`) | `TopRoute.ACCOUNT` | sebagian: profil, gaji, bon. Belum: ubah email/password, slip, paginasi |
| Settings (`/settings`) | `TopRoute.SETTINGS` | fase 1: master data per jenis/kategori, tambah/ubah/hapus antre, printer & sinkron |

Menu mengikuti aturan web: Settings hanya level 1; Report hanya level 1–6.

## Arsitektur tulis

1. UI mengubah Room + menambah satu `outbox` batch (create/update/delete).
2. `Pusher` mengirim batch atomik; sukses → `dirty = 0`.
3. Gagal ambigu → `resolve`; ditolak → `needs_review`, muncul di strip atas.
4. `Puller` menarik ulang koleksi penuh (produk, dropdown, user, gaji) dan jendela transaksi
   (nota/bon 180 hari, kas/stok/ongkos 30 hari).

## Yang belum (fase 2–3)

- POS penuh: harga tier, mekanik/ongkos, cashback, biaya admin, marketplace, media, edit/hapus.
- Produk: media, salin, hapus berpassword, stok realtime.
- Cashflow: catat kas, bon, filter tanggal/akun/jenis.
- Akun: ubah email/password, slip gaji, paginasi.
- Report: filter tanggal, ekspor, tabel sortable.
- Uji parity per layar: label, field, angka, dan alur.
