/*
 * Borrador del editor: los campos de la canción como los escribe el usuario
 * (la duración como "4:10", la letra como texto) y las operaciones sobre el
 * texto que hacen los botones de la barra.
 */
import { CUE_TEXT, extractCues, parseHeader, sectionsToText } from '../data/parser'
import { LIMITS, type AdvanceMode, type CueKind, type Section, type Song, type SongKind } from '../data/types'

export interface Draft {
  title: string
  artist: string
  kind: SongKind
  /** Como se escribe: "4:10". Vacío si no se sabe. */
  duration: string
  advanceMode: AdvanceMode | null
  notes: string
  text: string
}

export function draftFromSong(song: Song): Draft {
  return {
    title: song.title,
    artist: song.artist ?? '',
    kind: song.kind,
    duration: song.durationSeconds == null ? '' : formatDurationInput(song.durationSeconds),
    advanceMode: song.advanceMode,
    notes: song.notes ?? '',
    text: sectionsToText(song.sections),
  }
}

export function formatDurationInput(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * "4:10", "4.10" o "4" (minutos). Devuelve null si está vacío y undefined si
 * no se entiende.
 */
export function parseDuration(input: string): number | null | undefined {
  const t = input.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})(?:[:.,'](\d{1,2}))?$/)
  if (!m) return undefined
  const secs = Number(m[2] ?? 0)
  if (m[2] !== undefined && (m[2].length !== 2 || secs > 59)) return undefined
  const total = Number(m[1]) * 60 + secs
  return total <= LIMITS.durationMax ? total : undefined
}

export interface DraftErrors {
  title?: string
  duration?: string
}

export function draftErrors(d: Draft): DraftErrors {
  const errors: DraftErrors = {}
  if (!d.title.trim()) errors.title = 'Falta el título'
  if (parseDuration(d.duration) === undefined) errors.duration = 'Escribila como 4:10'
  return errors
}

/** La canción con los cambios del borrador. Las partes ya vienen leídas del texto. */
export function applyDraft(song: Song, d: Draft, sections: Section[]): Song {
  return {
    ...song,
    title: d.title.trim(),
    artist: d.artist.trim() || null,
    kind: d.kind,
    durationSeconds: parseDuration(d.duration) ?? null,
    advanceMode: d.advanceMode,
    notes: d.notes.trim() || null,
    sections,
  }
}

/* ---------- Operaciones sobre el texto ---------- */

export interface TextEdit {
  text: string
  /** Dónde queda el cursor. */
  caret: number
}

function lineAt(text: string, caret: number) {
  const start = text.lastIndexOf('\n', caret - 1) + 1
  const nl = text.indexOf('\n', caret)
  const end = nl === -1 ? text.length : nl
  return { start, end, line: text.slice(start, end) }
}

export type LineContext =
  | { type: 'empty' }
  | { type: 'header'; x2: boolean }
  | { type: 'lyric'; cues: CueKind[] }

/** Qué hay en el renglón del cursor, para prender o apagar los botones. */
export function lineContext(text: string, caret: number): LineContext {
  const { line } = lineAt(text, caret)
  if (!line.trim()) return { type: 'empty' }
  const header = parseHeader(line)
  if (header) return { type: 'header', x2: header.cues.includes('x2') }
  return { type: 'lyric', cues: extractCues(line).cues }
}

const CUE_ORDER: CueKind[] = ['x2', 'corte', 'silencio', 'solo']

/**
 * Pone o saca una indicación en el renglón del cursor. En un encabezado solo
 * vale ×2 ("[Coro x2]").
 */
export function toggleCue(text: string, caret: number, cue: CueKind): TextEdit {
  const { start, end, line } = lineAt(text, caret)
  const ctx = lineContext(text, caret)
  let next: string
  if (ctx.type === 'header') {
    if (cue !== 'x2') return { text, caret }
    const h = parseHeader(line)
    if (!h) return { text, caret }
    next = `[${h.label}${ctx.x2 ? '' : ' x2'}]`
  } else if (ctx.type === 'lyric') {
    const { text: words, cues } = extractCues(line)
    const set = cues.includes(cue) ? cues.filter((c) => c !== cue) : [...cues, cue]
    next = [words, ...CUE_ORDER.filter((c) => set.includes(c)).map((c) => CUE_TEXT[c])].join(' ')
  } else {
    return { text, caret }
  }
  return { text: text.slice(0, start) + next + text.slice(end), caret: start + next.length }
}

/**
 * Marca dónde empieza una parte. Si el cursor está en el primer renglón de un
 * bloque, el encabezado va arriba (o reemplaza al que había); si está en el
 * medio, el bloque se parte en dos.
 */
export function insertSection(text: string, caret: number, label: string): TextEdit {
  const { start, end, line } = lineAt(text, caret)
  const header = `[${label}]`
  if (!line.trim()) {
    // Renglón vacío: el encabezado arranca el bloque que sigue, separado del de arriba.
    const before = text.slice(0, start)
    const prevHasText = start > 0 && lineAt(text, start - 1).line.trim() !== ''
    const insert = (prevHasText ? '\n' : '') + header
    const rest = text.slice(end)
    return { text: before + insert + (rest || '\n'), caret: before.length + insert.length + 1 }
  }
  if (parseHeader(line)) {
    return { text: text.slice(0, start) + header + text.slice(end), caret: start + header.length + 1 }
  }
  const prevLine = start === 0 ? '' : lineAt(text, start - 1).line
  const startsBlock = !prevLine.trim()
  const insert = startsBlock ? `${header}\n` : `\n${header}\n`
  return { text: text.slice(0, start) + insert + text.slice(start), caret: start + insert.length }
}

/**
 * Si la letra pegada arranca con un renglón corto y suelto (sin encabezado),
 * probablemente es el título. Devuelve ese renglón para ofrecerlo.
 */
export function titleCandidate(text: string): string | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const first = lines.findIndex((l) => l.trim())
  if (first === -1) return null
  const line = lines[first].trim()
  const blankAfter = !lines[first + 1]?.trim()
  if (!blankAfter || line.length > 60 || parseHeader(line) || /[,.;]$/.test(line)) return null
  // Tiene que haber más letra después.
  return lines.slice(first + 1).some((l) => l.trim()) ? line : null
}

/** Saca el título del principio del texto. */
export function removeTitleLine(text: string): string {
  return text.replace(/^\s*[^\n]*\n\s*\n?/, '')
}
