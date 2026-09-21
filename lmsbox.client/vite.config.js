import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = __dirname
const importEngineRoot = path.resolve(__dirname, '../import-engine')
const clientModules = path.resolve(clientRoot, 'node_modules')

// import-engine lives outside this package; without these aliases Vite resolves
// react/* relative to that folder and fails with "react/jsx-runtime" not found.
const reactAliases = {
  react: path.resolve(clientModules, 'react'),
  'react-dom': path.resolve(clientModules, 'react-dom'),
  'react/jsx-runtime': path.resolve(clientModules, 'react/jsx-runtime.js'),
  'react/jsx-dev-runtime': path.resolve(clientModules, 'react/jsx-dev-runtime.js'),
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@import-engine': importEngineRoot,
      ...reactAliases,
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'jszip'],
  },
  server: {
    fs: {
      allow: [clientRoot, importEngineRoot],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5132',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5132',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
