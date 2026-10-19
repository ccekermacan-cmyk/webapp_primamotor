declare const __DATASOURCE__: { pbPort: string; apiPort: string; pbUrl: string; apiUrl: string };
const host = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
export const datasource = {
  pocketbase: local ? `http://${host}:${__DATASOURCE__.pbPort}` : __DATASOURCE__.pbUrl,
  laravel: local ? `http://${host}:${__DATASOURCE__.apiPort}/api` : __DATASOURCE__.apiUrl,
};
