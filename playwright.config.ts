import { defineConfig } from '@playwright/test'

// Pruebas de punta a punta con las dos ventanas (consola y Gabi).
// Usa el Chrome instalado: es el navegador del show.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199/garetto-teleprompter/',
    channel: 'chrome',
    viewport: { width: 1366, height: 768 },
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199/garetto-teleprompter/',
    reuseExistingServer: true,
  },
})
