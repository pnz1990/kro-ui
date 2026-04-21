/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Vendor chunk: keep large stable deps separate from app code.
        // react + react-dom + react-router-dom share a chunk so they are
        // loaded once and cached independently of page-specific chunks.
        manualChunks(id) {
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/dagre') ||
              id.includes('node_modules/graphlib') ||
              id.includes('node_modules/lodash')) {
            return 'vendor-dag'
          }
        },
      },
    },
  },
  server: {
    // In dev, proxy API calls to the Go server
    proxy: {
      '/api': 'http://localhost:40107',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
})
