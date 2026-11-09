import { useEffect, useState } from 'react'
import { GabiWindow } from './gabi/GabiWindow'
import { Ensayo } from './show/Ensayo'
import { Sistema } from './sistema/Sistema'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

// Rutas con # para que funcionen en GitHub Pages y sin servidor.
export default function App() {
  const hash = useHash()
  if (hash === '#/gabi') return <GabiWindow />
  if (hash === '#/sistema') return <Sistema />
  return <Ensayo />
}
