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

## Fase 4 — rombak Kasir 1:1 web

- [x] Nav tab dinamis dari `dropdown` (`kategori ~ menu && jenis ~ jenis menu`), default `Overview`, level 10 hanya `Overview`
- [x] Menu Overview = riwayat nota dikelompokkan per tanggal `dd/MM/yyyy`; menu mengandung `gaji` = daftar slip; menu lain = katalog produk
- [x] Filter Overview: status (semua/lunas/belum), person (`id_lama`/`id`/`text_1`), jenis multi, cari multi kata (termasuk `log_stock`/`ongkos` lewat `ref_baru`), paginasi 6/9/12 per breakpoint
- [x] Filter produk: `stok_3 > 0` kecuali pembelian/rusak/opname, cari multi kata atas kode/kategori/merk/jenis/keterangan/varian/tipe/barcode, urut `-created`
- [x] Kartu produk: kode 5 digit, label `getFullLabel`, pill stok, harga `sell_6`; kartu riwayat: badge jenis/status, operator, kutipan nota, total/sisa, qty, `Pelunasan Cepat`
- [x] Detail nota 3 tab (Ringkasan / Barang & jasa / Pembayaran): laba kotor + margin hanya level 1, saldo jurnal level 1/2/5, tombol Hapus / Pelunasan / Edit / Cetak / Bagikan / Tutup
- [x] Review checkout (`CheckoutReviewModal`) sebelum simpan: status nota (termasuk `BELUM (Menunggu Bukti Media)`), total/dibayar/sisa, ubah tab, rincian, simpan
- [x] Keranjang 3 tab: Barang & jasa / Pembayaran / Catatan, tombol `Periksa transaksi`
- [x] Struk dari `state.savedReceipt` (bukan keranjang kosong) dan cetak ulang dari detail nota
- [x] Pindah menu dengan keranjang isi meminta konfirmasi `Batalkan Transaksi?`
- [x] Edit nota memakai jenis dari `menu.jenis`, catatan dari cashflow, jumlah bukti lama dihitung agar pembelian tidak turun ke `belum`
- [x] Unit 76/76, instrumented 57/57, release APK 2,7 MB, cold start 1091 ms (CPH2461)
- [ ] Belum diport: galeri media di detail nota (butuh pemuat bitmap ber-autentikasi, tanpa image loader)
- [ ] Belum diport: pembuatan slip gaji POS (batch `saveGajiBatch`: menu `gaji`, baris `gaji`, bon `cashflow`); daftar slip hanya baca

## Fase 5 — Produk 1:1 web

- [x] Header `Manajemen Produk` + `Total N produk terdaftar`; tombol tambah di header (lebar) dan FAB (sempit)
- [x] Pencarian multi kata AND atas `id_lama, kategori, merk, jenis, varian, keterangan, tipe` + kode numerik exact
- [x] Grid/List + urutan kolom (kode, nama, stok, harga pelanggan, harga retail) dengan arah asc/desc
- [x] Filter kategori exact + stok `menipis` (`stok_3 <= stok_2 && stok_3 > 0`) dan `habis` (`stok_3 <= 0`), panel filter khusus layar sempit
- [x] perPage mengikuti breakpoint kolom×6: `<640→12`, `<768→18`, `<1024→24`, `<1280→30`, else 36; ganti perPage reset halaman 1
- [x] Kartu: kode 5 digit (`displayCode`), nama `kategori merk jenis varian keterangan tipe`, badge HABIS/MENIPIS, stok + satuan, harga retail, margin kartu level 1/2/5/6, tombol Edit/Salin/Hapus, stok cepat +/-
- [x] Detail: gambar + navigasi lampiran, salin nama, skema tier (min/sell/profit), riwayat `log_stock` per 5 baris, produk terkait (skor Levenshtein), aksi Edit/Salin/Hapus/Tutup
- [x] Form: `id_lama` 5 digit nonaktif saat edit, satuan `pcs`/`m`, tipe chip, validasi `kategori/merk/unit wajib diisi.`, `... harus bilangan bulat nol atau lebih.`, `Harga retail harus lebih dari nol.`
- [x] Stok hanya lewat `log_stock`: create `stok_3=0` + log masuk, edit diff + `expected_stock`, satu request outbox atomik
- [x] Salin: `id_lama` acak, `stok_1`/`stok_3` nol, `stok_2` ikut, foto tidak ikut; hapus hanya level 1 + `permissions/delete` + verifikasi password
- [x] Pemuat gambar minimal (OkHttp + BitmapFactory + cache memori) untuk thumbnail/detail/lampiran, fallback teks saat offline
- [x] Unit 87/87, instrumented 62/62, release APK 2,79 MB, cold start 502–1052 ms (CPH2461)

## Fase 6 — Settings 1:1 web

- [x] Hanya level 1 membuka halaman; master data satu koleksi `dropdown`
- [x] Pill jenis: `Semua Jenis (N)` + `{JENIS} ({count})` dari seluruh data, bukan hasil cari
- [x] Cari `Cari jenis, kategori, atau label master data...` atas jenis/kategori/text_1, AND dengan pill
- [x] Kartu per jenis lalu per kategori, badge `N Item`, tombol tambah per jenis
- [x] Baris item: label + text_2, badge `number_1` (Rupiah untuk cashflow/akun), Detail/Edit/Hapus (`id_lama != umum1` + `permissions/delete`)
- [x] Form 3 tab (Utama / Nilai & Extra / Enum & Akses) dengan label dinamis `getFieldLabel` dan combobox jenis/kategori
- [x] Detail: jenis • kategori, text_2, number_1, alamat, telepon, visibilitas (chip level, kosong = `Global (Semua Level)`), Edit/Hapus/Tutup
- [x] Hapus tanpa password; dialek hasil `Tersimpan` / `Berhasil Dihapus` / `Kendala: ...`
- [x] `id_lama` dibuat unik saat create (web mengirim kosong dan menabrak unique index), `phone` numerik, enum CSV dinormalisasi trim
- [x] Printer & sinkron tetap tersedia dari halaman Settings native sebagai tambahan
- [ ] Belum diport: penjagaan stale `number_1` non-level-1 (`financialPatch` butuh `getOne` server) — native memakai outbox
- [ ] Belum diport: dialog hasil bergaya `Modal` web (native memakai `AlertDialog`)

## Fase 7 — Cashflow 1:1 web

Sumber: `Frontend/src/pages/cashflow.tsx` + `Frontend/src/components/cashflow/*`. Urutan task dieksekusi satu per satu; tiap task harus kompilasi dan tesnya hijau sebelum lanjut.

### Task 1 — `domain/CashflowFeed.kt`

- [x] `HistoryFilter(terms, mutasi, accountIds, jenisKeys, from, to)` + `apply(rows)`: istilah pencarian AND atas `ref, note, persontext, jenis`; mutasi `masuk` mencakup transfer masuk lewat `account_2` tanpa `account_1`; `keluar` hanya `account_1`; `semua` = `account_1 || account_2`; tanggal inklusif WIB; jenis `id_lama || id`
- [x] `groupByDate(rows)` -> `List<Pair<String, List<CashflowRow>>>` urut `-created_at`, label `dd MMMM yyyy` id-ID, kosong = `Tanpa Tanggal`
- [x] `shortCode(row)` = 6 karakter terakhir `id`, fallback `ref`; `sign(row)` = `↔` transfer, `+` masuk, `-` keluar; `signed(row)` BigDecimal
- [x] `editableBalance(balance, row)` = saldo + nominal lama saat edit (hanya bila baris akun sumber sama)
- [x] `accountsBySubtab` (`kas`, `customer`, `supplier`, `karyawan`) dari `dropdown`; `subtotal`; pisah saldo `> 0` dan `<= 0`
- [x] `tempoGroups(menus)`: filter `jenis ~ pembelian`, `status = belum`, `tempo != ""`; grup per tanggal tempo, urut tanggal naik dengan grup `>= hari ini` lebih dulu; `dayText` (`Lewat n Hari` / `Jatuh Tempo Hari Ini` / `Sisa n Hari`), `progressPercent`, `remaining`, status `TERLAMBAT` / `MENUNGGU PELUNASAN`
- [x] `clockLabel` (`HH:mm`), `dateTimeLabel`, `rupiah` lewat `Money.formatRupiah`
- [x] Tes `CashflowFeedTest` untuk tiap aturan di atas

### Task 2 — model + parser + puller

- [x] `MenuRow.tempo`; `BonRow.refCashflow`, `refGaji`, `persontext`; `CashflowRow.files`, `acc1`, `acc2`
- [x] Parser `Repositories` mengisi field baru; `RepositoriesTest` menyesuaikan
- [x] `Puller`: `cashflow` jendela 90 hari; tarik tambahan `menu` `jenis ~ pembelian && status = belum && tempo != ""` tanpa batas tanggal (di luar `deleteMissing`)
- [x] `MediaImages.url(collection, id, file, thumb)` untuk lampiran `cashflow`/`bon`

### Task 3 — `CashflowRepository`

- [x] `CashDraft` lengkap (jenis transfer, `account2Id`, `personId`, `personText`, `media`, `createdAtIso`) + `save(draft, operator, previous)` untuk create dan edit; edit menyertakan `atomic_expected` snapshot baris lama (server menolak bila berubah)
- [x] Validasi urutan web: `Jenis Cashflow wajib dipilih!`, `Akun Pembayaran wajib dipilih!`, `Nominal harus diisi dan lebih dari 0!`, `Keterangan wajib diisi!`, `Akun tujuan transfer harus berbeda dari akun sumber!`, `Saldo tidak cukup! Saldo saat ini: {saldo}, dibutuhkan: {nominal}`
- [x] Bon dengan `catatCashflow`: satu tulisan `cashflow` saja (server membuat bon otomatis, `atomic_ledger.js:104-109`), sehingga duplikasi bon web tidak dibawa; tanpa cashflow tetap tulis `bon`
- [x] Hapus: cashflow reverts saldo lokal; bon dengan `ref_gaji` ditolak `Ubah atau hapus melalui transaksi gaji agar perhitungan slip dan pembayaran tetap konsisten.`; bon dengan `ref_cashflow` dihapus lewat cashflow induk
- [x] Tes `CashflowRepositoryTest` untuk create, edit `atomic_expected`, transfer, bon satu jalur, tolak hapus bon gaji

### Task 4 — `CashflowViewModel`

- [x] State web: `activeTab` (`history` default), `activeAccountTab`, filter (`mutasi`, akun, jenis, tanggal, search debounce 250 ms), `page` 1, `perPage` 20, `showZeroBalances`, `selectedTx`, `modalType`, `formData`, `formDataBon`, `files`, `isProcessing`, `systemAlert`
- [x] Turunan: `wallets` (akun kas + person customer/supplier + user aktif), `walletsMap`, `availableJenisOptions`, `jenisOptionsIn/Out` dari `text_2`, `configBon` (`dropdown.id_lama = addbon`), `groupedTransactions`, `tempoGroups`
- [x] Aksi: buka/tutup form, ganti mutasi dengan konfirmasi `Ubah Jenis Mutasi?`, tutup form kotor `Tutup Form?`, simpan, hapus dengan cek `permissions/delete`, `HITUNG ULANG` (online-only, satu batch `recalculate_person`), buka riwayat bon per karyawan

### Task 5 — layar + tab Histori

- [x] Header `Arus Kas` / `Monitoring perputaran modal Prima Motor`, tombol `TAMBAH BON` + `CATAT TRANSAKSI KAS` (lebar), FAB `+ BON` + bulat `Catat Kas Baru` (sempit)
- [x] Tab `Buku Kas & Saldo`, `Histori Kas`, `Jatuh Tempo` (level 1/2/5/6)
- [x] Bar filter sticky: chip `semua|masuk|keluar`, panel akun/jenis/tanggal/cari, dialog `Filter Riwayat Kas` untuk layar sempit
- [x] Baris: grup tanggal, kode 6 karakter, chip jenis, catatan, pihak, akun sumber → tujuan, operator, nominal bertanda, jam, `TRANSFER`, `Saldo Akhir` level 1/2/5
- [x] Paginasi `Hal. x / y`, kosong `Belum ada data transaksi kas ditemukan.`

### Task 6 — tab Buku Kas & Saldo + Jatuh Tempo

- [x] Subtab `Kas & Bank`, `Piutang Customer`, `Hutang Supplier`, `Bon Karyawan`; `HITUNG ULANG` hanya customer/supplier
- [x] Kartu dompet: inisial/gambar, badge jenis, nama, saldo; subtotal; daftar saldo `<= 0` bisa disembunyikan; klik kas = filter histori, customer/supplier = buka histori person, karyawan = riwayat bon
- [x] Jatuh Tempo: 3 kartu metrik (`Lewat Jatuh Tempo`, `Akan Jatuh Tempo`, `Total Sisa Tagihan`), kartu item (kode, status, progress, terbayar, sisa), footer `Tampil x / y`, subtotal halaman, paginasi 10

### Task 7 — dialog

- [x] Detail `Detail Log Transaksi Kas`: badge arah, nominal bertanda, ID/waktu/operator, entitas jurnal, saldo hanya level 1/2/5, catatan, bukti media, tombol hapus (cek `permissions/delete`), `Edit Transaksi`, `TUTUP DETAIL`
- [x] Form kas `Catat Transaksi Kas Baru` / `Revisi Transaksi Kas`: toggle `KAS MASUK`/`KAS KELUAR`, tanggal-waktu, jenis per arah, akun sumber + saldo, akun tujuan saat transfer, pihak saat bon keluar, nominal + terbilang, catatan, lampiran
- [x] Form bon `Tambah Bon Karyawan`: checkbox `Catat ke Cashflow`, karyawan, akun asal, nominal, catatan, lampiran
- [x] Riwayat bon `Riwayat Bon: {nama}`: total saldo bon, tabel waktu/jenis/nominal/keterangan, hapus hanya level 1

### Task 8 — verifikasi

- [x] Unit + instrumented hijau; APK release ≤ 12 MB; cold start ≤ 2000 ms; commit + push `feat/android-native`
- [x] Catat deviasi: edit kas tetap lewat outbox dengan `atomic_expected` (server yang menolak bila basi), `HITUNG ULANG` online-only, riwayat bon baru muncul setelah sinkron saat bon dicatat bersama kas
