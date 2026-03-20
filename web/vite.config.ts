import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // In dev, proxy API calls to the Go server
    proxy: {
      '/api': 'http://localhost:10174',
    },
  },
})
