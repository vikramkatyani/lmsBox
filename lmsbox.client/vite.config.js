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
// deps relative to that folder (where CI never runs npm install) and fails.
const sharedAliases = {
  react: path.resolve(clientModules, 'react'),
  'react-dom': path.resolve(clientModules, 'react-dom'),
  'react/jsx-runtime': path.resolve(clientModules, 'react/jsx-runtime.js'),
  'react/jsx-dev-runtime': path.resolve(clientModules, 'react/jsx-dev-runtime.js'),
  jszip: path.resolve(clientModules, 'jszip'),
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@import-engine': importEngineRoot,
      ...sharedAliases,
    },
    dedupe: ['react', 'react-dom', 'jszip'],
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
