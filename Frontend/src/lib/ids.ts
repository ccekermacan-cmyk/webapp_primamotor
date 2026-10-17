// getRandomValues also works on HTTP LAN origins, where crypto.randomUUID is unavailable.
export function createRecordId(length = 15): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), value => alphabet[value % alphabet.length]).join('');
}
