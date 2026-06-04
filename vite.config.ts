import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    // Tambahkan lodash agar Vite juga ikut memperbaiki modul di dalamnya
    include: ['recharts', 'lodash'] 
  }
})