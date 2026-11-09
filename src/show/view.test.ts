import { describe, expect, it } from 'vitest'
import { parseLyrics } from '../data/parser'
import { buildSteps } from './cursor'
import { buildLyricView } from './view'

let n = 0
const sections = parseLyrics(
  '[Estrofa]\nUno\nDos\n\n[Solo]\n\n[Coro]\nTres (x2)\nCuatro\nCinco\nSeis\nSiete\nOcho\nNueve\nDiez\nOnce',
  () => `id${++n}`,
)

const text = (v: { text: string } | null) => v?.text ?? null

describe('buildLyricView por línea', () => {
  const opts = { mode: 'linea' as const, marcar: false }
  const steps = buildSteps(sections, opts)

  it('muestra la anterior, la actual y dos siguientes, cruzando partes', () => {
    const v = buildLyricView(sections, steps, 1, opts)
    expect(v).toMatchObject({ kind: 'linea', part: { label: 'Estrofa 1' }, sigue: 'Solo' })
    if (v?.kind !== 'linea') throw new Error()
    expect([text(v.prev), v.now.text, ...v.next.map(text)]).toEqual(['Uno', 'Dos', 'Tres', 'Cuatro'])
  })

  it('la primera línea no tiene anterior y la actual lleva sus indicaciones', () => {
    const v = buildLyricView(sections, steps, 3, opts)
    if (v?.kind !== 'linea') throw new Error()
    expect(v.now).toMatchObject({ text: 'Tres', cues: ['x2'] })
    expect(text(v.prev)).toBe('Dos')
    expect(buildLyricView(sections, steps, 0, opts)).toMatchObject({ prev: null })
  })

  it('el solo se muestra como instrumental con la línea que viene', () => {
    expect(buildLyricView(sections, steps, 2, opts)).toMatchObject({
      kind: 'instrumental',
      part: { label: 'Solo', kind: 'solo' },
      next: { text: 'Tres' },
      sigue: 'Coro',
    })
  })

  it('en la última parte, "sigue" es el tema siguiente', () => {
    const last = steps.length - 1
    expect(buildLyricView(sections, steps, last, opts, 'La vecinita')).toMatchObject({ sigue: 'La vecinita', progress: 1 })
    expect(buildLyricView(sections, steps, last, opts)).toMatchObject({ sigue: null })
  })
})

describe('buildLyricView por parte', () => {
  it('muestra la pantalla de la parte con su número', () => {
    const opts = { mode: 'parte' as const, marcar: false }
    const steps = buildSteps(sections, opts)
    const v = buildLyricView(sections, steps, 3, opts)
    expect(v).toMatchObject({ kind: 'parte', mark: null, page: { n: 2, total: 2 } })
    if (v?.kind !== 'parte') throw new Error()
    expect(v.lines.map(text)).toEqual(['Ocho', 'Nueve', 'Diez', 'Once'])
    expect(buildLyricView(sections, steps, 0, opts)).toMatchObject({ page: null })
  })

  it('con "marcar la línea" resalta la actual', () => {
    const opts = { mode: 'parte' as const, marcar: true }
    const steps = buildSteps(sections, opts)
    const v = buildLyricView(sections, steps, 4, opts)
    if (v?.kind !== 'parte') throw new Error()
    expect(v.lines.find((l) => l.id === v.mark)?.text).toBe('Cuatro')
  })

  it('fuera de rango devuelve null', () => {
    expect(buildLyricView(sections, [], 0, { mode: 'linea', marcar: false })).toBeNull()
  })
})
