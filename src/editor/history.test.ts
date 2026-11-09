import { describe, expect, it } from 'vitest'
import { initHistory, record, redo, undo } from './history'

describe('history', () => {
  it('deshace y rehace', () => {
    let h = initHistory('a')
    h = record(h, 'b', null, 0)
    h = record(h, 'c', null, 10)
    h = undo(h)
    expect(h.present).toBe('b')
    h = undo(h)
    expect(h.present).toBe('a')
    expect(undo(h)).toBe(h) // no hay más
    h = redo(h)
    expect(h.present).toBe('b')
    // Un cambio nuevo borra lo que se podía rehacer.
    h = record(h, 'x', null, 20)
    expect(h.future).toEqual([])
    expect(redo(h)).toBe(h)
  })

  it('agrupa lo que se escribe seguido en el mismo campo', () => {
    let h = initHistory('')
    h = record(h, 'h', 'text', 0)
    h = record(h, 'ho', 'text', 300)
    h = record(h, 'hol', 'text', 600)
    h = record(h, 'hola', 'text', 2000) // pausa larga: paso nuevo
    h = record(h, 'hola!', 'title', 2100) // otro campo: paso nuevo
    expect(h.past).toEqual(['', 'hol', 'hola'])
  })

  it('corta los grupos largos aunque no haya pausa', () => {
    let h = initHistory(0)
    for (let t = 0; t <= 6000; t += 500) h = record(h, t + 1, 'text', t)
    expect(h.past.length).toBe(2)
  })
})
