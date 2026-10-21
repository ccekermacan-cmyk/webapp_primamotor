# Modal gaji

Form periode dan editor slip berada di `Frontend/src/pages/pos.tsx`, bukan `menu.tsx`.

- Periode: tanggal dan hari kerja memakai tinggi input 44px. Bantuan hari kerja ada di samping judul field. Mengubah tanggal mengisi hari kerja otomatis (hari bulan dikurangi Minggu); pembagi tetap dapat diubah manual.
- Karyawan: komponen slip dikelompokkan dalam Pendapatan, Potongan, Penerimaan, dan Catatan. Tab tidak membuang isian maupun lampiran. Menambahkan slip hanya mengubah daftar lokal. Konfirmasi periode memanggil `handleSaveGaji`, satu-satunya penyimpanan atomic untuk alur ini.
- Total daftar dan konfirmasi dihitung ulang memakai hari kerja terbaru, bukan nilai netto cache saat slip ditambahkan.
- `components/salary/SalaryDetail.tsx` menyamakan detail individual di POS, Akun, dan Person, memakai `lib/account.ts`. Netto dan diterima manual tetap terpisah; selisih bukan transaksi baru. Potongan bon mengikuti formula yang sudah ada.
- Cashflow tidak memiliki form gaji tersendiri. Referensi transaksi dan bon terkait gaji membuka POS melalui `?ref=<menu-id>`. Jangan membuat editor bon gaji terpisah yang melewati atomic ledger.
- Person kini menampilkan netto dan meminta halaman berikutnya dari server, bukan melakukan pagination kedua atas lima record dari server.
- Verifikasi privasi Akun, filter gaji, akses hapus, ledger, receipt idempotensi, serta handler lampiran dan cetak tidak diubah.

## Validasi

Pemeriksaan ulang 21 Oktober 2026 terhadap source terbaru.

- TypeScript: lulus.
- Suite frontend: 68 tes lulus.
- Browser dengan API tiruan dan semua mutasi bisnis diblokir: tinggi field, perhitungan ulang setelah perubahan hari kerja, preservasi isian/catatan antar-tab, konfirmasi lokal, satu dialog aktif, dan lebar ponsel 390px lulus.
- Browser Akun dengan API tiruan: detail tetap meminta verifikasi password; potongan, diterima manual, selisih, catatan, tautan lampiran, dan tampilan ponsel 390px lulus.
- Browser Person dengan API tiruan: halaman kedua mengambil record dari server, menampilkan netto, dan membuka detail slip yang sesuai; lulus.
- Pengujian tidak menulis record bisnis operasional.

## Penerapan

Perubahan berupa source frontend. Perlu build frontend dan penerapan hasil build melalui prosedur proyek. Tidak memerlukan migrasi database atau restart PocketBase. Build/deploy produksi dan push GitHub belum dilakukan dalam revisi ini.
