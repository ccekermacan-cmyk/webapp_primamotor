import PocketBase, { BaseAuthStore } from 'pocketbase';
import { installSessionGuard, endSession } from '../../lib/session';

import { datasource } from '../datasource';
const pbUrl = datasource.pocketbase;
export const pb = new PocketBase(pbUrl);
async function verifySessionToken(token: string): Promise<boolean> {
    const verifier = new PocketBase(pbUrl, new BaseAuthStore());
    verifier.authStore.save(token, pb.authStore.record);
    try {
        const auth = await verifier.collection('user').authRefresh({requestKey: null});
        return String(auth.record.status).toLowerCase() === 'active';
    } catch (error) {
        const failure = error as {status?: number; response?: {message?: string}};
        const message = failure.response?.message || '';
        if (failure.status === 401 || ([400, 403].includes(failure.status || 0) && /authenticat/i.test(message))) return false;
        throw error;
    }
}
installSessionGuard(pb, verifySessionToken);
export async function validateSession(): Promise<void> {
    const token = pb.authStore.token;
    if (!token) return;
    try {
        if (!await verifySessionToken(token) && token === pb.authStore.token) endSession(pb);
    } catch { /* Keep session during temporary outages. */ }
}

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
