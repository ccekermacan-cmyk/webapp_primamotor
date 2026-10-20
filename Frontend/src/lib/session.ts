import type PocketBase from 'pocketbase';

export const SESSION_MESSAGE = 'Sesi Anda berakhir atau tidak lagi sah. Silakan login ulang.';
export function responseHasStatus(value: unknown, status: number): boolean {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj.status === status || Object.values(obj).some(child => responseHasStatus(child, status));
}
export function endSession(client: PocketBase): void {
  try { sessionStorage.setItem('prima:login-reason', SESSION_MESSAGE); } catch { /* Optional notice. */ }
  // Never discard receipts or drafts when authentication expires.
  for (const key of ['user_name', 'user_username', 'user_level']) {
    try { localStorage.removeItem(key); } catch { /* Browser storage may be unavailable. */ }
  }
  client.authStore.clear();
}
export function checkSessionExpiry(client: PocketBase): void {
  if (client.authStore.token && !client.authStore.isValid) endSession(client);
}
export function installSessionGuard(client: PocketBase, verify: (token: string) => Promise<boolean>): void {
  let verification: {token: string; promise: Promise<boolean>} | undefined;
  client.afterSend = async (response, data, options: {headers?: HeadersInit} = {}) => {
    const token = new Headers(options?.headers).get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    if (!token || token !== client.authStore.token) return data;
    if (response.status === 401 || responseHasStatus(data, 401)) endSession(client);
    else if (response.status === 403 || responseHasStatus(data, 403)) {
      // Permission failures and expired sessions are different. Verify before logging out.
      if (verification?.token !== token) verification = {token, promise: verify(token)};
      const current = verification;
      try {
        if (!await current.promise && token === client.authStore.token) endSession(client);
      } catch { /* A network/server failure cannot establish that a session is invalid. */ }
      finally { if (verification === current) verification = undefined; }
    }
    return data;
  };
}
