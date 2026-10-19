import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import fs from 'fs';
import { fileURLToPath } from 'url';
const datasource = Object.fromEntries(fs.readFileSync(fileURLToPath(new URL('../datasource', import.meta.url)), 'utf8')
  .split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
    const index = line.indexOf('=');
    if (index < 1) throw new Error('Format datasource tidak valid');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
for (const key of ['PB_HOST_PORT', 'API_HOST_PORT', 'PB_PUBLIC_URL', 'API_PUBLIC_URL']) {
  if (!datasource[key]) throw new Error(`datasource: ${key} wajib diisi`);
}


export default defineConfig({
  define: { __DATASOURCE__: JSON.stringify({ pbPort: datasource.PB_HOST_PORT, apiPort: datasource.API_HOST_PORT, pbUrl: datasource.PB_PUBLIC_URL, apiUrl: datasource.API_PUBLIC_URL }) },
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'version-generator',
      writeBundle() {
        fs.writeFileSync('dist/version.json', JSON.stringify({ version: Date.now() }));
      }
    }
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // manualChunks HARUS berupa fungsi
        manualChunks(id) {
          // Pisahkan library dari node_modules
          if (id.includes('node_modules')) {
            // Kelompokkan berdasarkan library besar
            if (id.includes('recharts')) return 'charts';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('pocketbase')) return 'pocketbase';
            // Sisanya masuk ke vendor
            return 'vendor';
          }
          // Biarkan komponen aplikasi tetap di chunk masing-masing (dengan lazy loading sudah cukup)
        },
      },
    },
  },
  optimizeDeps: {
    include: ['recharts', 'lucide-react'],
  },
});