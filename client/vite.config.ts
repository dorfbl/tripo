import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TRIPO',
        short_name: 'TRIPO',
        description: 'תכנון טיולים קבוצתיים',
        theme_color: '#4F6EF7',
        background_color: '#4F6EF7',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'he',
        dir: 'rtl',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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
