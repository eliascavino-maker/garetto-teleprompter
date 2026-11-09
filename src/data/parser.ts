/*
 * Parser de letras: convierte texto plano en partes y líneas.
 *
 * Formato que entiende:
 *   - Una o más líneas en blanco separan partes.
 *   - Encabezados de parte: "[Coro]", "Coro:", "CORO", "(Estribillo)", "Coro x2".
 *     Entre corchetes vale cualquier nombre ("[Hablado]").
 *   - Un encabezado de coro solo, sin letra, repite el último coro.
 *   - Si una parte sin nombre aparece igual más de una vez, es el coro.
 *   - Indicaciones al final de una línea: (x2), ×2, (bis), (corte), (silencio), (solo).
 *     Una indicación sola en su renglón se pega a la línea de arriba.
 *   - Las líneas de acordes ("Am   G   C") se descartan.
 */
import type { CueKind, Line, Section, SectionKind } from './types'

export type NewId = () => string
const defaultId: NewId = () => crypto.randomUUID()

/* ---------- Normalización ---------- */

function normalizeText(text: string): string[] {
  return (
    text
      .replace(/\r\n?/g, '\n')
      .replace(/[​-‍﻿]/g, '')
      .replace(/[\t ]/g, ' ')
      .split('\n')
      // Separadores como "-----" o "* * *" cuentan como línea en blanco.
      .map((l) => (/^[\s\-_=*~.·•]+$/.test(l) && /[^\s.]/.test(l) ? '' : l.trimEnd()))
  )
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

/* ---------- Acordes ---------- */

const EN_CHORD = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|M)?\d*(\/[A-G][#b]?)?$/
const ES_CHORD = /^(Do|Re|Mi|Fa|Sol|La|Si)([#b]|m|maj|min|dim|aug|sus|add|\d)*(\/(Do|Re|Mi|Fa|Sol|La|Si)[#b]?)?$/
const ES_BARE = /^(Do|Re|Mi|Fa|Sol|La|Si)$/

/**
 * Una línea es de acordes si todos sus tokens son acordes y hay alguna señal
 * clara: un acorde en notación inglesa, uno con modificador ("Lam", "Sol7") o
 * los espacios largos típicos de un cancionero. Así "La la la" no se pierde.
 */
export function isChordLine(raw: string): boolean {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  if (!tokens.every((t) => EN_CHORD.test(t) || ES_CHORD.test(t))) return false
  const strong = tokens.some((t) => EN_CHORD.test(t) || (ES_CHORD.test(t) && !ES_BARE.test(t)))
  return strong || /\S {2,}\S/.test(raw.trim())
}

/* ---------- Indicaciones ---------- */

const CUE_WORDS: Record<string, CueKind> = {
  x2: 'x2',
  '×2': 'x2',
  bis: 'x2',
  corte: 'corte',
  silencio: 'silencio',
  solo: 'solo',
}

// Indicación al final de una línea: "(x2)", "[corte]", "x2", "×2".
const TRAILING_CUE = /\s*(?:[([]\s*(x\s?2|×\s?2|bis|corte|silencio|solo)\s*[)\]]|(?<=\s|^)(x2|×2))\s*$/i

function cueFrom(word: string): CueKind {
  return CUE_WORDS[word.toLowerCase().replace(/\s/g, '')]
}

/** Separa las indicaciones del final de una línea. */
export function extractCues(text: string): { text: string; cues: CueKind[] } {
  const cues: CueKind[] = []
  let rest = text
  for (let m = rest.match(TRAILING_CUE); m && m[0].length > 0; m = rest.match(TRAILING_CUE)) {
    const cue = cueFrom(m[1] ?? m[2])
    if (!cues.includes(cue)) cues.unshift(cue)
    rest = rest.slice(0, m.index)
  }
  return { text: collapse(rest), cues }
}

/* ---------- Encabezados ---------- */

const LABEL_WORDS: Array<[RegExp, SectionKind]> = [
  [/^(coro|estribillo)$/i, 'coro'],
  [/^(estrofa|verso)$/i, 'estrofa'],
  [/^(puente|pre-?coro|pre-?estribillo)$/i, 'puente'],
  [/^(intro|introducci[oó]n)$/i, 'intro'],
  [/^(solo|instrumental|interludio)$/i, 'solo'],
  [/^(final|outro|cierre|coda)$/i, 'final'],
]

function kindOf(word: string): SectionKind | null {
  for (const [re, kind] of LABEL_WORDS) if (re.test(word)) return kind
  return null
}

const REPEAT = /\s*[([]?\s*(?:x\s?2|×\s?2|bis)\s*[)\]]?\s*$/i

interface Header {
  label: string
  kind: SectionKind
  cues: CueKind[]
}

function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1).toLocaleLowerCase('es')
}

/** Arma el encabezado si el texto empieza con una palabra conocida ("coro 2 x2"). */
function knownHeader(content: string): Header | null {
  const cues: CueKind[] = REPEAT.test(content) ? ['x2'] : []
  const body = collapse(content.replace(REPEAT, ''))
  // Palabra conocida, número opcional y "de <una palabra>" ("Solo de guitarra").
  const m = body.match(/^([\p{L}-]+)(?:\s+(\d{1,2}))?(?:\s+de\s+\p{L}+)?$/u)
  if (!m) return null
  const kind = kindOf(m[1])
  if (!kind) return null
  // "Solo de guitarra" queda tal cual; "CORO 2" pasa a "Coro 2".
  const label = /\sde\s/i.test(body) ? capitalize(body) : capitalize(m[1]) + (m[2] ? ` ${m[2]}` : '')
  return { label, kind, cues }
}

/** Devuelve el encabezado si la línea lo es, o null si es letra. */
export function parseHeader(raw: string): Header | null {
  const line = collapse(raw)
  if (!line || line.length > 40) return null

  // [Cualquier cosa]
  const bracket = line.match(/^\[(.+)\]:?$/)
  if (bracket) {
    const known = knownHeader(bracket[1])
    if (known) return known
    const cues: CueKind[] = REPEAT.test(bracket[1]) ? ['x2'] : []
    const label = collapse(bracket[1].replace(REPEAT, ''))
    return label ? { label, kind: 'otro', cues } : null
  }

  // (Coro), Coro:, CORO, Coro x2
  const paren = line.match(/^\((.+)\):?$/)
  const colon = line.match(/^(.+):$/)
  return knownHeader(paren?.[1] ?? colon?.[1] ?? line)
}

/* ---------- Parser ---------- */

interface Draft {
  header: Header | null
  lines: Line[]
  cues: CueKind[]
}

function addCues(target: CueKind[], cues: CueKind[]) {
  for (const c of cues) if (!target.includes(c)) target.push(c)
}

function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  for (const l of lines) {
    if (l.trim() === '') {
      if (current.length) blocks.push(current)
      current = []
    } else {
      current.push(l)
    }
  }
  if (current.length) blocks.push(current)
  return blocks
}

function draftFrom(block: string[], newId: NewId): Draft | null {
  const rows = block.filter((l) => !isChordLine(l))
  if (rows.length === 0) return null

  const header = parseHeader(rows[0])
  const draft: Draft = { header, lines: [], cues: header ? [...header.cues] : [] }

  for (const raw of header ? rows.slice(1) : rows) {
    const { text, cues } = extractCues(raw)
    if (text) {
      draft.lines.push({ id: newId(), text, cues })
    } else if (cues.length) {
      // Indicación sola en su renglón: va a la línea de arriba, o a la parte.
      addCues(draft.lines.at(-1)?.cues ?? draft.cues, cues)
    }
  }

  if (!header && draft.lines.length === 0 && draft.cues.length === 0) return null
  return draft
}

const keyOf = (lines: Line[]) => lines.map((l) => l.text.toLocaleLowerCase('es')).join('\n')

/** Convierte texto plano en partes. */
export function parseLyrics(text: string, newId: NewId = defaultId): Section[] {
  const drafts: Draft[] = []
  for (const block of splitBlocks(normalizeText(text))) {
    const d = draftFrom(block, newId)
    if (!d) continue
    if (!d.header && d.lines.length === 0) {
      // Un bloque que es solo "(corte)" o "x2" no es una parte nueva:
      // se pega a la última línea de la parte anterior.
      const prev = drafts.at(-1)
      if (prev) addCues(prev.lines.at(-1)?.cues ?? prev.cues, d.cues)
      continue
    }
    drafts.push(d)
  }

  // Partes sin nombre que se repiten: son el coro.
  const counts = new Map<string, number>()
  for (const d of drafts) if (!d.header) counts.set(keyOf(d.lines), (counts.get(keyOf(d.lines)) ?? 0) + 1)

  const sections: Section[] = []
  let lastCoro: Line[] | null = null
  let estrofas = 0

  for (const d of drafts) {
    let { label, kind } = d.header ?? { label: '', kind: 'estrofa' as SectionKind }
    let lines = d.lines

    if (!d.header && (counts.get(keyOf(lines)) ?? 0) > 1) {
      label = 'Coro'
      kind = 'coro'
    }
    if (kind === 'coro' && lines.length === 0 && lastCoro) {
      // "[Coro]" sin letra: repite el último coro.
      lines = lastCoro.map((l) => ({ id: newId(), text: l.text, cues: [...l.cues] }))
    }
    if (kind === 'coro' && lines.length) lastCoro = lines
    if (kind === 'estrofa') {
      estrofas += 1
      if (!d.header || /^estrofa$/i.test(label)) label = `Estrofa ${estrofas}`
    }

    sections.push({ id: newId(), label, kind, cues: d.cues, lines })
  }
  return sections
}

/* ---------- De vuelta a texto (para el editor) ---------- */

const CUE_TEXT: Record<CueKind, string> = { x2: '(x2)', corte: '(corte)', silencio: '(silencio)', solo: '(solo)' }

export function sectionsToText(sections: Section[]): string {
  return sections
    .map((s) => {
      const head = `[${s.label}${s.cues.includes('x2') ? ' x2' : ''}]`
      const rest = s.cues.filter((c) => c !== 'x2').map((c) => CUE_TEXT[c])
      const lines = s.lines.map((l) => [l.text, ...l.cues.map((c) => CUE_TEXT[c])].join(' '))
      return [head, ...lines, ...rest].join('\n')
    })
    .join('\n\n')
}
