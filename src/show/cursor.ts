/*
 * Avance por la letra. Funciones puras: la consola guarda el índice del paso
 * actual y recalcula los pasos cuando cambia la canción o el modo.
 *
 *   - Por línea: un paso por línea.
 *   - Por parte: un paso por pantalla (la parte entera, o media si no entra).
 *   - Por parte con "marcar la línea": la parte entera en pantalla, pero se
 *     avanza línea por línea para resaltar la actual.
 *
 * Las partes sin letra (un solo instrumental) son un paso propio.
 */
import type { AdvanceMode, Section } from '../data/types'

/** Máximo de líneas por pantalla en modo parte. Con más, la parte se divide ("1/2"). */
export const PAGE_LINES = 8

export interface Step {
  section: number
  page: number
  /** Línea dentro de la parte, o null si el paso muestra la parte entera. */
  line: number | null
}

export interface StepOptions {
  mode: AdvanceMode
  marcar: boolean
}

/** Divide n líneas en pantallas parejas de hasta PAGE_LINES: 10 → 5 + 5, no 8 + 2. */
export function pageRanges(count: number): Array<[start: number, end: number]> {
  if (count <= PAGE_LINES) return [[0, count]]
  const pages = Math.ceil(count / PAGE_LINES)
  const size = Math.ceil(count / pages)
  const ranges: Array<[number, number]> = []
  for (let start = 0; start < count; start += size) ranges.push([start, Math.min(count, start + size)])
  return ranges
}

export function pageOfLine(count: number, line: number): number {
  return pageRanges(count).findIndex(([start, end]) => line >= start && line < end)
}

export function buildSteps(sections: Section[], { mode, marcar }: StepOptions): Step[] {
  const steps: Step[] = []
  sections.forEach((s, section) => {
    const count = s.lines.length
    if (count === 0) {
      steps.push({ section, page: 0, line: null })
    } else if (mode === 'linea' || marcar) {
      for (let line = 0; line < count; line++) steps.push({ section, page: pageOfLine(count, line), line })
    } else {
      pageRanges(count).forEach((_, page) => steps.push({ section, page, line: null }))
    }
  })
  return steps
}

/**
 * Busca el paso que corresponde a una posición, por ejemplo al cambiar de modo.
 * Si no hay uno exacto, va a la pantalla que contiene esa línea o al comienzo de la parte.
 */
export function findStep(steps: Step[], pos: Step): number {
  if (pos.line !== null) {
    const sameLine = steps.findIndex((s) => s.section === pos.section && s.line === pos.line)
    if (sameLine >= 0) return sameLine
  }
  const samePage = steps.findIndex((s) => s.section === pos.section && s.page === pos.page)
  if (samePage >= 0) return samePage
  const nextSection = steps.findIndex((s) => s.section >= pos.section)
  return nextSection >= 0 ? nextSection : Math.max(0, steps.length - 1)
}

/** Siguiente paso, o null al final de la canción. */
export function next(steps: Step[], i: number): number | null {
  return i + 1 < steps.length ? i + 1 : null
}

/** Paso anterior, o null al comienzo de la canción. */
export function prev(_steps: Step[], i: number): number | null {
  return i > 0 ? i - 1 : null
}

/** Primer paso de la parte siguiente (Shift), o null si es la última. */
export function nextPart(steps: Step[], i: number): number | null {
  const current = steps[i]?.section ?? -1
  const j = steps.findIndex((s) => s.section > current)
  return j >= 0 ? j : null
}

/** Vuelve al comienzo de la parte; si ya está ahí, al comienzo de la anterior. */
export function prevPart(steps: Step[], i: number): number | null {
  const current = steps[i]?.section
  if (current === undefined) return null
  const start = steps.findIndex((s) => s.section === current)
  if (start < i) return start
  const prevSection = steps[i - 1]?.section
  if (prevSection === undefined) return null
  return steps.findIndex((s) => s.section === prevSection)
}
