import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdvanceMode, DeviceSettings, Song } from '../data/types'
import { ConsoleLink } from './channel'
import * as cursor from './cursor'
import { buildLyricView, type GabiStyle, type Overlay, type ShowState } from './view'

export const MESSAGE_MS = 6000

/**
 * Estado del show del lado de la consola: canción, paso actual, modo, carteles.
 * Publica cada cambio a la pantalla de Gabi por el canal.
 */
export function useShow(song: Song | null, opts: { defaultMode: AdvanceMode; nextSong?: string | null }) {
  const [mode, setModeState] = useState<AdvanceMode>(song?.advanceMode ?? opts.defaultMode)
  const [marcar, setMarcarState] = useState(true)
  const [index, setIndex] = useState(0)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [style, setStyle] = useState<GabiStyle>('a')
  const [device, setDevice] = useState<DeviceSettings>({ rotation: 0, mirror: false, marginPct: 0 })
  const [connected, setConnected] = useState(false)
  const [atEnd, setAtEnd] = useState(false)

  const sections = useMemo(() => song?.sections ?? [], [song])
  const steps = useMemo(() => cursor.buildSteps(sections, { mode, marcar }), [sections, mode, marcar])
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

  // Canción nueva: vuelve al comienzo con el modo guardado en la canción.
  const [loadedId, setLoadedId] = useState(song?.id)
  if (song?.id !== loadedId) {
    setLoadedId(song?.id)
    setIndex(0)
    setAtEnd(false)
    setModeState(song?.advanceMode ?? opts.defaultMode)
  }

  // Los carteles con tiempo se apagan solos.
  useEffect(() => {
    if (!overlay) return
    const until =
      overlay.kind === 'mensaje' ? overlay.shownAt + overlay.durationMs : overlay.kind === 'cuenta' ? overlay.endsAt + 600 : null
    if (until === null) return
    const t = setTimeout(() => setOverlay((o) => (o === overlay ? null : o)), Math.max(0, until - Date.now()))
    return () => clearTimeout(t)
  }, [overlay])

  const go = useCallback((to: number | null, end = false) => {
    if (to === null) {
      if (end) setAtEnd(true)
      return
    }
    setAtEnd(false)
    setIndex(to)
  }, [])

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

  return {
    state,
    steps,
    index,
    mode,
    marcar,
    style,
    device,
    overlay,
    connected,
    /** Se intentó avanzar desde el último paso: la consola puede pasar al tema siguiente. */
    atEnd,
    actions: {
      next: () => go(cursor.next(steps, index), true),
      prev: () => go(cursor.prev(steps, index)),
      nextPart: () => go(cursor.nextPart(steps, index), true),
      prevPart: () => go(cursor.prevPart(steps, index)),
      goTo: (i: number) => go(Math.max(0, Math.min(steps.length - 1, i))),
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
      setStyle,
      setDevice,
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
