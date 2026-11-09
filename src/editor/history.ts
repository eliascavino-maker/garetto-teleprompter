/*
 * Historial para deshacer y rehacer en el editor. Las ediciones seguidas en
 * el mismo campo se agrupan (escribir una palabra es un solo paso), hasta
 * una pausa de 1 s o un grupo de 4 s.
 */

export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Campo del último cambio, para agrupar lo que se escribe seguido. */
  group: { key: string; start: number; last: number } | null
}

const PAUSE_MS = 1000
const GROUP_MS = 4000
const LIMIT = 200

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], group: null }
}

/**
 * Registra un estado nuevo. Con `key` (por ejemplo "text") se agrupa con el
 * cambio anterior del mismo campo; sin `key` siempre es un paso aparte.
 */
export function record<T>(h: History<T>, next: T, key: string | null, now: number): History<T> {
  if (Object.is(next, h.present)) return h
  const g = h.group
  const coalesce = key !== null && g !== null && g.key === key && now - g.last < PAUSE_MS && now - g.start < GROUP_MS
  return {
    past: coalesce ? h.past : [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
    group: key === null ? null : coalesce && g ? { ...g, last: now } : { key, start: now, last: now },
  }
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1)
  if (prev === undefined) return h
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], group: null }
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future
  if (next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: rest, group: null }
}
