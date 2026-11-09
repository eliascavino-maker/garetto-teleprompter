import { describe, expect, it } from 'vitest'
import type { Section } from '../data/types'
import { buildSteps, findStep, next, nextPart, pageRanges, prev, prevPart } from './cursor'

function section(label: string, count: number): Section {
  return {
    id: label,
    label,
    kind: 'estrofa',
    cues: [],
    lines: Array.from({ length: count }, (_, i) => ({ id: `${label}-${i}`, text: `${label} ${i + 1}`, cues: [] })),
  }
}

// Estrofa de 2, solo sin letra, coro de 10 (no entra en una pantalla).
const song = [section('E', 2), section('S', 0), section('C', 10)]
const linea = buildSteps(song, { mode: 'linea', marcar: false })
const parte = buildSteps(song, { mode: 'parte', marcar: false })
const marca = buildSteps(song, { mode: 'parte', marcar: true })

describe('pageRanges', () => {
  it('divide en pantallas parejas', () => {
    expect(pageRanges(0)).toEqual([[0, 0]])
    expect(pageRanges(8)).toEqual([[0, 8]])
    expect(pageRanges(10)).toEqual([
      [0, 5],
      [5, 10],
    ])
    expect(pageRanges(17).map(([a, b]) => b - a)).toEqual([6, 6, 5])
  })
})

describe('buildSteps', () => {
  it('por línea: un paso por línea y uno para el solo', () => {
    expect(linea).toHaveLength(2 + 1 + 10)
    expect(linea[2]).toEqual({ section: 1, page: 0, line: null })
    expect(linea[8]).toEqual({ section: 2, page: 1, line: 5 })
  })

  it('por parte: un paso por pantalla', () => {
    expect(parte).toEqual([
      { section: 0, page: 0, line: null },
      { section: 1, page: 0, line: null },
      { section: 2, page: 0, line: null },
      { section: 2, page: 1, line: null },
    ])
  })

  it('por parte marcando la línea: pasos por línea', () => {
    expect(marca).toEqual(linea)
  })
})

describe('navegación', () => {
  it('next y prev se frenan en los bordes', () => {
    expect(next(parte, 0)).toBe(1)
    expect(next(parte, 3)).toBeNull()
    expect(prev(parte, 0)).toBeNull()
    expect(prev(parte, 2)).toBe(1)
  })

  it('nextPart salta al comienzo de la parte siguiente', () => {
    expect(nextPart(linea, 0)).toBe(2) // E → S
    expect(nextPart(linea, 2)).toBe(3) // S → C
    expect(nextPart(linea, 7)).toBeNull() // ya en la última parte
  })

  it('prevPart vuelve al comienzo de la parte, y después a la anterior', () => {
    expect(prevPart(linea, 6)).toBe(3) // mitad del coro → comienzo del coro
    expect(prevPart(linea, 3)).toBe(2) // comienzo del coro → solo
    expect(prevPart(linea, 1)).toBe(0)
    expect(prevPart(linea, 0)).toBeNull()
  })
})

describe('findStep al cambiar de modo', () => {
  it('de línea a parte: va a la pantalla que tiene esa línea', () => {
    expect(findStep(parte, linea[8])).toBe(3) // coro, línea 6 → pantalla 2/2
    expect(findStep(parte, linea[1])).toBe(0)
  })

  it('de parte a línea: va a la primera línea de esa pantalla', () => {
    expect(linea[findStep(linea, parte[3])]).toEqual({ section: 2, page: 1, line: 5 })
  })

  it('si la parte ya no existe, va a la más cercana', () => {
    expect(findStep(parte, { section: 9, page: 0, line: null })).toBe(3)
  })
})
