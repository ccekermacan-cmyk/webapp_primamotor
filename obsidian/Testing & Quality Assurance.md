# Testing & Quality Assurance

Prima Motor POS memiliki rangkaian pengujian terisolasi di 3 tingkat: Unit/Logic Test di Frontend, Feature/Hook Test di Laravel, dan End-to-End Scale Test di PocketBase.

---

## 1. Rangkaian Pengujian Frontend (Node.js Test Runner)
Dijalankan tanpa browser via script `npm --prefix Frontend test` (14 file tes di `Frontend/tests/*.test.mjs`):

| File Pengujian | Aspek yang Diverifikasi |
| :--- | :--- |
| `tests/account.test.mjs` | Isolasi data slip gaji per level akun, kalkulasi rincian komponen gaji, akumulasi pinjaman bon, dan validasi password minimal 8 karakter. |
| `tests/atomic-batch.test.mjs` | Struktur ID batch stabil, marker komit `{ atomic: true }`, penguncian anti double-spend, resolusi request putus jaringan via `/resolve`, dan penolakan jika backend belum siap. |
| `tests/cashflow.test.mjs` | Penguncian zona waktu Jakarta (UTC+7) tanpa pergeseran kalender, batas milidetik akhir hari bisnis (23:59:59.999), dan pembalikan saldo lama pada `editableBalance`. |
| `tests/datasource.test.mjs` | Resolusi port lokal pada localhost vs URL HTTPS pada domain publik Cloudflare. |
| `tests/financial-patch.test.mjs` | Pencegahan overwrite saldo berjalan oleh form metadata dan deteksi modifikasi data paralel di background. |
| `tests/login.test.mjs` | Pesan error kredensial netral, pembedaan error jaringan vs rate limit vs server 503, dan proteksi kuota storage browser. |
| `tests/money.test.mjs` | Format pemisah ribuan titik, pemisah desimal, penanganan nilai null/undefined, dan keselamatan angka negatif. |
| `tests/pos-draft.test.mjs` | Pemulihan keranjang kasir, penguncian saat ada atomic pending, dan kedaluwarsa draft setelah 24 jam. |
| `tests/pos-transactions.test.mjs`| Klasifikasi transaksi pendapatan/pengeluaran, validasi pelunasan piutang, dan pencocokan log stok untuk baris produk kembar. |
| `tests/pos-validation.test.mjs` | Validasi checkout kasir (mekanik wajib pada servis, akun kas berpasangan, order online, dan tempo). |
| `tests/pos-view.test.mjs` | Penyimpanan preferensi tampilan katalog kasir (list/grid, query pencarian, filter kategori). |
| `tests/products.test.mjs` | Normalisasi kode barcode SKU, penolakan stok dan harga negatif, dan deteksi duplikasi `id_lama`. |
| `tests/session.test.mjs` | Penanganan token expired, pengamanan draft saat logout, dan pemilahan error 403 izin vs 401 sesi. |
| `tests/transaction-sync.test.mjs`| Penanganan outbox sync non-blocking, generator ID aman LAN, dan penerusan status error rekalkulasi laporan. |

---

## 2. Rangkaian Pengujian Backend Laravel (PHPUnit)
Dijalankan via `php8.3 Backend/vendor/bin/phpunit -c Backend/phpunit.xml --do-not-cache-result`:

* **`CashflowHookTest.php`** — Memastikan mutasi masuk menambah saldo, mutasi transfer memindahkan saldo, dan jenis `bonkaryawan` otomatis menerbitkan pinjaman bon.
* **`CashflowLedgerTest.php`** — Memastikan pencegahan overdraft, pembalikan nilai lama sebelum validasi nilai baru, dan rekalkulasi snapshot saldo historis untuk baris-baris berikutnya.
* **`LogStockHookTest.php`** — Memastikan mutasi masuk menambah stok dan memperbarui harga beli (`produk.beli`), mutasi keluar mengurangi stok, dan menolak stok minus.
* **`TransactionSyncTest.php`** — Memastikan pengiriman webhook batch bersifat idempoten, cascade delete transaksi kasir membalik seluruh saldo dan stok secara atomik, dan upstream outage PocketBase mengembalikan HTTP 503 transparan.
* **`BonHookTest.php`** — Siklus hidup pinjaman bon dan sinkronisasi saldo piutang debitur di tabel dropdown.
* **`OngkosHookTest.php`** — Siklus hidup biaya ongkos servis dan pembaruan omzet servis harian.
* **`MenuHookTest.php`** — Pencatatan piutang nota belum lunas dan cascade delete menu beserta seluruh anak transaksinya.
* **`ProductIntegrityTest.php`** — Proteksi perubahan langsung kolom `stok_3`, penolakan penghapusan produk yang memiliki histori log stok, dan re-anchoring histori via `stok_override: true`.
* **`ReportCronTest.php`** — Pembuatan otomatis laporan harian dan pembersihan laporan pada hari libur toko tutup.

---

## 3. Rangkaian Pengujian Integrasi & Skala (Python Harness)
Dijalankan via:
```sh
python3 Backend/tests/integration/pocketbase_transactions.py
PM_SCALE_TEST=1 python3 Backend/tests/integration/pocketbase_transactions.py
```
* **Karakteristik:**
  * Membaca skema tabel dari database lokal, lalu membuat instance server PocketBase, Laravel, database SQLite, akun kasir, dan SMTP **sementara (ephemeral)** pada port `18080` dan `18090`.
  * **Tidak pernah menyentuh data bisnis operasional nyata.**
  * Membersihkan seluruh data uji setelah selesai; menyimpan log ke `/tmp` hanya jika gagal.
* **Uji Skala (`PM_SCALE_TEST=1`):**
  * Menyuntikkan **200.000 entri log stok sintetis** untuk memverifikasi performa window function SQLite dan keakuratan rekonsiliasi stok dalam beban kerja ekstrem.

---

Terkait: [[Architecture]], [[Database & Schema]], [[Agent Rules & Best Practices]]
