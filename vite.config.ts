import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Content-Security-Policy for the production build. Injected at build time
// only — the Vite dev server needs inline scripts (react-refresh preamble)
// and a websocket for HMR, which this policy would block.
//
// Allowed external hosts and why:
//   www.youtube.com     — iframe player + its API script (useYouTubePlayer)
//   i.ytimg.com         — video thumbnails in the search results
//   *.mzstatic.com      — iTunes cover art (display + download via fetch)
//   musicbrainz.org     — year/genre lookup
//   itunes.apple.com    — cover search
//   ko-fi.com           — plain donation link only (form-action not needed);
//                         no Ko-fi script is loaded
// 'unsafe-inline' for styles: React inline style attributes (Tooltip
// positioning, dynamic canvas sizing).
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://*.mzstatic.com",
  "media-src 'self' blob:",
  "connect-src 'self' https://musicbrainz.org https://itunes.apple.com https://*.mzstatic.com",
  "frame-src https://www.youtube.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-csp',
      apply: 'build',
      transformIndexHtml() {
        return [{
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend' as const,
        }]
      },
    },
  ],
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
