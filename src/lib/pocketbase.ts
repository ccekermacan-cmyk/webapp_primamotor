import PocketBase from 'pocketbase';

// Pastikan VITE_PB_URL di Vercel tidak memiliki trailing slash (/) di akhir
const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pbUrl);

// Tambahkan ini agar tidak terjadi masalah dengan authStore di Vercel
pb.autoCancellation(false);