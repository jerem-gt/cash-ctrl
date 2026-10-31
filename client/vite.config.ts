import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Textes du manifeste par langue : le français est le manifeste par défaut (`manifest.webmanifest`). */
const MANIFEST_TEXTS = {
  fr: { lang: 'fr', description: 'Gestion financière personnelle' },
  en: { lang: 'en', description: 'Personal finance management' },
};

/**
 * Manifeste anglais (`manifest.en.webmanifest`) : copie du manifeste généré par vite-plugin-pwa,
 * textes remplacés. Le client pointe `<link rel="manifest">` dessus quand l'interface est en anglais.
 */
function englishManifest(): Plugin {
  return {
    name: 'english-manifest',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const french = bundle['manifest.webmanifest'];
      if (french?.type !== 'asset') {
        this.error('manifest.webmanifest absent du build');
      }
      const generated = JSON.parse(String(french.source)) as Record<string, unknown>;
      const manifest = { ...generated, ...MANIFEST_TEXTS.en };
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.en.webmanifest',
        source: JSON.stringify(manifest),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/logos/],
      },
      manifest: {
        name: 'CashCtrl',
        short_name: 'CashCtrl',
        ...MANIFEST_TEXTS.fr,
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
    englishManifest(),
  ],
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
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
            id.includes('/react-router/')
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
