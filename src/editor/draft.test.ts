import { describe, expect, it } from 'vitest'
import { parseLyrics } from '../data/parser'
import { DEMO_SONG } from '../show/demoSong'
import {
  applyDraft,
  draftErrors,
  draftFromSong,
  insertSection,
  lineContext,
  parseDuration,
  removeTitleLine,
  titleCandidate,
  toggleCue,
} from './draft'

/** El cursor se marca con "|" en el texto. */
function at(withCaret: string) {
  const caret = withCaret.indexOf('|')
  return [withCaret.replace('|', ''), caret] as const
}
const show = ({ text, caret }: { text: string; caret: number }) => text.slice(0, caret) + '|' + text.slice(caret)

describe('duración', () => {
  it('entiende 4:10, 4.10 y minutos solos', () => {
    expect(parseDuration('4:10')).toBe(250)
    expect(parseDuration(' 4.05 ')).toBe(245)
    expect(parseDuration('3')).toBe(180)
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('4:1')).toBeUndefined()
    expect(parseDuration('4:75')).toBeUndefined()
    expect(parseDuration('cuatro')).toBeUndefined()
    expect(parseDuration('99:00')).toBeUndefined()
  })
})

describe('borrador', () => {
  it('ida y vuelta con una canción', () => {
    const d = draftFromSong({ ...DEMO_SONG, durationSeconds: 250, artist: null })
    expect(d).toMatchObject({ duration: '4:10', artist: '' })
    const song = applyDraft(DEMO_SONG, { ...d, title: ' Nuevo ', artist: ' ', notes: 'Bajar un tono' }, parseLyrics(d.text))
    expect(song).toMatchObject({ title: 'Nuevo', artist: null, durationSeconds: 250, notes: 'Bajar un tono' })
    expect(song.sections.map((s) => s.label)).toEqual(DEMO_SONG.sections.map((s) => s.label))
  })

  it('errores', () => {
    const d = draftFromSong(DEMO_SONG)
    expect(draftErrors(d)).toEqual({})
    expect(draftErrors({ ...d, title: ' ', duration: '4:9' })).toEqual({ title: 'Falta el título', duration: 'Escribila como 4:10' })
  })
})

describe('indicaciones en el renglón del cursor', () => {
  it('pone y saca indicaciones en una línea de letra', () => {
    const [text, caret] = at('Uno\nMandale| baile\nTres')
    const once = toggleCue(text, caret, 'corte')
    expect(show(once)).toBe('Uno\nMandale baile (corte)|\nTres')
    const twice = toggleCue(once.text, once.caret, 'x2')
    expect(twice.text).toBe('Uno\nMandale baile (x2) (corte)\nTres')
    expect(lineContext(twice.text, twice.caret)).toEqual({ type: 'lyric', cues: ['x2', 'corte'] })
    expect(toggleCue(twice.text, twice.caret, 'corte').text).toBe('Uno\nMandale baile (x2)\nTres')
  })

  it('en un encabezado solo cambia el ×2', () => {
    const [text, caret] = at('[Coro|]\nMandale baile')
    expect(toggleCue(text, caret, 'x2').text).toBe('[Coro x2]\nMandale baile')
    expect(toggleCue('[Coro x2]', 2, 'x2').text).toBe('[Coro]')
    expect(toggleCue(text, caret, 'corte').text).toBe(text)
    expect(lineContext('\n\n', 1)).toEqual({ type: 'empty' })
  })
})

describe('marcar partes', () => {
  it('al principio de un bloque, el encabezado va arriba', () => {
    const [text, caret] = at('Uno\n\nMandale| baile\nDos')
    expect(show(insertSection(text, caret, 'Coro'))).toBe('Uno\n\n[Coro]\n|Mandale baile\nDos')
  })

  it('en el medio de un bloque, lo parte en dos', () => {
    const [text, caret] = at('Uno\nDos|\nTres')
    expect(show(insertSection(text, caret, 'Coro'))).toBe('Uno\n\n[Coro]\n|Dos\nTres')
  })

  it('sobre un encabezado, lo reemplaza', () => {
    const [text, caret] = at('[Estrofa|]\nUno')
    expect(show(insertSection(text, caret, 'Coro'))).toBe('[Coro]\n|Uno')
  })

  it('en un renglón vacío, arranca el bloque que sigue', () => {
    const [text, caret] = at('Uno\n|\nDos')
    expect(show(insertSection(text, caret, 'Coro'))).toBe('Uno\n\n[Coro]\n|Dos')
    expect(show(insertSection('', 0, 'Intro'))).toBe('[Intro]\n|')
    expect(parseLyrics(insertSection(text, caret, 'Coro').text).map((s) => s.label)).toEqual(['Estrofa 1', 'Coro'])
  })
})

describe('título en la letra pegada', () => {
  it('ofrece el primer renglón si está suelto', () => {
    const text = '\nMandale baile\n\nLlegamos de lejos\ncon ganas de fiesta'
    expect(titleCandidate(text)).toBe('Mandale baile')
    expect(removeTitleLine(text)).toBe('Llegamos de lejos\ncon ganas de fiesta')
  })

  it('no lo ofrece si es letra, encabezado o lo único que hay', () => {
    expect(titleCandidate('Llegamos de lejos\ncon ganas')).toBeNull()
    expect(titleCandidate('[Coro]\n\nMandale')).toBeNull()
    expect(titleCandidate('Solo esto')).toBeNull()
    expect(titleCandidate('Llegamos de lejos,\n\ncon ganas')).toBeNull()
  })
})
