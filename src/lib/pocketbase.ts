import PocketBase from 'pocketbase';

// VITE_PB_URL akan diisi di Vercel. Jika kosong, ia pakai localhost.
const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pbUrl);

// Fungsi untuk membypass halaman peringatan Ngrok Free
pb.beforeSend = function (url, reqOpts) {
    reqOpts.headers = Object.assign({}, reqOpts.headers, {
        'ngrok-skip-browser-warning': 'true',
    });
    return { url, reqOpts };
};