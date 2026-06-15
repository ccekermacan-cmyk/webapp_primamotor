import PocketBase from 'pocketbase';

const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pbUrl);

pb.beforeSend = function (url, reqOpts) {
    reqOpts.headers = Object.assign({}, reqOpts.headers, {
        'ngrok-skip-browser-warning': 'true',
    });
    return { url, reqOpts };
};

// Fungsi untuk mengambil file dengan autentikasi
export async function fetchFileAsBlobUrl(record: any, filename: string): Promise<string> {
    const url = pb.files.getUrl(record, filename);
    const token = pb.authStore.token;
    if (!token) return url; // fallback (tapi seharusnya token ada)

    const response = await fetch(url, {
        headers: { 
            'Authorization': token,
            'ngrok-skip-browser-warning': '69420' // TAMBAHKAN INI DI SINI
        }
    });
    if (!response.ok) throw new Error(`Gagal mengambil file: ${response.status}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}