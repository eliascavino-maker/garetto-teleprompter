/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// La app vive en https://<usuario>.github.io/garetto-teleprompter/. Se usa la
// misma ruta en desarrollo y en preview para que todo se comporte igual.
export default defineConfig({
  base: '/garetto-teleprompter/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
