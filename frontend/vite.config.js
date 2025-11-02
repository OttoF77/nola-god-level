import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
