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
