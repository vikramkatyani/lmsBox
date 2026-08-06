import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@import-engine': path.resolve(__dirname, '../import-engine'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5132',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
