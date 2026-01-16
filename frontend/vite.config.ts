import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// VitePWA REMOVIDO - Causava conflito com custom service-worker.js
// Agora usamos APENAS o service-worker.js custom em public/

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
