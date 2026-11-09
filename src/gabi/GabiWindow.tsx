import { useEffect, useState } from 'react'
import { GabiLink } from '../show/channel'
import type { ShowState } from '../show/view'
import { GabiScreen } from './GabiScreen'

/** La ventana que va al monitor de piso. Escucha a la consola y no se toca. */
export function GabiWindow() {
  const [state, setState] = useState<ShowState | null>(null)

  useEffect(() => {
    document.title = 'Pantalla de Gabi · Garetto'
    document.documentElement.classList.add('is-gabi')
    const link = new GabiLink()
    const off = link.onState(setState)
    // pagehide también corre al cerrar la ventana: la consola se entera enseguida.
    const bye = () => link.close()
    window.addEventListener('pagehide', bye)
    return () => {
      window.removeEventListener('pagehide', bye)
      off()
      link.close()
    }
  }, [])

  // Doble clic: pantalla completa (por si hay que acomodarla a mano).
  const fullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <div className="gabi-window" onDoubleClick={fullscreen}>
      <GabiScreen state={state} waiting={state === null} />
    </div>
  )
}
