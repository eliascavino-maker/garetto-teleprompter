import { describe, expect, it } from 'vitest'
import {
  addSong,
  entries,
  formatDuration,
  linkWithNext,
  moveItem,
  removeEntry,
  renameEng,
  unlink,
  withoutMissing,
} from './setlist'
import type { SetlistItem } from './types'

const song = (songId: string): SetlistItem => ({ type: 'song', songId })
const eng = (id: string, ...songIds: string[]): SetlistItem => ({ type: 'enganchado', id, name: 'Cumbias', songIds })
const ids = (items: SetlistItem[]) => entries(items).map((e) => e.songId)
const newId = () => 'nuevo'

// a, [b c d], e
const base = [song('a'), eng('e1', 'b', 'c', 'd'), song('e')]

describe('entries', () => {
  it('aplana los enganchados con su posición', () => {
    const e = entries(base)
    expect(e.map((x) => x.songId)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(e[2]).toEqual({ songId: 'c', item: 1, eng: { id: 'e1', name: 'Cumbias', pos: 1, count: 3 } })
    expect(e[4].eng).toBeNull()
  })
})

describe('agregar, sacar y mover', () => {
  it('agrega al final o en una posición', () => {
    expect(ids(addSong(base, 'x'))).toEqual(['a', 'b', 'c', 'd', 'e', 'x'])
    expect(ids(addSong(base, 'x', 0))).toEqual(['x', 'a', 'b', 'c', 'd', 'e'])
  })

  it('saca un tema suelto o de adentro de un enganchado', () => {
    expect(ids(removeEntry(base, 0))).toEqual(['b', 'c', 'd', 'e'])
    expect(removeEntry(base, 2)[1]).toEqual(eng('e1', 'b', 'd'))
  })

  it('un enganchado que queda con un tema vuelve a ser suelto', () => {
    const two = [eng('e1', 'b', 'c')]
    expect(removeEntry(two, 0)).toEqual([song('c')])
  })

  it('mueve ítems enteros', () => {
    expect(ids(moveItem(base, 1, 0))).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(ids(moveItem(base, 0, 2))).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(moveItem(base, 5, 0)).toBe(base)
  })

  it('no modifica la lista original', () => {
    const copy = structuredClone(base)
    removeEntry(base, 2)
    moveItem(base, 0, 2)
    linkWithNext(base, 0, newId)
    expect(base).toEqual(copy)
  })
})

describe('enganchar', () => {
  it('dos temas sueltos forman un enganchado nuevo', () => {
    expect(linkWithNext([song('a'), song('b')], 0, newId)).toEqual([
      { type: 'enganchado', id: 'nuevo', name: 'Enganchado', songIds: ['a', 'b'] },
    ])
  })

  it('un tema se suma a un enganchado, de cualquier lado', () => {
    expect(linkWithNext(base, 0, newId)).toEqual([eng('e1', 'a', 'b', 'c', 'd'), song('e')])
    expect(linkWithNext(base, 1, newId)).toEqual([song('a'), eng('e1', 'b', 'c', 'd', 'e')])
  })

  it('el último no tiene con quién engancharse', () => {
    expect(linkWithNext(base, 2, newId)).toBe(base)
  })

  it('desenganchar separa en temas sueltos', () => {
    expect(unlink(base, 1)).toEqual([song('a'), song('b'), song('c'), song('d'), song('e')])
    expect(unlink(base, 0)).toBe(base)
  })

  it('renombrar; vacío vuelve al nombre por defecto', () => {
    expect(renameEng(base, 'e1', ' Para arrancar ')[1]).toMatchObject({ name: 'Para arrancar' })
    expect(renameEng(base, 'e1', '  ')[1]).toMatchObject({ name: 'Enganchado' })
  })
})

describe('otros', () => {
  it('saca los temas que ya no existen', () => {
    expect(withoutMissing(base, (id) => !['a', 'c', 'd'].includes(id))).toEqual([song('b'), song('e')])
  })

  it('formatDuration', () => {
    expect(formatDuration(250)).toBe('4:10')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(3930)).toBe('1:05:30')
  })
})
