# Prima Motor POS Android

Aplikasi POS native (Kotlin + Compose) untuk kasir toko. Server tetap sumber kebenaran;
aplikasi menyimpan salinan lokal, menerima transaksi saat offline, lalu mengirim lewat outbox
atomik yang sama dengan web.

## Anggaran yang dipatok

| Ukuran | Batas | Terukur (28-11-2026) |
| --- | --- | --- |
| APK rilis `arm64-v8a` | ≤ 12 MB | 2,9 MB |
| Cold start (`am start -W`, HP CPH2461) | ≤ 2000 ms | 424–874 ms |
| Unit test | lulus semua | 117/117 |
| Instrumented test | lulus semua | 84/84 |

Naikkan anggaran hanya lewat keputusan sadar; jangan menambah library yang bisa diganti stdlib.

### Library pihak ketiga dan alasannya

| Library | Dipakai untuk | Kenapa bukan stdlib |
| --- | --- | --- |
| Coil | foto produk, bukti kasflow, gambar person | cache memori + disk, decode sesuai ukuran slot, batal saat scroll |
| Vico | grafik tren Report | sumbu, skala, tooltip; Canvas manual tidak punya interaksi |
| FastExcel | ekspor `.xlsx` halaman Report | menulis OOXML valid tanpa Apache POI (~12 MB) |

OkHttp, Room, WorkManager, ZXing, dan ESC/POS tetap seperti semula; tidak ada Hilt/Koin, Ktor,
DataStore, atau ML Kit karena yang ada sudah cukup dan lebih ringan.

## Prasyarat tanpa Android Studio

```sh
./scripts/android-env.sh          # JDK 17 + Android SDK di $HOME, idempoten
sudo apt install scrcpy           # mirror layar, butuh root
```

Udev untuk adb (butuh root, sekali):

```sh
sudo curl -fsSL https://raw.githubusercontent.com/M0Rf30/android-udev-rules/main/51-android.rules \
  -o /etc/udev/rules.d/51-android.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
adb kill-server
```

`Android/local.properties` berisi `sdk.dir`; file itu tidak masuk git.

## Alamat server

Alamat dibaca saat build dari `datasource` di root repo (`PB_PUBLIC_URL`) dan ditanam sebagai
`BuildConfig.POS_BASE_URL`. Jangan menaruh alamat produksi di kode atau file .env frontend.

- Ganti server: ubah `PB_PUBLIC_URL` di `datasource`, lalu build ulang. Tidak ada perubahan kode.
- Build ke server lain tanpa mengubah file: `./gradlew :app:assembleDebug -PposBaseUrl=https://staging.example/api`.
- Untuk staging, jalankan PocketBase/Laravel terpisah dan arahkan HP ke alamat itu; jangan memakai
  record bisnis nyata untuk pengujian mutasi.

## Build, pasang, ukur

```sh
export JAVA_HOME=$HOME/jdk/jdk-17
export ANDROID_HOME=$HOME/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH

cd Android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-arm64-v8a-debug.apk

./gradlew :app:assembleRelease      # R8 full mode, resource shrink, split arm64-v8a
adb install -r app/build/outputs/apk/release/app-arm64-v8a-release.apk
adb shell am force-stop id.primamotor.pos
adb shell am start -W id.primamotor.pos/.MainActivity
```

`scrcpy` untuk melihat layar HP dari laptop tanpa emulator.

## Tanda tangan rilis

- Tanpa `Android/keystore.properties`, APK rilis memakai debug keystore supaya bisa diuji di HP toko.
  **Jangan distribusikan APK itu ke luar toko.**
- Untuk rilis nyata, buat `Android/keystore.properties` (tidak masuk git):

  ```properties
  storeFile=/path/di/luar/repo/prima-release.jks
  storePassword=...
  keyAlias=prima
  keyPassword=...
  ```

- Simpan keystore dan kata sandinya di luar repo. Kehilangan keystore berarti tidak bisa memperbarui
  aplikasi yang sudah terpasang.

## Tes

```sh
cd Android
./gradlew :app:testDebugUnitTest            # JVM, cepat
./gradlew :app:connectedDebugAndroidTest    # butuh HP fisik via USB
```

Catatan perangkat:

- `connectedDebugAndroidTest` mencopot aplikasi setelah selesai. Jalankan `:app:installDebug` lagi
  sebelum mengukur cold start.
- Layar HP harus tetap menyala. Kalau layar tidur di tengah suite, Compose test gagal dengan
  "No compose hierarchies found". Sebelum menjalankan:
  `adb shell svc power stayon true` dan `adb shell locksettings set-disabled true`
  (atau nyalakan layar berkala).
- Hasil XML: `app/build/outputs/androidTest-results/connected/debug/`.

Tes server yang menyentuh migrasi:

```sh
python3 Backend/tests/integration/pocketbase_transactions.py
```

## Perilaku offline yang disengaja

- Sesi tersimpan membuka POS tanpa jaringan; login pertama tetap butuh server.
- Transaksi masuk outbox lokal lebih dulu, lalu dikirim FIFO. Kegagalan yang tidak pasti ditanyakan
  ke server (`resolve`), bukan dikirim ulang buta.
- Stok atau saldo kurang **ditolak** saat offline; tidak ada transaksi yang menunggu koreksi saldo.
- Transaksi yang ditolak server berhenti di `needs_review` dan muncul di strip atas. Kasir memilih
  kirim ulang atau batalkan; pembatalan membalik efek stok/kas lokal.
- Hapus data tetap mengikuti aturan server. Administrasi pengguna tetap di web.
- Gaji hanya untuk pengguna login dan cache-nya dibuang saat logout; outbox tidak disentuh.
- Cetak struk gagal tidak menggagalkan transaksi: transaksi sudah tersimpan, cetak bisa diulang.

## Struktur singkat

```
app/src/main/java/id/primamotor/pos/
  data/local/     Room: local_record (JSON per record), outbox, sync_state
  data/sync/      Pusher (batch + receipt), Puller, SyncEngine, ConflictResolver
  data/ledger/    Cermin aturan atomic_ledger server untuk cek dini offline
  data/repo/      Checkout, edit/hapus, pelunasan, produk, pembacaan cache
  hardware/       Printer ESC/POS Bluetooth, pemindai barcode ZXing
  ui/             Compose: POS, riwayat, produk, kas, akun, pengaturan
```

Satu tabel `local_record` menyimpan JSON utuh per record server. Skema server yang sering berubah
tidak memaksa migrasi Room; kolom typed hanya ditambah saat query membutuhkannya.
