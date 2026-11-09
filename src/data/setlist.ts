/*
 * Operaciones sobre los ítems de un setlist. Funciones puras: devuelven una
 * lista nueva y no tocan la original.
 *
 * Un ítem es un tema suelto o un enganchado (varios temas seguidos, sin pausa).
 * La consola recorre el setlist como una lista plana de "entradas", una por tema.
 */
import type { SetlistItem } from './types'

export interface Entry {
  songId: string
  /** Índice del ítem en el setlist. */
  item: number
  /** Si el tema es parte de un enganchado: cuál y en qué posición. */
  eng: { id: string; name: string; pos: number; count: number } | null
}

export type NewId = () => string
const uuid: NewId = () => crypto.randomUUID()

export const DEFAULT_ENG_NAME = 'Enganchado'

/** Todos los temas en orden, aplanando los enganchados. */
export function entries(items: SetlistItem[]): Entry[] {
  return items.flatMap((it, item): Entry[] =>
    it.type === 'song'
      ? [{ songId: it.songId, item, eng: null }]
      : it.songIds.map((songId, pos) => ({
          songId,
          item,
          eng: { id: it.id, name: it.name, pos, count: it.songIds.length },
        })),
  )
}

const songIdsOf = (it: SetlistItem) => (it.type === 'song' ? [it.songId] : it.songIds)

/** Un enganchado de un solo tema vuelve a ser un tema suelto. */
function normalize(it: SetlistItem): SetlistItem | null {
  if (it.type === 'song') return it
  if (it.songIds.length === 0) return null
  if (it.songIds.length === 1) return { type: 'song', songId: it.songIds[0] }
  return it
}

/** Agrega un tema al final, o antes del ítem `at`. */
export function addSong(items: SetlistItem[], songId: string, at = items.length): SetlistItem[] {
  const next = [...items]
  next.splice(Math.max(0, Math.min(at, items.length)), 0, { type: 'song', songId })
  return next
}

/** Saca la entrada (un tema), aunque esté dentro de un enganchado. */
export function removeEntry(items: SetlistItem[], entryIndex: number): SetlistItem[] {
  const e = entries(items)[entryIndex]
  if (!e) return items
  return items.flatMap((it, i): SetlistItem[] => {
    if (i !== e.item) return [it]
    if (it.type === 'song') return []
    const kept = normalize({ ...it, songIds: it.songIds.filter((_, p) => p !== e.eng?.pos) })
    return kept ? [kept] : []
  })
}

/** Mueve un ítem entero (un enganchado se mueve como bloque). */
export function moveItem(items: SetlistItem[], from: number, to: number): SetlistItem[] {
  if (from === to || from < 0 || from >= items.length) return items
  const next = [...items]
  const [it] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, it)
  return next
}

/**
 * Engancha el ítem con el siguiente: dos temas sueltos forman un enganchado
 * nuevo; si alguno ya era un enganchado, se suman.
 */
export function linkWithNext(items: SetlistItem[], itemIndex: number, newId: NewId = uuid): SetlistItem[] {
  const a = items[itemIndex]
  const b = items[itemIndex + 1]
  if (!a || !b) return items
  const base = a.type === 'enganchado' ? a : b.type === 'enganchado' ? b : null
  const joined: SetlistItem = {
    type: 'enganchado',
    id: base?.id ?? newId(),
    name: base?.name ?? DEFAULT_ENG_NAME,
    songIds: [...songIdsOf(a), ...songIdsOf(b)],
  }
  const next = [...items]
  next.splice(itemIndex, 2, joined)
  return next
}

/** Separa un enganchado en temas sueltos. */
export function unlink(items: SetlistItem[], itemIndex: number): SetlistItem[] {
  const it = items[itemIndex]
  if (!it || it.type !== 'enganchado') return items
  const next = [...items]
  next.splice(itemIndex, 1, ...it.songIds.map((songId): SetlistItem => ({ type: 'song', songId })))
  return next
}

export function renameEng(items: SetlistItem[], engId: string, name: string): SetlistItem[] {
  const clean = name.trim() || DEFAULT_ENG_NAME
  return items.map((it) => (it.type === 'enganchado' && it.id === engId ? { ...it, name: clean } : it))
}

/** Saca de los ítems los temas que ya no existen (por ejemplo, borrados). */
export function withoutMissing(items: SetlistItem[], exists: (songId: string) => boolean): SetlistItem[] {
  return items.flatMap((it): SetlistItem[] => {
    if (it.type === 'song') return exists(it.songId) ? [it] : []
    const kept = normalize({ ...it, songIds: it.songIds.filter(exists) })
    return kept ? [kept] : []
  })
}

/** "1:05:30" o "4:10". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
