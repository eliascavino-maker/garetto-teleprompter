/*
 * Lo que se ve en la pantalla de Gabi. La consola lo arma y lo manda por el
 * canal: la ventana de Gabi solo lo dibuja, sin lógica de avance.
 */
import type { CueKind, DeviceSettings, Section, SectionKind } from '../data/types'
import { pageRanges, type Step, type StepOptions } from './cursor'

export interface ViewLine {
  id: string
  text: string
  cues: CueKind[]
}

export interface PartInfo {
  label: string
  kind: SectionKind
  cues: CueKind[]
}

export type LyricView =
  | {
      kind: 'linea'
      part: PartInfo
      prev: ViewLine | null
      now: ViewLine
      /** Hasta dos líneas siguientes, aunque sean de la parte que viene. */
      next: ViewLine[]
      sigue: string | null
      progress: number
    }
  | {
      kind: 'parte'
      part: PartInfo
      lines: ViewLine[]
      /** Línea resaltada si está activo "marcar la línea". */
      mark: string | null
      page: { n: number; total: number } | null
      sigue: string | null
      progress: number
    }
  | {
      /** Parte sin letra: solo, intro instrumental. */
      kind: 'instrumental'
      part: PartInfo
      next: ViewLine | null
      sigue: string | null
      progress: number
    }

export type Overlay =
  | { kind: 'negro' }
  | { kind: 'logo' }
  | { kind: 'mensaje'; text: string; shownAt: number; durationMs: number }
  | { kind: 'cuenta'; endsAt: number; label: string | null }

export type GabiStyle = 'a' | 'c'

/** Estado completo que la consola manda a la pantalla de Gabi en cada cambio. */
export interface ShowState {
  /** Crece en cada envío: la pantalla ignora estados viejos. */
  seq: number
  title: string | null
  /** null: no hay canción en curso y se ve la pantalla de espera. */
  lyric: LyricView | null
  overlay: Overlay | null
  style: GabiStyle
  device: DeviceSettings
}

const part = (s: Section): PartInfo => ({ label: s.label, kind: s.kind, cues: s.cues })
const line = (l: { id: string; text: string; cues: CueKind[] }): ViewLine => ({ id: l.id, text: l.text, cues: l.cues })

/**
 * Arma la vista del paso actual.
 * @param nextSong título del tema que sigue, para "Sigue: …" en la última parte.
 */
export function buildLyricView(
  sections: Section[],
  steps: Step[],
  index: number,
  opts: StepOptions,
  nextSong: string | null = null,
): LyricView | null {
  const step = steps[index]
  if (!step) return null
  const section = sections[step.section]
  const progress = (index + 1) / steps.length
  const sigue = sections[step.section + 1]?.label ?? nextSong

  // Todas las líneas en orden, para mirar antes y después cruzando partes.
  const flat = sections.flatMap((s, si) => s.lines.map((l, li) => ({ si, li, l })))
  const flatIndex = (si: number, li: number) => flat.findIndex((f) => f.si === si && f.li === li)

  if (section.lines.length === 0) {
    const after = flat.find((f) => f.si > step.section)
    return { kind: 'instrumental', part: part(section), next: after ? line(after.l) : null, sigue, progress }
  }

  if (opts.mode === 'linea') {
    const li = step.line ?? 0
    const at = flatIndex(step.section, li)
    return {
      kind: 'linea',
      part: part(section),
      prev: at > 0 ? line(flat[at - 1].l) : null,
      now: line(flat[at].l),
      next: flat.slice(at + 1, at + 3).map((f) => line(f.l)),
      sigue,
      progress,
    }
  }

  const ranges = pageRanges(section.lines.length)
  const [start, end] = ranges[step.page]
  return {
    kind: 'parte',
    part: part(section),
    lines: section.lines.slice(start, end).map(line),
    mark: step.line === null ? null : section.lines[step.line].id,
    page: ranges.length > 1 ? { n: step.page + 1, total: ranges.length } : null,
    sigue,
    progress,
  }
}
