# Aplikasi POS Android Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi Android native (Kotlin + Compose) untuk POS Prima Motor dengan SQLite lokal, transaksi offline, sinkronisasi atomic ke server, printer Bluetooth, dan scanner barcode.

**Architecture:** Satu modul `:app` dengan paket `data`/`domain`/`ui`/`hardware`/`util`. Room menjadi cache dan antrean (outbox); semua mutasi offline ditulis dalam satu transaksi Room lalu diputar ke PocketBase sebagai batch atomic dengan receipt. Server tetap otoritatif untuk saldo, stok, dan laporan.

**Tech Stack:** Kotlin 2.x, Jetpack Compose Material 3, Navigation Compose, Room (KSP), OkHttp + kotlinx.serialization, WorkManager, CameraX + ZXing core, ESC/POS builder sendiri, JUnit5 + MockWebServer + Compose UI test. Tanpa Hilt, tanpa Retrofit/Ktor, tanpa SQLCipher, tanpa library chart.

**Spec:** `docs/superpowers/specs/2026-11-27-android-pos-native-design.md`

## Global Constraints

- Bahasa: Kotlin; UI Jetpack Compose; tidak ada kode React/TypeScript di aplikasi Android.
- Skema lokal mencerminkan koleksi server: `menu`, `cashflow`, `log_stock`, `ongkos`, `bon`, `gaji`, `produk`, `dropdown`, `user`, `report`.
- Uang memakai `BigDecimal` di Kotlin; penyimpanan lokal tetap REAL/DOUBLE agar sama dengan server.
- Zona waktu laporan: `Asia/Jakarta`.
- ID record: 15 karakter `[a-z0-9]` dari `SecureRandom`, sama dengan `createRecordId` web.
- Semua mutasi keuangan lewat outbox; tidak ada write jaringan langsung dari UI.
- Transaksi ke server memakai batch PocketBase + `atomic_request_id` + `atomic_expected`/`expected_stock`.
- Push harus berurutan FIFO per pengguna; tidak ada retry otomatis untuk penolakan validasi.
- Baris lokal dengan `sync_dirty=1` tidak pernah dihapus oleh pull.
- Gaji: hanya data milik pengguna login yang disimpan; cache gaji dihapus saat logout.
- Tidak menguji mutasi pada data bisnis nyata; gunakan server staging dan fixture sintetis.
- Rahasia (token, keystore) tidak masuk repo.
- **Anggaran ringan:** APK release split `arm64-v8a` ≤ 12 MB; cold start ≤ 2 detik; tanpa library DI/chart/SQLCipher; dependency baru harus punya alasan tertulis di commit.
- **Tidak ada emulator:** CPU tanpa vmx/svm. Semua uji perangkat memakai HP fisik via `adb` (USB); mirror layar lewat `scrcpy`. Tidak ada Android Studio; build lewat `./gradlew`.

## Review Focus

- Dua perangkat menjual stok terakhir saat offline: transaksi kedua harus masuk `needs_review`, bukan hilang atau terkirim ganda.
- Respons push hilang setelah server commit: receipt harus mengubah hasil menjadi sukses tanpa mengirim ulang.
- Aplikasi dibuka setelah reboot tanpa internet: sesi tersimpan harus membuka layar POS, bukan layar login kosong.
- Printer mati saat mencetak: transaksi tetap tersimpan dan struk bisa dicetak ulang.
- Barcode tidak dikenal: aplikasi menawarkan pencarian nama, tidak membuat produk kosong.

---

## File Structure

```
Android/
  settings.gradle.kts, build.gradle.kts, gradle/libs.versions.toml, gradlew
  app/
    build.gradle.kts, proguard-rules.pro, src/main/AndroidManifest.xml
    src/main/res/... (ikon, tema, network_security_config debug)
    src/main/java/id/primamotor/pos/
      PosApplication.kt, MainActivity.kt
      data/local/  AppDatabase.kt, entity/*.kt, dao/*.kt, Converters.kt
      data/remote/ PocketBaseClient.kt, LaravelClient.kt, Dtos.kt, AuthApi.kt
      data/repo/   MenuRepository.kt, ProductRepository.kt, CashflowRepository.kt, BonRepository.kt, SalaryRepository.kt, UserRepository.kt
      data/sync/   Outbox.kt, SyncEngine.kt, Pusher.kt, Puller.kt, SyncWorker.kt, SyncState.kt
      data/ledger/ LocalLedger.kt, Reconciler.kt
      domain/      Money.kt, WibDate.kt, RecordId.kt, PosValidation.kt, GajiMath.kt
      ui/          theme/, components/, nav/AppNav.kt, pos/, history/, products/, cashflow/, account/, settings/, report/, login/
      hardware/printer/ EscPos.kt, BluetoothPrinter.kt, ReceiptTemplate.kt
      hardware/scanner/ BarcodeAnalyzer.kt, ScannerScreen.kt
    src/test/java/id/primamotor/pos/... (unit)
    src/androidTest/java/id/primamotor/pos/... (Room, Compose, MockWebServer)
```

---

### Task 1: Proyek Gradle + shell Compose

**Files:**
- Create: `Android/settings.gradle.kts`, `Android/build.gradle.kts`, `Android/gradle/libs.versions.toml`, `Android/gradle/wrapper/*`, `Android/gradlew*`
- Create: `Android/app/build.gradle.kts`, `Android/app/src/main/AndroidManifest.xml`
- Create: `Android/app/src/main/java/id/primamotor/pos/PosApplication.kt`, `MainActivity.kt`
- Create: `Android/app/src/main/java/id/primamotor/pos/ui/theme/Theme.kt`, `Type.kt`, `Color.kt`
- Create: `Android/app/src/main/java/id/primamotor/pos/ui/nav/AppNav.kt`
- Create: `Android/.gitignore`
- Modify: root `.gitignore` (abaikan `Android/.gradle/`, `Android/build/`, `Android/app/build/`, `Android/local.properties`)

**Interfaces:**
- Produces: aplikasi kosong yang bisa di-build dan dibuka; `AppNav` dengan rute `pos`, `history`, `products`, `cashflow`, `account`, `settings`, `report`, `login`.

- [ ] **Step 1: Tulis tes instrumentasi shell**

```kotlin
// app/src/androidTest/java/id/primamotor/pos/ShellTest.kt
@RunWith(AndroidJUnit4::class)
class ShellTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    @Test fun bottom_bar_shows_pos_and_history() {
        rule.onNodeWithText("POS").assertExists()
        rule.onNodeWithText("Riwayat").assertExists()
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd Android && ./gradlew :app:connectedDebugAndroidTest`
Expected: FAIL karena proyek/bottom bar belum ada.

- [ ] **Step 3: Buat proyek Gradle, tema, manifest, `MainActivity`, `AppNav` dengan bottom bar**

`minSdk 26`, `compileSdk`/`targetSdk` versi stabil terbaru yang terpasang lewat SDK CLI. `AndroidManifest` memuat `INTERNET`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `CAMERA`, dan referensi `network_security_config` hanya untuk varian debug.

Konfigurasi ringan yang dipasang sejak Task 1 (bukan menyusul):

- `isMinifyEnabled = true`, `isShrinkResources = true`, `android.enableR8.fullMode=true` di build release.
- `splits { abi { enable true; reset(); include "arm64-v8a" } }` (tambah `armeabi-v7a` hanya jika HP toko 32-bit).
- DI manual: `class AppContainer` di `PosApplication`, tanpa Hilt/Koin.
- Room via KSP (`ksp`, bukan `kapt`).
- Dependency final hanya: Compose, Room, OkHttp, kotlinx.serialization, WorkManager, CameraX, ZXing core. tidak ada lainnya tanpa alasan tertulis.
- Ikon: VectorDrawable, bukan bitmap.
- Signature debug: `debugKeystore` default.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd Android && ./gradlew :app:assembleDebug :app:connectedDebugAndroidTest`
Expected: BUILD SUCCESSFUL; tes lulus; HP fisik via `adb devices` terlihat (mirror layar dengan `scrcpy`).

- [ ] **Step 4b: Ukur awal anggaran**

Run: `cd Android && ./gradlew :app:assembleRelease && ls -lh app/build/outputs/apk/arm64/release/`
Expected: APK release `arm64-v8a` ≤ 12 MB. Cold start: `adb shell am start -W id.primamotor.pos/.MainActivity`, catat `TotalTime`; harus < 2000 ms. Catat angka ini di commit message; setiap Task yang menambah ukuran harus menyertakan angka baru.

- [ ] **Step 5: Commit**

```bash
git add Android .gitignore
git commit -m "feat(android): bootstrap Compose project and navigation shell"
```

---

### Task 2: Util uang, tanggal WIB, ID

**Files:**
- Create: `Android/app/src/main/java/id/primamotor/pos/domain/Money.kt`, `WibDate.kt`, `RecordId.kt`
- Test: `Android/app/src/test/java/id/primamotor/pos/domain/MoneyTest.kt`, `WibDateTest.kt`, `RecordIdTest.kt`

**Interfaces:**
- Produces: `Money.formatRupiah(value: BigDecimal?): String`, `Money.parse(input: String): BigDecimal?`, `WibDate.dayOf(raw: String): LocalDate`, `WibDate.nowIso(): String`, `RecordId.create(length: Int = 15): String`.

- [ ] **Step 1: Tulis tes gagal**

```kotlin
@Test fun rupiah_uses_dot_thousands_and_no_decimals_when_integral() {
    assertEquals("Rp 1.250.000", Money.formatRupiah(BigDecimal("1250000")))
}
@Test fun rupiah_keeps_two_decimals_when_fraction_exists() {
    assertEquals("Rp 1.250.575,50", Money.formatRupiah(BigDecimal("1250575.5")))
}
@Test fun wib_day_uses_asia_jakarta_not_device_zone() {
    assertEquals(LocalDate.of(2026, 10, 18), WibDate.dayOf("2026-10-17T20:00:00.000Z"))
}
@Test fun record_id_is_15_lower_alphanumeric() {
    assertTrue(RecordId.create().matches(Regex("[a-z0-9]{15}")))
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd Android && ./gradlew :app:testDebugUnitTest --tests 'id.primamotor.pos.domain.*'`
Expected: FAIL karena class belum ada.

- [ ] **Step 3: Implementasikan util**

`Money` memakai `NumberFormat` locale `id-ID`; nol pecahan ≤ 0.000001 dianggap integral. `WibDate` memakai `ZoneId.of("Asia/Jakarta")`; input tanpa zona dianggap UTC (sama dengan `localDate` di ledger web). `RecordId` memakai `SecureRandom` dengan alfabet `abcdefghijklmnopqrstuvwxyz0123456789` dan modulo 36.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd Android && ./gradlew :app:testDebugUnitTest --tests 'id.primamotor.pos.domain.*'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Android/app/src/main/java/id/primamotor/pos/domain Android/app/src/test/java/id/primamotor/pos/domain
git commit -m "feat(android): money, WIB date, and record id utilities"
```

---

### Task 3: Skema Room

**Files:**
- Create: `Android/app/src/main/java/id/primamotor/pos/data/local/AppDatabase.kt`
- Create: `Android/app/src/main/java/id/primamotor/pos/data/local/entity/*.kt` (MenuEntity, CashflowEntity, LogStockEntity, OngkosEntity, BonEntity, GajiEntity, ProdukEntity, DropdownEntity, UserEntity, ReportEntity, OutboxEntity, OutboxOperationEntity, SyncStateEntity, ConflictEntity)
- Create: `Android/app/src/main/java/id/primamotor/pos/data/local/dao/*.kt`
- Test: `Android/app/src/androidTest/java/id/primamotor/pos/data/local/DatabaseTest.kt`

**Interfaces:**
- Produces: `AppDatabase` dengan DAO per entity. Semua entity bisnis punya kolom `syncDirty: Int = 0` dan `syncStateId: String?`.

- [ ] **Step 1: Tulis tes in-memory**

```kotlin
@Test fun outbox_transaction_survives_restart() {
    val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()
    db.outboxDao().insert(OutboxEntity(requestId = "r1", payloadJson = "{}", status = "pending", createdAt = 1))
    assertEquals("pending", db.outboxDao().oldest()!!.status)
}
```

- [ ] **Step 2: Pastikan gagal**, `./gradlew :app:connectedDebugAndroidTest --tests '*DatabaseTest*'`.

- [ ] **Step 3: Implementasikan entity + DAO**

Entity mengikuti field koleksi server yang dipakai UI (lihat `Frontend/src/types/*.ts` dan skema migrasi `Backend/pb_migrations`). `outbox` unik per `requestId`; `outbox_operation` menyimpan urutan dan payload. Indeks: `menu(created_at)`, `log_stock(item_baru)`, `cashflow(account_1, created_at)`, `bon(user)`, `produk(barcode)`, `outbox(status, created_at)`.

- [ ] **Step 4: Pastikan lulus**, lalu commit `feat(android): room schema and daos`.

---

### Task 4: Klien PocketBase + sesi

**Files:**
- Create: `data/remote/PocketBaseClient.kt`, `data/remote/AuthApi.kt`, `data/remote/Dtos.kt`
- Create: `data/local/SessionStore.kt` (EncryptedSharedPreferences)
- Test: `src/test/java/id/primamotor/pos/data/remote/PocketBaseClientTest.kt` (MockWebServer)

**Interfaces:**
- Produces: `PocketBaseClient.auth(username, password): UserSession`, `refresh(): UserSession`, `batch(operations, requestId): BatchResult`, `resolveRequest(requestId): Resolution`, `list(collection, filter, sort): List<JsonObject>`.
- `UserSession(id, username, name, level, status, token, expiresAt)`.

- [ ] **Step 1..5 (TDD):** tes login sukses/gagal, refresh, header `Authorization`, dan timeout. Implementasi memakai OkHttp + kotlinx.serialization; token disimpan terenkripsi; 401 dari request biasa memicu satu refresh lalu gagal bersih. Body request dibuat dari `JsonObject`/data class berseri (tanpa Retrofit).

- [ ] **Step 6: Commit** `feat(android): pocketbase client and encrypted session`.

---

### Task 5: Cermin ledger lokal + paritas

**Files:**
- Create: `data/ledger/LocalLedger.kt`
- Test: `src/test/java/id/primamotor/pos/data/ledger/LocalLedgerTest.kt`
- Create: `Backend/tests/integration/local_ledger_fixtures.json` (fixture bersama)

**Interfaces:**
- Produces: `LocalLedger.applyCashflow(old, new): Map<accountId, BigDecimal>`, `applyStock(oldQty, newQty, direction): Int`, `applyBon(old, new): BigDecimal`, `reverseMenu(menuId): List<Delta>`.

- [ ] **Step 1: Tulis tes paritas** memakai fixture JSON yang sama dengan tes integrasi server: kas masuk, kas keluar, transfer, kasbon, edit nominal, hapus, stok in/out, edit arah stok.

- [ ] **Step 2: Pastikan gagal.**

- [ ] **Step 3: Implementasikan** aturan dari `Backend/pb_hooks/lib/atomic_ledger.js` (`cashDeltas`, `loanEffect`, `effects`). Tidak perlu meniru laporan.

- [ ] **Step 4: Tambah pemeriksaan server** di `Backend/tests/integration/pocketbase_transactions.py`: muat fixture yang sama, jalankan lewat batch, bandingkan stok/saldo akhir dengan nilai fixture.

- [ ] **Step 5: Jalankan** `./gradlew :app:testDebugUnitTest` dan `python3 Backend/tests/integration/pocketbase_transactions.py`; keduanya lulus.

- [ ] **Step 6: Commit** `feat(android): local ledger mirror with server parity fixtures`.

---

### Task 6: Outbox + pusher + receipt

**Files:**
- Create: `data/sync/Outbox.kt`, `data/sync/Pusher.kt`, `data/sync/SyncState.kt`
- Test: `src/test/java/id/primamotor/pos/data/sync/PusherTest.kt` (MockWebServer)

**Interfaces:**
- Produces: `Outbox.enqueue(transaction: PendingTransaction)`, `Pusher.pushNext(): PushOutcome` (`Done`, `RetryLater`, `NeedsReview(reason)`), `SyncState.pendingCount(): Flow<Int>`.

- [ ] **Step 1: Tulis tes** untuk: sukses, respons hilang lalu resolve `committed`, resolve `cancelled`, ditolak 400 (needs_review), FIFO (transaksi kedua tidak dikirim sebelum pertama selesai).

- [ ] **Step 2..4: Implementasi + lulus.** Payload batch persis operasi web: create/update/delete + `atomic_expected`/`expected_stock`; `requestId` disimpan sebelum kirim; `RetryLater` memakai backoff WorkManager (bukan retry panas).

- [ ] **Step 5: Commit** `feat(android): durable outbox and atomic receipt pusher`.

---

### Task 7: Puller jendela + WorkManager

**Files:**
- Create: `data/sync/Puller.kt`, `data/sync/SyncWorker.kt`
- Test: `src/test/java/id/primamotor/pos/data/sync/PullerTest.kt`

**Interfaces:**
- Produces: `Puller.sync()` (push lalu pull), `SyncWorker` periodik 15 menit dengan `Constraints.NetworkType.CONNECTED`.

- [ ] **Step 1: Tulis tes** jendela: hari ini + 30 hari terakhir + nota `belum`; baris `syncDirty=1` tidak terhapus; baris hilang dari respons dihapus.
- [ ] **Step 2..4: Implementasi + lulus.**
- [ ] **Step 5: Commit** `feat(android): windowed pull sync and work manager`.

---

### Task 8: Login + gating sesi

**Files:**
- Create: `ui/login/LoginScreen.kt`, `ui/login/LoginViewModel.kt`
- Modify: `MainActivity.kt` (start destination berdasarkan sesi tersimpan)

**Interfaces:**
- Produces: `LoginViewModel.login(username, password)`, `LoginViewModel.state: StateFlow<LoginState>`; sesi tersimpan membuka POS tanpa jaringan.

- [ ] **Step 1: Tulis tes Compose** untuk login sukses, password salah, dan sesi tersimpan saat offline.
- [ ] **Step 2..4: Implementasi + lulus** (token refresh saat jaringan tersedia; jika gagal karena jaringan, tetap masuk dengan data cache dan label "offline").
- [ ] **Step 5: Commit** `feat(android): login with offline session`.

---

### Task 9: Repository baca + sinkron awal

**Files:**
- Create: `data/repo/*.kt` (Menu, Product, Cashflow, Bon, Salary, User)
- Test: `src/test/java/id/primamotor/pos/data/repo/*Test.kt`

**Interfaces:**
- Produces: `ProductRepository.observeAll(): Flow<List<ProdukEntity>>`, `MenuRepository.observeDay(date)`, dll. Semua cache-first.

- [ ] **Step 1: Tulis tes** cache-first: saat jaringan gagal, Flow tetap memancarkan data Room.
- [ ] **Step 2..4: Implementasi + lulus.**
- [ ] **Step 5: Commit** `feat(android): cache-first repositories`.

---

### Task 10: Checkout POS offline

**Files:**
- Create: `ui/pos/PosScreen.kt`, `PosViewModel.kt`, `CartSheet.kt`, `CheckoutScreen.kt`
- Create: `domain/PosValidation.kt`
- Create: `data/repo/CheckoutRepository.kt`
- Test: `src/test/java/id/primamotor/pos/domain/PosValidationTest.kt`, `src/androidTest/.../CheckoutFlowTest.kt`

**Interfaces:**
- Produces: `PosValidation.stockError(cart, stock, kind): String?`, `PosValidation.paymentError(form, total): String?`, `CheckoutRepository.commit(cart, form): LocalResult`.

- [ ] **Step 1: Tulis tes validasi** (qty bulat > 0, stok tidak cukup offline diblokir, pembayaran tunai < total ditolak, tempo wajib tanggal).
- [ ] **Step 2..5: Implementasi + lulus.** Checkout menulis `menu` + `log_stock` + `cashflow` + `ongkos` + outbox dalam satu `@Transaction`; ID dibuat klien; `created_at` dari waktu perangkat; status `lunas`/`belum` dihitung seperti web.
- [ ] **Step 6: Commit** `feat(android): offline POS checkout`.

---

### Task 11: Edit + hapus transaksi

**Files:**
- Create: `ui/pos/EditSession.kt`, `data/repo/PosEditRepository.kt`
- Modify: `CheckoutRepository.kt`
- Test: `src/test/java/id/primamotor/pos/data/repo/PosEditRepositoryTest.kt`

**Interfaces:**
- Produces: `PosEditRepository.prepare(menuId): EditSession`, `diff(editSession, cart, form): List<Operation>`.

- [ ] **Step 1: Tulis tes** diff: cashflow dihapus/diubah/ditambah; ongkos memakai satu set keputusan `keptOngkosIds` (tidak ada update pada baris yang dihapus); log stok unchanged dilewati; `expected_stock` disertakan.
- [ ] **Step 2..4: Implementasi + lulus.**
- [ ] **Step 5: Commit** `feat(android): transaction edit and delete diff`.

---

### Task 12: Riwayat + pelunasan

**Files:**
- Create: `ui/history/HistoryScreen.kt`, `HistoryViewModel.kt`, `QuickSettleSheet.kt`
- Test: `src/test/java/id/primamotor/pos/domain/SettlementTest.kt`

**Interfaces:**
- Produces: `Settlement.remaining(total, paid, amount): BigDecimal`, `HistoryViewModel.settle(menuId, amount, accountId)`.

- [ ] **Step 1: Tulis tes** sisa tagihan, lebih bayar ditolak, pelunasan menulis cashflow + outbox.
- [ ] **Step 2..4: Implementasi + lulus.**
- [ ] **Step 5: Commit** `feat(android): history and quick settlement`.

---

### Task 13: Produk + barcode

**Files:**
- Create: `ui/products/ProductsScreen.kt`, `ProductFormScreen.kt`, `ProductViewModel.kt`
- Create: `hardware/scanner/BarcodeAnalyzer.kt`, `ScannerScreen.kt`
- Test: `src/test/java/id/primamotor/pos/domain/BarcodeLookupTest.kt`

**Interfaces:**
- Produces: `BarcodeLookup.find(code, products): ProdukEntity?` (urutan `barcode` → `id_lama` → null), `ScannerScreen(onResult)`.

- [ ] **Step 1: Tulis tes lookup** (barcode cocok, fallback `id_lama`, tidak ditemukan → null).
- [ ] **Step 2..5: Implementasi + lulus** (CameraX `ImageAnalysis` + ZXing core `MultiFormatReader`; decode di executor tunggal, throttle ~5 fps; `ScannerScreen` hanya membuat kamera saat terbuka. Input keyboard wedge mengisi field yang sama. Tanpa ML Kit.)
- [ ] **Step 6: Commit** `feat(android): products and barcode scanning`.

---

### Task 14: Kas, pelanggan, laporan baca

**Files:**
- Create: `ui/cashflow/*`, `ui/person/*`, `ui/report/*`
- Test: `src/test/java/id/primamotor/pos/domain/CashflowFilterTest.kt`

- [ ] Steps TDD: filter tab riwayat/tempo/akun, daftar pelanggan/supplier/mekanik, laporan read-only dengan label "data terakhir" saat offline. Grafik dibuat dengan Compose `Canvas` (bar sederhana), tanpa library chart. Commit `feat(android): cashflow, people, and report screens`.

---

### Task 15: Akun + gaji pribadi

**Files:**
- Create: `ui/account/AccountScreen.kt`, `SalarySection.kt`, `LoanSection.kt`, `domain/GajiMath.kt`
- Test: `src/test/java/id/primamotor/pos/domain/GajiMathTest.kt`

**Interfaces:**
- Produces: `GajiMath.netto(item, periodQty): BigDecimal`, `LoanSummary.of(entries, balance): LoanSummary`.

- [ ] **Step 1: Tulis tes** port `calculateItemNetto` dan `loanSummary` web (angka sama).
- [ ] **Step 2..4: Implementasi + lulus.** Cache gaji hanya milik pengguna login; dihapus saat logout.
- [ ] **Step 5: Commit** `feat(android): account, salary, and loan`.

---

### Task 16: Printer Bluetooth + template struk

**Files:**
- Create: `hardware/printer/EscPos.kt`, `BluetoothPrinter.kt`, `ReceiptTemplate.kt`
- Create: `ui/pos/ReceiptPreview.kt`
- Test: `src/test/java/id/primamotor/pos/hardware/printer/ReceiptTemplateTest.kt`

**Interfaces:**
- Produces: `ReceiptTemplate.render(receipt: ReceiptData): ByteArray` (ESC/POS), `BluetoothPrinter.print(bytes): PrintResult`.

- [ ] **Step 1: Tulis tes** byte struk: init, align, item, total, bayar, kembali, potong; karakter non-ASCII diganti.
- [ ] **Step 2..4: Implementasi + lulus.** Koneksi SPP; printer gagal tidak menggagalkan transaksi; tombol cetak ulang.
- [ ] **Step 5: Commit** `feat(android): bluetooth esc/pos receipt printing`.

---

### Task 17: Konflik + status outbox

**Files:**
- Create: `ui/sync/ConflictSheet.kt`, `SyncStatusBar.kt`, `data/sync/ConflictResolver.kt`
- Test: `src/test/java/id/primamotor/pos/data/sync/ConflictResolverTest.kt`

**Interfaces:**
- Produces: `ConflictResolver.retry(conflict)`, `ConflictResolver.void(conflict)` (membalik efek lokal), `SyncStatusBar` menampilkan jumlah pending.

- [ ] **Step 1: Tulis tes** transaksi ditolak stok → `needs_review`; void membalik stok/saldo lokal; retry setelah koreksi.
- [ ] **Step 2..4: Implementasi + lulus.**
- [ ] **Step 5: Commit** `feat(android): conflict review for rejected offline transactions`.

---

### Task 18: Pengaturan + logout aman

**Files:**
- Create: `ui/settings/SettingsScreen.kt`, `SettingsViewModel.kt`
- Modify: `SessionStore.kt`, `AppDatabase` (hapus cache gaji)

- [ ] Steps: pengaturan printer (pilih perangkat), versi aplikasi, status sinkron, logout yang mempertahankan outbox dan menghapus cache gaji; commit `feat(android): settings and safe logout`.

---

### Task 19: Migrasi `barcode` + backfill

**Files:**
- Create: `Backend/pb_migrations/1792600000_add_product_barcode.js`
- Modify: `Backend/tests/integration/pocketbase_transactions.py` (salin migrasi baru; cek field tersedia)

- [ ] **Step 1: Tulis cek integrasi** field `barcode` ada dan bisa diisi lewat produk create/update.
- [ ] **Step 2: Implementasi migrasi** additive; backfill `barcode = id_lama` untuk baris yang kosong; indeks `produk(barcode)`.
- [ ] **Step 3: Jalankan** `python3 Backend/tests/integration/pocketbase_transactions.py`.
- [ ] **Step 4: Commit** `feat(server): product barcode field with backfill`.

---

### Task 20: Hardening rilis + uji perangkat

**Files:**
- Modify: `Android/app/build.gradle.kts` (signing config release, minify, splits)
- Create: `Android/README.md` (cara build, staging URL, lisensi SDK, setup USB/udev, scrcpy)
- Create: `docs/superpowers/plans/2026-11-27-android-pos-native-release-checklist.md`

- [ ] **Step 1: Patok anggaran di release**
Run: `cd Android && ./gradlew clean :app:assembleRelease :app:bundleRelease` lalu `ls -lh app/build/outputs/apk/arm64/release/`
Expected: APK `arm64-v8a` ≤ 12 MB. Jika lewat: cek `app/build/outputs/mapping/release/usage.txt` untuk resource/dependency yang bisa dibuang; jangan naikkan anggaran.

- [ ] **Step 2: Ukur performa di HP fisik**
Run: `adb install -r app/build/outputs/apk/arm64/release/app-arm64-v8a-release.apk` lalu `adb shell am start -W id.primamotor.pos/.MainActivity` tiga kali.
Expected: `TotalTime` ≤ 2000 ms tiap kali (ambil angka ketiga, cache hangat).

- [ ] **Step 3: Uji lapangan**
Mode pesawat (transaksi → online → sync), printer nyata (58 mm, mati di tengah cetak → cetak ulang), barcode cetak (kamera + gun), reboot HP saat offline, 30 hari data, dan dua akun di satu HP (ganti pengguna).

- [ ] **Step 4: Commit** `chore(android): release hardening and size budget`

---

## Self-Review

- **Spec coverage:** desain §6–§6a–§17 tercakup di Task 1–20; §6a anggaran ukuran/kecepatan diukur di Task 1 dan Task 20; §19 environment masuk `Android/README.md` dan Task 20; §20 default produk dipakai di Task 8, 10, 17.
- **Step scan:** setiap langkah punya aksi + hasil yang bisa dicek; tidak ada "handle edge cases" tanpa nama.
- **Type consistency:** `LocalLedger` dipakai Task 5, 10, 11, 17; `PushOutcome` dipakai Task 6, 7, 17; `BarcodeLookup` dipakai Task 13 dan 10.
- **Review Focus:** tiap baris punya tes di Task 6, 8, 16, 13, 17.
- **Proportion:** tidak ada body fungsi panjang; hanya signature, tes, dan nilai yang dipatok.
- **Ringan:** tidak ada task yang menambah library opsional; ZXing menggantikan ML Kit, OkHttp menggantikan Retrofit/Ktor, Canvas menggantikan library chart.