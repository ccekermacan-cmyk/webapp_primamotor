import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    include: ['recharts', 'lodash', 'lucide-react'],
  },
});