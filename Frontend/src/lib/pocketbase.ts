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
    return 'https://api.primamotorgladag.my.id/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export const LARAVEL_API_URL = getLaravelApiUrl();

export async function notifyLaravelApi(collection: string, event: 'created' | 'updated' | 'deleted', id: string, oldData?: any): Promise<boolean> {
  if (!id) return false;

  const apiUrl = getLaravelApiUrl();
  const targetUrl = `${apiUrl}/webhook/${collection}/${event}/${id}`;

  const fetchOptions: RequestInit = { method: 'POST' };
  if (oldData) {
    fetchOptions.headers = { 'Content-Type': 'application/json' };
    fetchOptions.body = JSON.stringify({ old_data: oldData });
  }

  const MAX_ATTEMPTS = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(targetUrl, fetchOptions);
      if (response.ok) return true;
      if (response.status === 404) {
        // Koleksi tidak dipantau Laravel (mis. gaji) atau record sudah terhapus oleh cascade.
        // Bukan kegagalan yang perlu di-rollback.
        return true;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, attempt)));
    }
  }

  console.warn(`[Laravel API] ${collection}/${event}/${id} gagal setelah ${MAX_ATTEMPTS}x percobaan:`, lastError);
  return false;
}
