import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true, // Useful for debugging production crashes
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
})
