import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'CashCtrl',
        short_name: 'CashCtrl',
        description: 'Gestion financière personnelle',
        lang: 'fr',
        theme_color: '#141210',
        background_color: '#141210',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/logos': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Isole les dépendances stables dans des chunks dédiés : elles changent
        // rarement, donc le navigateur les garde en cache entre deux déploiements
        // (seul le chunk applicatif est réinvalidé). recharts est déjà code-splitté
        // via les imports lazy du Dashboard, on le laisse à Rollup.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/@tanstack/')) return 'query-vendor';
          if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'i18n-vendor';
        },
      },
    },
  },
});
