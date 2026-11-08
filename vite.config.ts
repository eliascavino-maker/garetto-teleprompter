import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// En el build, la app vive en https://<usuario>.github.io/garetto-teleprompter/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/garetto-teleprompter/' : '/',
  plugins: [react()],
}))
