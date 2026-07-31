import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = __dirname
const sharedRoot = path.resolve(__dirname, '../lmsbox.client')
const sharedSrc = path.resolve(sharedRoot, 'src')
const sharedPublic = path.resolve(sharedRoot, 'public')
const clientModules = path.resolve(clientRoot, 'node_modules')

// Shared @lms sources live under lmsbox.client; without these aliases Vite resolves
// react/* from that project's node_modules and we get two React copies (invalid hook call).
const reactAliases = {
  react: path.resolve(clientModules, 'react'),
  'react-dom': path.resolve(clientModules, 'react-dom'),
  'react/jsx-runtime': path.resolve(clientModules, 'react/jsx-runtime.js'),
  'react/jsx-dev-runtime': path.resolve(clientModules, 'react/jsx-dev-runtime.js'),
}

const reactDedupe = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-hot-toast',
  'react-helmet',
  'react-hook-form',
  'react-chartjs-2',
  'react-easy-crop',
  'react-google-recaptcha',
  'react-image-crop',
  'react-toastify',
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: sharedPublic,
  resolve: {
    alias: {
      '@lms': sharedSrc,
      ...reactAliases,
    },
    dedupe: reactDedupe,
  },
  optimizeDeps: {
    include: reactDedupe,
  },
  server: {
    fs: {
      allow: [clientRoot, sharedRoot],
    },
    port: 5176,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5133',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
