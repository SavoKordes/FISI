/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base: the build runs unchanged on GitHub Pages (/FISI/), Netlify (/)
// or in any Apache subfolder. Routing uses HashRouter, so no rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FISI-Prüfungstrainer',
        short_name: 'FISI-Trainer',
        description: 'Lernen für die IHK-Abschlussprüfung Teil 2 – Fachinformatiker/-in Systemintegration',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Inhalte und Bibliotheken getrennt: Inhalts-Updates invalidieren nicht den Vendor-Cache
        manualChunks(id) {
          if (id.includes('/src/content/') && id.endsWith('.json')) return 'content';
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(dexie|dexie-react-hooks|ts-fsrs)\//.test(id)) return 'data';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
