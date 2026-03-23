import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/algos':      'http://localhost:3001',
      '/webhook':    'http://localhost:3001',
      '/scripts':    'http://localhost:3001',
      '/settings':   'http://localhost:3001',
      '/auth':       'http://localhost:3001',
      '/billing':    'http://localhost:3001',
      '/public-url': 'http://localhost:3001',
    },
  },
})
