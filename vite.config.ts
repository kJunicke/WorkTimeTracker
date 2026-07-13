/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves this as a *project site* under /<repo>/, so production
// asset URLs, the PWA manifest scope/start_url and the injected service-worker
// registration must all be rooted at that sub-path. Dev + preview stay at '/'.
// If the GitHub repo is renamed, update REPO_BASE to match.
const REPO_BASE = '/WorkTimeTracker/'

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? REPO_BASE : '/'
  return {
    base,
    plugins: [
      vue(),
      // Offline-first PWA (HANDOFF §2, §8). Precache the whole app shell so it
      // launches with no network (airplane mode). All data is local IndexedDB;
      // there are no runtime network calls to cache beyond the static assets.
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Arbeitszeit Tracker',
          short_name: 'Arbeitszeit',
          description:
            'Arbeitszeit erfassen, gesetzliche Pausen (§4 ArbZG) und Gleitzeit-Saldo — offline, nur auf dem Gerät.',
          lang: 'de',
          theme_color: '#6366f1',
          background_color: '#f6f6f9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
        },
        // Service worker only in production builds; test via `npm run preview`.
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.ts'],
    },
  }
})
