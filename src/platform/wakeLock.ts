import { useEffect, useState } from 'react'

const supported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Pide que la pantalla no se apague mientras `active` sea true. El navegador
 * suelta el pedido si la ventana se oculta; al volver se pide de nuevo.
 * Devuelve true si se consiguió, false si no, y null si el navegador no lo tiene.
 */
export function useWakeLock(active: boolean): boolean | null {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!active || !supported()) return
    let sentinel: WakeLockSentinel | null = null
    let stopped = false

    const request = async () => {
      if (stopped || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      try {
        const s = await navigator.wakeLock.request('screen')
        if (stopped) return void s.release()
        sentinel = s
        setHeld(true)
        s.addEventListener('release', () => {
          if (!stopped) setHeld(false)
        })
      } catch {
        // Sin permiso o con ahorro de batería: se reintenta al volver a la ventana.
        setHeld(false)
      }
    }

    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', request)
      void sentinel?.release()
    }
  }, [active])

  if (!supported()) return null
  return active && held
}
