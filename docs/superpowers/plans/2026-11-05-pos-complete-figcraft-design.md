# Complete POS UI Design in FigCraft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan desain halaman Produk, Akun/Profile, Settings, melengkapi detail operasional POS, History, dan Cashflow di dalam canvas FigCraft native (`Prima_Motor_Gladag_POS.figcraft`), serta meng-update web preview browser.

**Architecture:** Menggunakan `figcraft-cli` untuk menyusun node/layer vector artboard desktop (1440x900), tablet (1024x768), dan mobile (390x844), lalu merender aset PNG ke folder `preview-ui/` dengan web view tab interaktif.

**Tech Stack:** FigCraft Native CLI, JSON batch commands, HTML5/CSS3/JavaScript for browser preview.

**Spec:** Desain mengacu pada referensi Pinterest POS bernuansa Warm Coral Orange (`#FF5B37`), clean slate backgrounds, rounded modern cards, dan rincian fitur dari kode operasional `prima-motor-pos`.

---

## Task 1: Generate Artboard 05 - Product Management & Inventory (1440x900)
- Metric cards: Total Produk (1.240 Item), Nilai Aset Stok (Rp 84.500.000), Stok Menipis (12 Item), Kategori Aktif (8).
- Toolbar: Search bar, filter kategori dropdown, filter status stok, tombol `+ Tambah Produk`, `Import Excel`.
- Table Data Produk: Kode SKU, Nama Produk, Kategori, Harga Beli, Harga Jual Retail, Stok Realtime (`stok_3`), Status Badge, Action buttons (Edit, Koreksi Stok, Log Riwayat, Hapus).
- Drawer Slide-over: Form Tambah/Koreksi Stok dengan field expected_stock.

## Task 2: Generate Artboard 06 - Profile & Salary Slip (1440x900)
- Header User Identity: Avatar, Nama, Username, Badge Status "Active", Role Level.
- Section 1: Form Profil & Keamanan (Ganti Nama, Ganti Password).
- Section 2: Slip Gaji Karyawan & Komisi Servis Terproteksi (Opsi Unhide Nominal).
- Section 3: Ledger Kasbon Pribadi (Bon Staf) & Riwayat Potongan.

## Task 3: Generate Artboard 07 - System Settings & Workshop Config (1440x900)
- Section 1: Profil & Identitas Bengkel (Nama, Alamat, No WA, Footer Struk).
- Section 2: Konfigurasi Printer Kasir (Thermal 58mm/80mm, QRIS, Auto-cut).
- Section 3: Izin & Level Akses Pengguna (Hak Hapus, Visibilitas Kas).
- Section 4: Status Database & Atomic Ledger Engine Health.

## Task 4: Export All Frames & Update Live Browser Preview
- Export seluruh 9 frame ke format gambar PNG di `preview-ui/`.
- Perbarui `preview-ui/index.html` dengan tab switcher untuk 9 frame.
