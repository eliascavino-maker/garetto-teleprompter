import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdvanceMode, DeviceSettings, Song } from '../data/types'
import { ConsoleLink } from './channel'
import * as cursor from './cursor'
import { buildLyricView, type GabiStyle, type Overlay, type ShowState } from './view'

export const MESSAGE_MS = 6000

export interface UseShowOptions {
  defaultMode: AdvanceMode
  /** Título del tema que sigue, para "Sigue: …" en la última parte. */
  nextSong?: string | null
  /** Dónde arrancar al cargar una canción (por ejemplo, para retomar después de recargar). */
  startAt?: (songId: string) => cursor.Step | null
  /** Cambia cuando se carga otro tema, aunque sea la misma canción. Por defecto, el id. */
  loadKey?: string
  /** Estilo de la pantalla (ajuste de la banda) y montaje del monitor (ajuste del equipo). */
  style: GabiStyle
  device: DeviceSettings
}

/**
 * Estado del show del lado de la consola: canción, paso actual, modo, carteles.
 * Publica cada cambio a la pantalla de Gabi por el canal.
 */
export function useShow(song: Song | null, opts: UseShowOptions) {
  const [mode, setModeState] = useState<AdvanceMode>(song?.advanceMode ?? opts.defaultMode)
  const [marcar, setMarcarState] = useState(true)
  const [rawIndex, setIndex] = useState(0)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const { style, device } = opts
  const [connected, setConnected] = useState(false)

  const sections = useMemo(() => song?.sections ?? [], [song])
  const steps = useMemo(() => cursor.buildSteps(sections, { mode, marcar }), [sections, mode, marcar])
  // Si la letra cambió y el paso quedó afuera, se queda en el último.
  const index = Math.max(0, Math.min(rawIndex, steps.length - 1))

  // Canción nueva: modo de la canción (o el de la consola) y arranca al comienzo o donde se pida.
  // loadKey distingue el mismo tema repetido en dos lugares del setlist.
  const loadKey = song ? (opts.loadKey ?? song.id) : undefined
  const [loadedKey, setLoadedKey] = useState<string | undefined>(undefined)
  if (loadKey !== loadedKey) {
    setLoadedKey(loadKey)
    const nextMode = song?.advanceMode ?? opts.defaultMode
    setModeState(nextMode)
    const start = song ? opts.startAt?.(song.id) : null
    setIndex(start ? cursor.findStep(cursor.buildSteps(sections, { mode: nextMode, marcar }), start) : 0)
  }

  const lyric = useMemo(
    () => (song ? buildLyricView(sections, steps, index, { mode, marcar }, opts.nextSong ?? null) : null),
    [song, sections, steps, index, mode, marcar, opts.nextSong],
  )

  // Canal: uno por consola abierta.
  const link = useRef<ConsoleLink | null>(null)
  useEffect(() => {
    const l = new ConsoleLink()
    link.current = l
    const off = l.onStatus(setConnected)
    return () => {
      off()
      l.close()
      link.current = null
    }
  }, [])

  // El seq nunca baja de la hora actual: si la consola se recarga, sigue creciendo
  // y la pantalla no descarta los estados nuevos por viejos.
  const seq = useRef(0)
  const state: ShowState = useMemo(
    () => ({ seq: 0, title: song?.title ?? null, lyric, overlay, style, device }),
    [song, lyric, overlay, style, device],
  )
  useEffect(() => {
    seq.current = Math.max(seq.current + 1, Date.now())
    link.current?.publish({ ...state, seq: seq.current })
  }, [state])

  // Los carteles con tiempo se apagan solos.
  useEffect(() => {
    if (!overlay) return
    const until =
      overlay.kind === 'mensaje' ? overlay.shownAt + overlay.durationMs : overlay.kind === 'cuenta' ? overlay.endsAt + 600 : null
    if (until === null) return
    const t = setTimeout(() => setOverlay((o) => (o === overlay ? null : o)), Math.max(0, until - Date.now()))
    return () => clearTimeout(t)
  }, [overlay])

  // Cambiar de modo conserva el lugar.
  const reposition = useCallback(
    (nextMode: AdvanceMode, nextMarcar: boolean) => {
      const pos = steps[index]
      const nextSteps = cursor.buildSteps(sections, { mode: nextMode, marcar: nextMarcar })
      setIndex(pos ? cursor.findStep(nextSteps, pos) : 0)
    },
    [steps, index, sections],
  )

  const toggle = (kind: 'negro' | 'logo') => setOverlay((o) => (o?.kind === kind ? null : { kind }))

  /** Mueve al paso; devuelve false si no hay adónde ir (comienzo o final del tema). */
  const go = (to: number | null) => {
    if (to === null) return false
    setIndex(to)
    return true
  }

  return {
    state,
    steps,
    index,
    step: steps[index] as cursor.Step | undefined,
    mode,
    marcar,
    style,
    device,
    overlay,
    connected,
    actions: {
      next: () => go(cursor.next(steps, index)),
      prev: () => go(cursor.prev(steps, index)),
      nextPart: () => go(cursor.nextPart(steps, index)),
      prevPart: () => go(cursor.prevPart(steps, index)),
      goTo: (i: number) => go(Math.max(0, Math.min(steps.length - 1, i))),
      goToEnd: () => go(steps.length - 1),
      setMode: (m: AdvanceMode) => {
        reposition(m, marcar)
        setModeState(m)
      },
      toggleMode: () => {
        const m = mode === 'linea' ? 'parte' : 'linea'
        reposition(m, marcar)
        setModeState(m)
      },
      setMarcar: (v: boolean) => {
        reposition(mode, v)
        setMarcarState(v)
      },

      toggleNegro: () => toggle('negro'),
      toggleLogo: () => toggle('logo'),
      message: (text: string) =>
        setOverlay((o) =>
          o?.kind === 'mensaje' && o.text === text ? null : { kind: 'mensaje', text, shownAt: Date.now(), durationMs: MESSAGE_MS },
        ),
      countdown: (seconds: number, label: string | null = null) =>
        setOverlay({ kind: 'cuenta', endsAt: Date.now() + seconds * 1000, label }),
      clearOverlay: () => setOverlay(null),
    },
  }
}

export type ShowController = ReturnType<typeof useShow>
