import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'coldi-mascot.jpg',
        'coldi-reading.jpg',
        'coldi-writing.jpg',
        'coldi-thinking.jpg',
        'coldi-music.jpg',
        'icon-192.png',
        'icon-512.png',
        'apple-touch-icon.png',
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,mjs,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: "Coldi's Corner",
        short_name: "Coldi's Corner",
        description: 'Tu biblioteca digital, apuntes, flashcards, calendario y glosario de estudio',
        lang: 'es-MX',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#FAF7FD',
        theme_color: '#9B6CE2',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  base: './',
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/build/**', '**/release/**', '**/electron/**'],
    },
  },
});
