import PocketBase from 'pocketbase';

// Mengambil URL dari .env (jika tidak ada, gunakan localhost sebagai fallback)
const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pbUrl);

// Fungsi untuk mengambil file dengan autentikasi
export async function fetchFileAsBlobUrl(record: any, filename: string): Promise<string> {
    const url = pb.files.getUrl(record, filename);
    const token = pb.authStore.token;
    
    if (!token) return url; // fallback jika belum login

    const response = await fetch(url, {
        headers: { 
            'Authorization': token
        }
    });
    
    if (!response.ok) throw new Error(`Gagal mengambil file: ${response.status}`);
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

export const getLaravelApiUrl = () => {
  if (import.meta.env.VITE_LARAVEL_API_URL) {
    return import.meta.env.VITE_LARAVEL_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('primamotorgladag')) {
    return 'https://backend.primamotorgladag.my.id/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export const LARAVEL_API_URL = getLaravelApiUrl();

export async function notifyLaravelApi(collection: string, event: 'created' | 'updated' | 'deleted', id: string) {
  if (!id) return;
  try {
    const apiUrl = getLaravelApiUrl();
    const targetUrl = `${apiUrl}/webhook/${collection}/${event}/${id}`;
    await fetch(targetUrl, { method: 'POST' });
  } catch (err) {
    console.warn('[Laravel API Notify Error]', err);
  }
}
