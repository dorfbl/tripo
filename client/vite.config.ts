import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  envDir: '../',   // .env נמצא בשורש הפרויקט, לא ב-client/
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,      // SW חדש לא ממתין — מפעיל מיד
        clientsClaim: true,     // לוקח שליטה על כל הtabs מיד
        // אל תשמור cache על HTML — תמיד טען מהרשת
        navigateFallbackDenylist: [/^\/uploads\//],
        runtimeCaching: [
          {
            // API reads — network first, fallback to cache when offline
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tripo-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tripo-uploads',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'TRIPO',
        short_name: 'TRIPO',
        description: 'תכנון טיולים קבוצתיים',
        theme_color: '#4F6EF7',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'he',
        dir: 'rtl',
        icons: [
          { src: '/icons/icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/apple-touch-icon-v2.png', sizes: '180x180', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ['trip.kefar-sava.co.il', 'localhost'],
    // proxy רק בפיתוח מקומי — בייצור nginx מנתב /api → server
    proxy: {
      '/api': {
        target: 'http://localhost:3018',
        changeOrigin: true,
      },
    },
  },
})
