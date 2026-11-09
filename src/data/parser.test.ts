import { describe, expect, it } from 'vitest'
import { extractCues, isChordLine, parseHeader, parseLyrics, sectionsToText } from './parser'
import type { Section } from './types'

let n = 0
const seqId = () => `id${++n}`

/** Vista compacta de las partes, sin ids, para comparar fácil. */
function shape(sections: Section[]) {
  return sections.map((s) => ({
    label: s.label,
    kind: s.kind,
    ...(s.cues.length ? { cues: s.cues } : {}),
    lines: s.lines.map((l) => (l.cues.length ? `${l.text} [${l.cues.join(',')}]` : l.text)),
  }))
}

const parse = (text: string) => shape(parseLyrics(text, seqId))

describe('parseLyrics', () => {
  it('separa partes por líneas en blanco y numera las estrofas', () => {
    expect(parse('Uno\nDos\n\n\nTres\nCuatro')).toEqual([
      { label: 'Estrofa 1', kind: 'estrofa', lines: ['Uno', 'Dos'] },
      { label: 'Estrofa 2', kind: 'estrofa', lines: ['Tres', 'Cuatro'] },
    ])
  })

  it('entiende encabezados con corchetes, dos puntos, paréntesis y mayúsculas', () => {
    const text = '[Intro]\nHola\n\nCORO:\nMandale baile\n\n(Puente)\nY sigue\n\nEstribillo\nOtra vez\n\n[Hablado]\nGracias Córdoba'
    expect(parse(text)).toEqual([
      { label: 'Intro', kind: 'intro', lines: ['Hola'] },
      { label: 'Coro', kind: 'coro', lines: ['Mandale baile'] },
      { label: 'Puente', kind: 'puente', lines: ['Y sigue'] },
      { label: 'Estribillo', kind: 'coro', lines: ['Otra vez'] },
      { label: 'Hablado', kind: 'otro', lines: ['Gracias Córdoba'] },
    ])
  })

  it('mantiene el número de las estrofas con nombre', () => {
    expect(parse('Estrofa 2:\nAlgo').at(0)).toMatchObject({ label: 'Estrofa 2', kind: 'estrofa' })
    expect(parse('[Estrofa]\nAlgo').at(0)).toMatchObject({ label: 'Estrofa 1' })
  })

  it('detecta el coro cuando una parte sin nombre se repite', () => {
    const text = 'Estrofa uno\n\nMandale baile\nque la noche es larga\n\nEstrofa dos\n\nMandale baile\nQue la noche es larga'
    expect(parse(text).map((s) => s.label)).toEqual(['Estrofa 1', 'Coro', 'Estrofa 2', 'Coro'])
  })

  it('un "[Coro]" sin letra repite el último coro', () => {
    const sections = parseLyrics('[Coro]\nMandale baile\n\n[Estrofa]\nAlgo\n\n[Coro x2]', seqId)
    const [coro, , repetido] = sections
    expect(shape([repetido])).toEqual([{ label: 'Coro', kind: 'coro', cues: ['x2'], lines: ['Mandale baile'] }])
    // Las líneas copiadas tienen ids propios.
    expect(repetido.lines[0].id).not.toBe(coro.lines[0].id)
  })

  it('saca las indicaciones del final de la línea', () => {
    expect(parse('Mandale baile (x2)\nY se va ×2\nOtra (bis)\nAcá [corte]\nY se para (silencio)')[0].lines).toEqual([
      'Mandale baile [x2]',
      'Y se va [x2]',
      'Otra [x2]',
      'Acá [corte]',
      'Y se para [silencio]',
    ])
  })

  it('una indicación sola en su renglón va a la línea de arriba', () => {
    expect(parse('Primera\n(corte)\nSegunda')[0].lines).toEqual(['Primera [corte]', 'Segunda'])
    expect(parse('Primera\nSegunda\n\nx2\n\nTercera')).toEqual([
      { label: 'Estrofa 1', kind: 'estrofa', lines: ['Primera', 'Segunda [x2]'] },
      { label: 'Estrofa 2', kind: 'estrofa', lines: ['Tercera'] },
    ])
  })

  it('un solo instrumental queda como parte sin letra', () => {
    expect(parse('Letra\n\n(Solo de guitarra)\n\nMás letra')).toEqual([
      { label: 'Estrofa 1', kind: 'estrofa', lines: ['Letra'] },
      { label: 'Solo de guitarra', kind: 'solo', lines: [] },
      { label: 'Estrofa 2', kind: 'estrofa', lines: ['Más letra'] },
    ])
  })

  it('descarta las líneas de acordes', () => {
    const text = 'Am        G\nMandale baile\nLam   Sol7   Do\nque la noche es larga\nLa la la\nC  G'
    expect(parse(text)[0].lines).toEqual(['Mandale baile', 'que la noche es larga', 'La la la'])
  })

  it('normaliza saltos de Windows, tabs, espacios y separadores', () => {
    expect(parse('\r\n  Hola\t  mundo  \r\n\r\n-----\r\n\r\nChau\r\n')).toEqual([
      { label: 'Estrofa 1', kind: 'estrofa', lines: ['Hola mundo'] },
      { label: 'Estrofa 2', kind: 'estrofa', lines: ['Chau'] },
    ])
  })

  it('no confunde una línea de letra con un encabezado', () => {
    expect(parse('El coro de la gente\nque canta')[0]).toMatchObject({ kind: 'estrofa', lines: ['El coro de la gente', 'que canta'] })
    expect(parse('')).toEqual([])
  })

  it('vuelve a texto y se lee igual', () => {
    const text = '[Intro]\nHola\n\n[Coro x2]\nMandale baile (x2)\nque la noche es larga\n(corte)\n\n[Solo]'
    const once = parseLyrics(text, seqId)
    expect(shape(parseLyrics(sectionsToText(once), seqId))).toEqual(shape(once))
  })
})

describe('piezas del parser', () => {
  it('isChordLine', () => {
    expect(isChordLine('Am  F  C  G')).toBe(true)
    expect(isChordLine('F#m7/C#')).toBe(true)
    expect(isChordLine('Re   La   Si')).toBe(true)
    expect(isChordLine('Mi La')).toBe(false)
    expect(isChordLine('A ver')).toBe(false)
  })

  it('parseHeader', () => {
    expect(parseHeader('Coro 2 x2')).toEqual({ label: 'Coro 2', kind: 'coro', cues: ['x2'] })
    expect(parseHeader('[pre-coro]')).toEqual({ label: 'Pre-coro', kind: 'puente', cues: [] })
    expect(parseHeader('Coro de la gente que canta fuerte')).toBeNull()
    expect(parseHeader('(uoh uoh)')).toBeNull()
  })

  it('extractCues', () => {
    expect(extractCues('Hola (x2) (corte)')).toEqual({ text: 'Hola', cues: ['x2', 'corte'] })
    expect(extractCues('Exacto')).toEqual({ text: 'Exacto', cues: [] })
  })
})
