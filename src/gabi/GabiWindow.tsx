import { useEffect, useRef, useState } from 'react'
import { Maximize } from 'lucide-react'
import { useReducedMotion } from '../platform/motion'
import { useWakeLock } from '../platform/wakeLock'
import { GabiLink } from '../show/channel'
import type { ShowState } from '../show/view'
import { GabiScreen } from './GabiScreen'

/** El aviso de pantalla completa se esconde si no se mueve el mouse. */
const HINT_MS = 8000

/** Pantalla completa con la API o con F11 (que no avisa por fullscreenElement). */
function isFullscreen() {
  return (
    !!document.fullscreenElement ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.innerWidth >= screen.width && window.innerHeight >= screen.height)
  )
}

/** La ventana que va al monitor de piso. Escucha a la consola y no se toca. */
export function GabiWindow() {
  const [state, setState] = useState<ShowState | null>(null)
  const [fullscreen, setFullscreen] = useState(isFullscreen)
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [hint, setHint] = useState(true)
  const wakeLock = useWakeLock(true)
  useReducedMotion(state?.device.reduceMotion ?? false)
  const link = useRef<GabiLink | null>(null)

  useEffect(() => {
    document.title = 'Pantalla de Gabi · Garetto'
    document.documentElement.classList.add('is-gabi')
    const l = new GabiLink()
    link.current = l
    const off = l.onState(setState)
    // pagehide también corre al cerrar la ventana: la consola se entera enseguida.
    const bye = () => l.close()
    window.addEventListener('pagehide', bye)
    return () => {
      window.removeEventListener('pagehide', bye)
      off()
      l.close()
      link.current = null
    }
  }, [])

  // Tamaño y pantalla completa, para contarle a la consola.
  useEffect(() => {
    const update = () => {
      setFullscreen(isFullscreen())
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', update)
    document.addEventListener('fullscreenchange', update)
    return () => {
      window.removeEventListener('resize', update)
      document.removeEventListener('fullscreenchange', update)
    }
  }, [])

  useEffect(() => {
    link.current?.setInfo({ fullscreen, ...size, wakeLock })
  }, [fullscreen, size, wakeLock])

  // Mientras no esté en pantalla completa, un aviso que aparece al mover el mouse.
  useEffect(() => {
    if (fullscreen) return
    let t = setTimeout(() => setHint(false), HINT_MS)
    const show = () => {
      setHint(true)
      clearTimeout(t)
      t = setTimeout(() => setHint(false), HINT_MS)
    }
    window.addEventListener('pointermove', show)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', show)
    }
  }, [fullscreen])

  // Un clic pone la pantalla completa (el navegador la pide con un clic en esta ventana).
  const goFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const showHint = !fullscreen && hint
  return (
    <div className="gabi-window" data-hint={showHint || undefined} onClick={goFullscreen}>
      <GabiScreen state={state} waiting={state === null} />
      {showHint && (
        <div className="gabi-hint" role="status">
          <Maximize aria-hidden />
          <div>
            <b>Hacé clic acá para pantalla completa</b>
            <span>Si esta ventana no está en el monitor de Gabi, arrastrala primero. También sirve F11.</span>
          </div>
        </div>
      )}
    </div>
  )
}
