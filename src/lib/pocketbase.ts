import PocketBase from 'pocketbase';

// VITE_PB_URL akan diisi nanti di Vercel. Jika kosong, ia akan pakai localhost.
const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pbUrl);