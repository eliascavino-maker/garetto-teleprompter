import { useEffect } from 'react'

/*
 * Movimiento reducido: lo pide Windows ("Mostrar animaciones" apagado) o el
 * ajuste "Reducir movimiento" de este equipo. Las dos cosas terminan en
 * <html data-motion="reduced">, y el CSS mira solo ese atributo.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

export function isReducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced'
}

export function useReducedMotion(setting: boolean) {
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const apply = () => {
      if (setting || mq.matches) document.documentElement.dataset.motion = 'reduced'
      else delete document.documentElement.dataset.motion
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [setting])
}
