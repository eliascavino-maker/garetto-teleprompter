import { defineConfig } from '@playwright/test'

// Pruebas de punta a punta con las dos ventanas (consola y Gabi).
// Usa el Chrome instalado: es el navegador del show.
export const DEV_URL = 'http://localhost:5199/garetto-teleprompter/'
// El build de producción, con el service worker: para probar sin internet.
export const PREVIEW_URL = 'http://localhost:5198/garetto-teleprompter/'

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: DEV_URL,
    channel: 'chrome',
    viewport: { width: 1366, height: 768 },
  },
  webServer: [
    {
      command: 'npx vite --port 5199 --strictPort',
      url: DEV_URL,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite build --logLevel warn && npx vite preview --port 5198 --strictPort',
      url: PREVIEW_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
