import { useCallback, useState } from 'react'
import type { Step } from '../show/cursor'

/*
 * Preferencias de esta consola, solo en este navegador: qué setlist está
 * abierto, por dónde va el show y el ancho de las columnas. Sirven para que
 * un recargo en pleno show vuelva al mismo lugar.
 */

export interface ConsolePrefs {
  setlistId: string | null
  /** Entrada (tema) del setlist en curso. */
  entry: number
  /** Posición dentro del tema, para retomar. */
  pos: { songId: string; step: Step } | null
  /** Cuándo arrancó el show (EN VIVO), o null. */
  showStartedAt: number | null
  /** Cuándo arrancó el tema actual. */
  songStartedAt: number | null
  columns: { setlist: number; controls: number }
}

const KEY = 'garetto-teleprompter:consola'

export const DEFAULT_PREFS: ConsolePrefs = {
  setlistId: null,
  entry: 0,
  pos: null,
  showStartedAt: null,
  songStartedAt: null,
  columns: { setlist: 280, controls: 380 },
}

function read(): ConsolePrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const saved = JSON.parse(raw) as Partial<ConsolePrefs>
    return { ...DEFAULT_PREFS, ...saved, columns: { ...DEFAULT_PREFS.columns, ...saved.columns } }
  } catch {
    return DEFAULT_PREFS
  }
}

function write(prefs: ConsolePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): la consola anda igual.
  }
}

/* ---------- Guía de primeros pasos ---------- */

export interface GuidePrefs {
  /** Se cerró: no vuelve a aparecer sola (se abre desde la ayuda). */
  dismissed: boolean
  /** Achicada a una pastilla. */
  collapsed: boolean
}

export const GUIDE_KEY = 'garetto-teleprompter:guia'

function readGuide(): GuidePrefs {
  try {
    return { dismissed: false, collapsed: false, ...JSON.parse(localStorage.getItem(GUIDE_KEY) ?? '{}') }
  } catch {
    return { dismissed: false, collapsed: false }
  }
}

export function useGuidePrefs() {
  const [guide, setGuide] = useState(readGuide)
  const update = useCallback((patch: Partial<GuidePrefs>) => {
    setGuide((g) => {
      const next = { ...g, ...patch }
      try {
        localStorage.setItem(GUIDE_KEY, JSON.stringify(next))
      } catch {
        // Sin almacenamiento la guía vuelve a aparecer la próxima vez; no pasa nada.
      }
      return next
    })
  }, [])
  return [guide, update] as const
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(read)
  const update = useCallback((patch: Partial<ConsolePrefs> | ((p: ConsolePrefs) => Partial<ConsolePrefs>)) => {
    setPrefs((p) => {
      const next = { ...p, ...(typeof patch === 'function' ? patch(p) : patch) }
      write(next)
      return next
    })
  }, [])
  return [prefs, update] as const
}
