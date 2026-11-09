import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes autoalojadas: se empaquetan con la app y funcionan sin internet.
import '@fontsource-variable/montserrat/wght.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './styles/tokens.css'
import './styles/base.css'
import './ui/ui.css'
import App from './App.tsx'
import { store } from './data/store'

// La ventana de Gabi no usa la base: solo escucha a la consola.
if (window.location.hash !== '#/gabi') void store.init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
