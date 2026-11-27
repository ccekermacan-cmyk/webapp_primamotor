# Desain: Aplikasi POS Android Native + Offline

Tanggal: 2026-11-27
Status: draf untuk persetujuan

## 1. Tujuan

Membuat aplikasi POS Android native untuk Prima Motor yang:

- memakai bahasa dan UI native (Kotlin + Jetpack Compose);
- menyimpan data lokal di SQLite (Room) agar operasional toko tetap jalan tanpa internet;
- menyinkronkan transaksi offline ke server begitu koneksi kembali;
- mendukung printer struk Bluetooth (ESC/POS);
- mendukung pemindaian barcode produk.

Server tetap menjadi sumber kebenaran untuk saldo, stok, hutang/piutang, dan laporan.

## 2. Non-goals

- Tidak menulis ulang ledger di server. Aturan atomic, receipt idempotensi, dan proteksi saldo/stok tetap seperti sekarang.
- Tidak mengganti PocketBase/Laravel.
- Tidak membuat aplikasi iOS.
- Tidak membuat mode offline untuk edit massal/impor produk.
- Tidak mengubah kebijakan akses: gaji tetap pribadi, hapus tetap dibatasi, administrasi level tetap level 1.

## 3. Anti-goals

- Dua sumber kebenaran untuk saldo/stok.
- Retry otomatis transaksi yang sudah ditolak server.
- Sinkronisasi diam-diam yang menimpa transaksi kasir tanpa jejak.
- Menyimpan salinan gaji semua karyawan di perangkat kasir biasa.

## 4. Constraint yang sudah ada

- Transaksi keuangan memakai batch PocketBase + hook `atomic_ledger.js`. Edit/hapus = balik nilai lama lalu terapkan nilai baru dalam satu transaksi.
- Idempotensi memakai `atomic_request_id` + receipt `_pm_atomic_requests`.
- Validasi stok/saldo memakai `expected_stock` dan `atomic_expected` dibandingkan di dalam transaksi server.
- Waktu laporan memakai zona Asia/Jakarta.
- ID record dibuat klien, 15 karakter `[a-z0-9]`.
- PocketBase dan Laravel memakai SQLite yang sama.
- `produk` belum punya field barcode; `id_lama` dipakai sebagai kode legacy.

## 5. Pendekatan yang dipertimbangkan

| Pendekatan | Bahasa | Offline | Hardware | Biaya | Keputusan |
| --- | --- | --- | --- | --- | --- |
| Capacitor hybrid | TS/React | Antrean saja | Plugin | Rendah | Tidak dipilih: user minta native dan SQL lokal |
| React Native | TS | Bisa | Library | Tinggi | Tidak dipilih: UI ditulis ulang juga, tetapi ekosistem SQL kurang matang untuk POS |
| Native Kotlin + Compose | Kotlin | Penuh | Native | Tinggi | **Dipilih** |
| Kotlin Multiplatform | Kotlin | Penuh | Native | Tinggi | Ditunda: belum perlu berbagi logika dengan web |

Alasan: user memilih native, butuh SQL lokal untuk sinkronisasi, kontrol penuh atas Bluetooth dan kamera, serta tidak ingin memelihara dua basis kode web.

## 6. Arsitektur aplikasi

Satu modul Gradle `:app` dengan paket terpisah. Modularisasi baru dilakukan kalau ukuran build menghambat; jangan bikin modul kosong.

```
app/
  data/
    local/      Room: entity, DAO, database, migrasi
    remote/     Klien PocketBase + Laravel (OkHttp + kotlinx.serialization)
    repo/       Repository per koleksi + cache-first
    sync/       Outbox, puller, konflik, WorkManager
    ledger/     Cermin ledger lokal (stok, saldo, bon, piutang)
  domain/
    model/      Model domain (uang, transaksi, produk, akun)
    usecase/    Checkout, edit, hapus, pelunasan, gaji
  ui/
    pos/ riwayat/ produk/ kas/ akun/ pengaturan/ laporan/ login/
    theme/ komponen/ navigasi/
  hardware/
    printer/    Bluetooth SPP + ESC/POS
    scanner/    Keyboard wedge + CameraX + ZXing core
  util/         Uang (BigDecimal), tanggal WIB, ID, validasi
```

Stack (dipilih yang paling ringan, bukan yang paling populer):

- Kotlin 2.x, Jetpack Compose (Material 3), Navigation Compose. Tanpa Hilt: satu `AppContainer` manual, karena hanya ada satu graph.
- Room + SQLite via KSP (bukan kapt). Tanpa SQLCipher; enkripsi perangkat + penyimpanan terenkripsi untuk token sudah cukup.
- HTTP: OkHttp + kotlinx.serialization langsung. Tanpa Retrofit, tanpa Ktor — dua-duanya lapisan tambahan di atas hal yang sama.
- WorkManager, satu periodic worker untuk sinkron.
- DataStore/EncryptedSharedPreferences untuk sesi.
- Scanner: keyboard wedge dulu (scanner gun USB/Bluetooth), kamera hanya jika perlu, memakai CameraX + ZXing core (±0,6 MB) bukan ML Kit bundled (±2,5 MB + native per ABI).
- ESC/POS: builder sendiri ±200 baris (init, align, bold, ukuran, feed, cut). Tanpa library printer.
- Grafik laporan: Compose Canvas sederhana, tanpa library chart.
- Foto produk: tidak diunduh untuk cache offline; grid memakai inisial/placeholder. Cache gambar ditunda sampai ada bukti perlu.

## 6a. Anggaran ukuran & kecepatan

Target yang dipatok, diukur di Task 1 dan Task 20:

- APK release `arm64-v8a` (split per ABI): ≤ 12 MB.
- Cold start di perangkat uji: ≤ 2 detik (`adb shell am start -W`).
- Pindah tab dan buka keranjang: tanpa jeda terasa (< 100 ms render).
- Query Room POS (hari ini + 30 hari) < 50 ms.
- Tidak ada dependency baru tanpa alasan yang dibuktikan di PR.

Cara mencapainya: R8 full mode + `shrinkResources` di release, split per ABI, tanpa library DI, tanpa library chart, tanpa cache gambar, tanpa SQLCipher, model scanner tunggal.

## 7. Data lokal (Room)

Tabel cermin koleksi server: `menu`, `cashflow`, `log_stock`, `ongkos`, `bon`, `gaji`, `produk`, `dropdown`, `user`, `report`. Tiap baris punya kolom lokal `sync_dirty` (0/1) dan `sync_state_id` (kaitan ke outbox).

Tambahan tabel lokal:

- `outbox` — satu baris per transaksi offline: `request_id`, `payload_json`, `created_at`, `status` (`pending`, `sending`, `failed`, `needs_review`), `attempts`, `last_error`.
- `outbox_operation` — urutan operasi per transaksi (collection, method, record_id, payload).
- `sync_state` — kursor per koleksi, waktu sinkron terakhir, status.
- `conflict` — transaksi yang ditolak server beserta alasan dan pilihan pengguna.

Setiap transaksi offline ditulis ke Room dalam satu `@Transaction`: record bisnis + outbox. UI membaca dari Room saja, bukan langsung dari jaringan.

## 8. Cermin ledger lokal

Aturan efek harus sama dengan `atomic_ledger.js`:

- `cashflow`: saldo akun berubah sesuai `nominal`/`mutasi`; transfer memindahkan dana; kasbon membuat baris `bon`.
- `log_stock`: `stok_3` naik/turun sesuai `boolean`/`qty`.
- `bon`: `jenis=out` menambah hutang, `in` mengurangi hutang; berlaku ke `dropdown.number_1` dan `user.number`.
- Hapus menu: cascade ke `log_stock`, `ongkos`, `cashflow`, `bon`, `gaji`.

Mitigasi penyimpangan:

- Cermin lokal hanya untuk tampilan dan pencegahan dini. Setelah sinkron, nilai otoritatif server menimpa Room.
- Uji paritas: fixture transaksi yang sama dijalankan ke `LocalLedger` (Kotlin) dan ke server (tes integrasi Python), lalu stok/saldo dibandingkan.
- Jangan menghitung laporan harian di perangkat. `report` dibaca dari server; saat offline diberi label "data terakhir".

## 9. Protokol sinkronisasi

Urutan saat aplikasi online: **push dulu, lalu pull**.

### Push (outbox)

1. Ambil outbox tertua berstatus `pending`.
2. Kirim sebagai batch PocketBase dengan `atomic_request_id` = `request_id` yang tersimpan. Payload identik dengan versi web: operasi create/update/delete + `atomic_expected`/`expected_stock`.
3. Sukses: tandai `done`, perbarui Room dengan record hasil server.
4. Respons hilang/timeout: panggil `/api/financial/requests/{id}/resolve`. Jika `committed`, anggap sukses. Jika `cancelled`, tandai gagal dan tampilkan konflik.
5. Ditolak validasi (stok/saldo/stale): tandai `needs_review`, **jangan retry otomatis**. Tampilkan layar keputusan: sesuaikan lalu kirim ulang, atau batalkan (efek lokal dibalik).
6. Jangan pernah mengirim transaksi berikutnya sebelum yang di depan selesai, agar efek berurutan.

### Pull

- Referensi kecil (`produk`, `dropdown`, `user`, `gaji`): tarik penuh saat login dan saat data berubah.
- Finansial: ganti jendela per hari. Untuk hari yang tersentuh (hari ini + 30 hari terakhir + semua nota `belum`/tempo):
  1. tarik `menu` pada jendela itu;
  2. tarik anak (`log_stock`, `cashflow`, `ongkos`, `bon`) berdasarkan `ref`/`ref_baru`;
  3. hapus baris lokal di jendela yang tidak ada di respons, **kecuali** baris ber-`sync_dirty=1` atau yang menjadi bagian outbox — baris offline belum ada di server dan harus dipertahankan;
  4. setelah push sukses, bersihkan `sync_dirty` sesuai record hasil server.
- `report`: tarik per tanggal yang tersentuh.

Catatan yang sudah diputuskan dari kode yang ada:

- Laporan dihitung oleh hook ledger di server; aplikasi Android tidak memanggil `/reports/recalculate` setelah push, cukup pull ulang `report` tanggal terkait.
- Nomor nota yang tercetak adalah ID record 15 karakter (sama dengan web); tidak ada urutan nota terpisah yang perlu dialokasikan.
- Gambar produk: tidak di-cache offline. Grid POS memakai placeholder inisial (warna dari nama). Thumbnail hanya dimuat saat online dan tidak disimpan ke disk.
- Jika perangkat offline melewati batas jendela (misal > 30 hari), lakukan resync penuh untuk jendela yang diperluas.
- Pull terjadi saat login, saat app foreground, setiap 15 menit lewat WorkManager, dan lewat tombol refresh manual. PB realtime (SSE) opsional di fase lanjut; jangan dijadikan ketergantungan.
- **Waktu transaksi:** memakai waktu perangkat, dikirim sebagai `created_at` seperti web. Jika selisih dengan waktu respons server lebih dari 5 menit, tampilkan peringatan drift; tanggal laporan tetap dihitung di zona Asia/Jakarta dari nilai tersimpan.

### Konflik

- Stok/ saldo berubah di perangkat lain: replay ditolak server; kasir melihat selisih lokal vs server dan memutuskan.
- Edit master data bersamaan: server menang (last write), klien menyegarkan.
- Klien tidak pernah menimpa nilai server secara lokal tanpa lewat batch.

## 10. Perubahan server yang dibutuhkan

1. **Field `barcode` di `produk`** (migrasi tambahan, teks, opsional). Backfill dari `id_lama`; barcode baru diisi lewat UI produk. Urutan pencarian scanner: `barcode` → `id_lama` → nama.
2. **Konfirmasi batch API aktif** di PocketBase produksi (`batch.enabled`, batas ukuran), sama seperti tes integrasi.
3. **CORS tidak perlu** untuk aplikasi native; klien HTTP langsung.
4. **Endpoint sinkron**: fase pertama tidak perlu endpoint baru (pull memakai REST + filter). Endpoint `/api/sync/changes` berbasis `_pm_atomic_changes` hanya ditambahkan jika pull jendela terbukti kurang.
5. **Retensi jurnal** saat ini 30 hari. Jika kelak memakai feed jurnal untuk sync, naikkan retensi atau pisahkan tabel feed.

## 11. Pemetaan fitur web → Android

| Web | Android |
| --- | --- |
| `pos.tsx`, `PosCartModal`, `CheckoutReviewModal` | `PosScreen`, `CartSheet`, `CheckoutScreen` |
| `PosFilterBar`, `PosContentFeed` | Search + filter chip + grid produk |
| `ReceiptPrintModal` | Template struk ESC/POS |
| `posHistoryActions`, `QuickSettleModal` | Riwayat + pelunasan |
| `produk.tsx`, `ProductFormModal` | Produk + form + scanner barcode |
| `cashflow.tsx` | Kas: riwayat, tempo, akun |
| `person.tsx` | Pelanggan/supplier/mekanik |
| `akun.tsx`, `AccountSalarySection` | Akun: profil, gaji pribadi, bon |
| `settings.tsx` | Pengaturan |
| `report.tsx` | Laporan (grafik Compose) |
| `login.tsx` | Login + refresh sesi |

Navigasi: bottom bar `POS`, `Riwayat`, `Produk`, `Kas`, `Akun`; pengaturan dan laporan lewat menu. Tablet memakai layout dua panel.

Logika yang diporting sebagai unit test Kotlin: format uang id-ID, validasi POS, aturan status/dibayar, `settlementRemaining`, pembuatan ID, filter histori akun, ringkasan pinjaman, formula gaji.

## 12. Hardware

### Printer Bluetooth

- Bluetooth Classic SPP (printer 58/80 mm umum). Pairing lewat pengaturan Android; aplikasi menyimpan MAC.
- Perintah ESC/POS: init, align, bold, ukuran, potong kertas, feed.
- Struk: nama toko, nomor nota, waktu WIB, item, qty, harga, total, bayar, kembali, mekanik, footer.
- Tangani printer mati/kertas habis: tampilkan status, jangan gagalkan transaksi (cetak ulang tersedia).
- Dukungan USB OTG dan printer network ditunda.

### Scanner barcode

- CameraX + ZXing core, mode kontinu di layar POS (hanya dimuat saat layar scanner dibuka).
- Barcode tak dikenal: tawarkan cari nama / tambah produk.
- Handheld scanner USB/Bluetooth mode keyboard: tangkap input ke field pencarian (tanpa kamera).

## 13. Keamanan & privasi

- Token sesi di EncryptedSharedPreferences; refresh seperti web.
- Aturan baca gaji tetap di server. Perangkat non-level-1 tidak pernah menerima gaji karyawan lain.
- Cache gaji: hanya milik pengguna yang login; jika perangkat dipakai bergantian, hapus cache gaji saat logout.
- Room berisi data bisnis; enkripsi perangkat wajib aktif. SQLCipher tidak dipakai (menambah ±5 MB native dan biaya I/O); kalau kelak perlu, tambahkan setelah cache gaji terverifikasi.
- Logout tidak menghapus outbox, sama seperti `prima_atomic_pending` di web.

## 14. Rilis

- Fase awal: APK langsung / MDM untuk perangkat toko. Menghindari review Play Store dan cocok untuk distribusi internal.
- Play Store menyusul: AAB bertanda tangan, target SDK terbaru, kebijakan privasi, formulir data safety.
- Min SDK 26 (Android 8) untuk perangkat lama; target SDK mengikuti syarat Play.
- Mode kiosk/auto-start opsional lewat Android Enterprise, bukan fitur wajib.

## 15. Rencana tes

- Unit: uang, tanggal WIB, validasi, ID, formula gaji, ringkasan pinjaman, aturan status.
- Room: DAO + transaksi outbox (in-memory).
- Sync: MockWebServer untuk push/pull, receipt hilang, penolakan stok, urutan outbox.
- Paritas ledger: fixture Kotlin vs tes integrasi server.
- UI: Compose test alur checkout, edit, hapus, pelunasan.
- Perangkat: printer Bluetooth nyata, barcode cetak, mode pesawat → transaksi → online → sinkron.
- Regresi server: tes frontend/backend/integrasi yang ada harus tetap hijau.

## 16. Tahapan dan estimasi

| Fase | Isi | Estimasi |
| --- | --- | --- |
| 0. Spike | Shell Compose + login PB + Room + satu transaksi offline → sync + cetak satu struk | 3-5 hari |
| 1. Fondasi | Skema Room, repository, cermin ledger, outbox, pull/push, WorkManager | 1,5-2 minggu |
| 2. POS inti | Katalog, keranjang, checkout, edit/hapus, pelunasan | 2 minggu |
| 3. Master & kas | Produk + barcode, kas, pelanggan, laporan baca | 1,5 minggu |
| 4. Akun & hardware | Login/profil/gaji pribadi, printer, scanner, konflik UI | 1,5 minggu |
| 5. Stabilisasi | Paritas ledger, tes perangkat, perbaikan, rilis APK | 1-1,5 minggu |

Total realistis: 7-9 minggu untuk satu developer berpengalaman. Ini proyek besar, bukan pekerjaan beberapa hari.

## 17. Risiko utama

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Ledger lokal berbeda dari server | Stok/saldo tampil salah saat offline | Paritas fixture, server menimpa setelah sync, uji dua arah |
| Dua perangkat menjual stok terakhir | Transaksi kedua ditolak | Status `needs_review`, keputusan kasir, tanpa retry otomatis |
| Printer murah tidak kompatibel | Struk tidak tercetak | Spike printer di fase 0, dukung ESC/POS generik |
| Barcode belum ada di produk | Scanner tidak menemukan produk | Migrasi `barcode` + backfill `id_lama` |
| Data lama di luar jendela pull | Riwayat tampak kosong | Resync penuh otomatis saat jendela terlampaui |
| Play Store review | Rilis tertunda | APK/MDM lebih dulu |

## 18. Yang diserahkan ke builder

- Nama paket, ikon, tema visual.
- Urutan pengerjaan dalam fase (boleh dipecah per modul).

Sudah diputuskan dan tidak lagi diserahkan: OkHttp (bukan Ktor/Retrofit), ZXing core (bukan ML Kit), ESC/POS builder sendiri, tanpa SQLCipher, tanpa Hilt, tanpa library chart.

## 19. Persiapan environment (dari pemeriksaan mesin 2026-11-27)

Mesin: Ubuntu/Mint, 4 core, RAM 23 GB, disk 216 GB bebas. CPU tidak punya vmx/svm → emulator Android **tidak bisa jalan**. Target uji hanya perangkat fisik via USB.

1. **Perangkat lunak komputer (tanpa Android Studio)**
   - JDK 17: `sudo apt install openjdk-17-jdk`.
   - Command line tools saja: unduh `https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip`, ekstrak ke `~/android-sdk/cmdline-tools/latest`.
   - Pasang paket SDK: `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"` lalu `yes | sdkmanager --licenses`.
   - Set `ANDROID_HOME=~/android-sdk`; `export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH`.
   - Gradle tidak dipasang global sebagai default; pakai wrapper yang di-commit. Cara membuatnya sekali: unduh Gradle 8.x, `gradle wrapper --gradle-version 8.9` di `Android/`, setelah itu semua build lewat `./gradlew`.
   - Editor: VSCodium (sudah terpasang) atau IntelliJ IDEA Community. Tidak ada Compose Preview/Layout Editor; iterasi UI memakai `scrcpy` + `adb exec-out screencap`.
   - Aturan udev untuk akses `adb` tanpa root: jalankan `sudo curl -fsSL https://raw.githubusercontent.com/M0Rf30/android-udev-rules/main/51-android.rules -o /etc/udev/rules.d/51-android.rules && sudo udevadm control --reload-rules && sudo udevadm trigger`. Tanpa ini `adb devices` tidak akan melihat HP.
   - Hemat disk: ±300 MB (SDK CLI + Gradle) vs ±4 GB Android Studio.

2. **Perangkat fisik**
   - Satu HP/tablet Android 11+ (API 30). Mirror layar cukup `scrcpy` (`sudo apt install scrcpy`), tidak butuh Android Studio.
   - Kabel USB data (jangan kabel charging-only). Port USB komputer harus 3.0+.
   - Colokan charger: saat develop, HP tetap diisi daya.
   - USB debugging aktif: *Settings → Developer options → USB debugging*. Di Android 11+ ada *Disable USB debugging authorization timeout* agar tidak minta izin tiap hari.
   - Printer thermal Bluetooth ESC/POS 58 mm (merek dan protokol dicatat untuk fase 0).
   - Opsional: scanner handheld USB/Bluetooth mode keyboard. Kalau toko sudah punya, fase 0 tidak perlu kamera.
   - Perangkat kedua opsional: uji konflik bisa dilakukan lewat tes integrasi server dengan dua akun berbeda.

3. **Server uji (bukan produksi)**
   - PocketBase staging dengan `batch.enabled = true`, skema sama dengan produksi.
   - Laravel API jalan dan dapat diakses dari perangkat (HTTPS domain, atau HTTP di jaringan lokal khusus debug build dengan `network_security_config.xml`).
   - Superuser PocketBase untuk migrasi `barcode`.
   - Akun uji level 1 dan level 2/10; produk, akun kas, dan menu sintetis.
   - SMTP lokal hanya jika menguji perubahan email.

4. **Perubahan repo**
   - Direktori `Android/` (proyek Gradle); `.gitignore` untuk `build/`, `.gradle/`, `local.properties`, keystore.
   - Base URL dibaca dari `datasource` saat build (debug/staging/release), bukan hardcode.
   - Keystore rilis di luar repo; Play Console hanya jika lewat Play Store.

5. **Data & alur uji**
   - Field `barcode` di produk + backfill `id_lama`.
   - Fixture transaksi untuk uji paritas ledger (sama dengan tes integrasi server).

6. **Alat verifikasi**
   - `adb install`, `adb logcat`, `adb shell am start -W` (ukur cold start).
   - Gradle `assembleRelease` + `testDebugUnitTest` + `connectedDebugAndroidTest`.
   - Android Lint + R8 full mode + `checkReleaseBuilds`.
   - `scrcpy` opsional (mirror layar tanpa Device Mirroring).
   - MockWebServer untuk uji sync tanpa server nyata.

7. **Urutan persiapan**
   - Pasang JDK + SDK CLI, pasang udev rules, sambungkan HP, verifikasi `adb devices` (satu device terbaca).
   - Install `scrcpy` (opsional) lewat `sudo apt install scrcpy`.
   - Buat instance PocketBase staging dan migrasi `barcode`.
   - Build `./gradlew :app:assembleDebug` dari proyek Task 1; `adb install` ke HP.
   - Baru mulai fase 0 spike.

## 20. Pertanyaan terbuka (keputusan produk)

Desain ini memakai default berikut. Ubah jika operasional toko berbeda:

1. **Login offline:** sesi tersimpan dipakai setelah reboot tanpa internet; login pertama tetap online. Ganti ke PIN lokal jika perangkat sering mati saat internet mati.
2. **Stok/saldo lokal tidak cukup:** diblokir keras saat offline; server tetap otoritatif saat sync.
3. **Perangkat dipakai bergantian:** outbox milik pengguna yang membuatnya; pengguna lain tidak bisa login sampai outbox pemiliknya kosong atau dibatalkan oleh admin.
4. **Cakupan admin di Android:** hanya profil dan gaji pribadi; kelola pengguna tetap dari web.
5. **Jalan berdampingan:** web tetap produksi selama transisi; konflik multi-perangkat ditangani lewat status `needs_review`.
6. **Perangkat fase 0:** gunakan satu tablet/HP fisik yang tersedia; printer dan scanner menyusul di fase 4 jika belum ada.

Catatan: default nomor 3 paling berisiko untuk operasional. Jika toko memakai satu perangkat bersama, ubah sebelum eksekusi.