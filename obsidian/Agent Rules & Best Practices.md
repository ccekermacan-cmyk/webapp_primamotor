# Agent Rules & Best Practices

Aturan operasional wajib bagi seluruh AI agent dan developer yang mengerjakan Prima Motor POS. Seluruh modifikasi kode harus tunduk pada batasan ini.

---

## 1. Sumber Kebenaran Koneksi & Data
* **Baca `DATASOURCE.md` terlebih dahulu** sebelum melakukan perubahan pada koneksi, Docker, database, atau izin CRUD.
* File `datasource` di root adalah satu-satunya sumber alamat layanan, port host, dan lokasi data.
* Gunakan wrapper `./compose` (yang menyertakan `--env-file datasource`) agar Compose memuat file tersebut.
* **Jangan menduplikasi alamat produksi** di kode sumber, file `.env` frontend, atau konfigurasi Laravel.
* Frontend membaca file `datasource` saat tahap build via Vite (`vite.config.ts`), bukan saat runtime.

---

## 2. Atomic Ledger & Idempotensi
* **Pertahankan atomic ledger PocketBase** dan receipt idempotensi.
* Setiap edit atau hapus wajib membalik nilai transaksi lama terlebih dahulu, lalu menerapkan nilai baru dalam satu transaksi database.
* Jangan menambahkan pembaruan saldo atau stok secara terpisah setelah transaksi berhasil.
* Jika respons transaksi hilang (putus jaringan), wajib memeriksa status via endpoint `/api/financial/requests/{id}/resolve` sebelum mencoba kembali.

---

## 3. Kebijakan Akses & Hak Mutlak
* Semua akun berstatus `Active`/`active` boleh menambah dan mengubah data operasional tanpa pembatasan level.
* **Jangan melonggarkan aturan hapus:** Izin hapus tetap dibatasi oleh whitelist akun kas (`enum_1`, `visibilitas`) dan proteksi histori produk.
* **Jangan melonggarkan privasi gaji:** Slip gaji hanya dapat dibaca pemiliknya kecuali Level 1.
* **Jangan melonggarkan hak administrasi login:** Perubahan level/status pengguna tetap dilindungi ketat.

---

## 4. Database & Migrasi
* Gunakan migrasi tambahan. **Jangan mengandalkan edit migrasi yang sudah diterapkan.**
* Folder `pb_hooks/` dan `pb_migrations/` terpasang langsung ke Docker operasional; perubahan pada file ini dapat aktif segera tanpa rebuild image.
* Setiap perubahan formula bisnis pada atomic ledger wajib diterapkan pada **dua sisi**:
  * Hook PocketBase (`pb_hooks/lib/atomic_ledger.js`)
  * Laravel Service (`app/Services/CashflowLedger.php` & `ReportService.php`)
* Risiko drift: perbedaan implementasi akan membuat laporan realtime berbeda dengan hasil rekalkulasi Laravel.

---

## 5. Pengujian & Data Operasional
* Jalankan tes secara terisolasi. **Jangan memakai record bisnis nyata untuk pengujian mutasi.**
* Tes integrasi Python akan membuat server, database, akun, transaksi, dan SMTP sementara secara otomatis pada port `18080`/`18090`.
* Dokumentasikan hasil tes dan kebutuhan restart/build setelah setiap perubahan signifikan.

---

## 6. Checklist Perubahan (Wajib Sebelum Commit)
1. [ ] Baca `DATASOURCE.md` jika menyentuh koneksi, Docker, DB, atau izin CRUD.
2. [ ] Jika menyentuh atomic ledger, pastikan hook JS dan Laravel Service diperbarui bersamaan.
3. [ ] Jalankan `npm --prefix Frontend test` dan `php8.3 Backend/vendor/bin/phpunit`.
4. [ ] Jalankan `python3 Backend/tests/integration/pocketbase_transactions.py` jika menyentuh transaksi.
5. [ ] Jika menyentuh file `pb_hooks/` atau `pb_migrations/`, lakukan `./compose up -d --build` dan `php artisan config:clear`.
6. [ ] Jangan commit file `.obsidian/workspace*.json` dan `.obsidian/graph.json` (sudah di `.gitignore`).

---

Terkait: [[Architecture]], [[Data Source]], [[Testing & Quality Assurance]], [[Engine - Atomic Ledger & Idempotensi]]
