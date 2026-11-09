/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// La app vive en https://<usuario>.github.io/garetto-teleprompter/. Se usa la
// misma ruta en desarrollo y en preview para que todo se comporte igual.
export default defineConfig({
  base: '/garetto-teleprompter/',
  plugins: [
    react(),
    VitePWA({
      // Nunca se actualiza sola: en pleno show no se puede recargar nada.
      // La consola avisa que hay una versión nueva y el operador decide.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gabi Garetto · Teleprompter',
        short_name: 'Teleprompter',
        description: 'Teleprompter de letras de La Garetto. Funciona sin internet.',
        lang: 'es-AR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#120f14',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo queda guardado, también mammoth, pdf.js y su worker (que se usan solo al importar).
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
