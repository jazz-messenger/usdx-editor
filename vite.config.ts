import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/usdx-editor/',
  server: {
    proxy: {
      // Dev only: Vite cannot execute PHP, so forward the YouTube search
      // proxy to production. No local key file or PHP runtime needed —
      // requires yt-search.php to be deployed on korczak.at once.
      '/usdx-editor/api': {
        target: 'https://korczak.at',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
