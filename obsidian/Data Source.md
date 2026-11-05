# Data Source

File root `datasource` = satu-satunya sumber koneksi, port, dan lokasi data. Format `KEY=VALUE`, tanpa ekspansi variabel, tanpa rahasia.

## Aturan
- Jangan hardcode URL/port produksi di React, hook PocketBase, atau Laravel.
- Jangan pakai `VITE_PB_URL` / `VITE_LARAVEL_API_URL` lama.
- Frontend membaca `datasource` saat build.
- Jalankan Compose lewat `./compose`, jangan `docker compose` langsung.

## Lokasi data
- SQLite: `PB_DATA_DIR/data.db` (default `Backend/pb_data/data.db`).
- Upload: `PB_DATA_DIR/storage`.
- Backup seluruh direktori data, bukan hanya frontend.
- Mengganti `PB_DATA_DIR` = pindah data, bukan ganti port.

## Port host
`PB_HOST_PORT`, `API_HOST_PORT`, `WEB_HOST_PORT`.
Port internal container tidak berubah.

## Cloudflare
| Hostname | Tujuan |
| --- | --- |
| backend.primamotorgladag.my.id | `http://host.docker.internal:8090` |
| api.primamotorgladag.my.id | `http://host.docker.internal:8000` |

## Kebijakan akses
- Akun Active boleh tambah/ubah data operasional.
- Hapus dibatasi.
- Gaji privat (level 1 boleh baca semua).
- Stok realtime `stok_3` hanya via `log_stock`, kecuali override eksplisit.

Terkait: [[Architecture]], [[Testing & Quality Assurance]], [[Agent Rules & Best Practices]]