import { describe, expect, it } from 'vitest'
import { DEMO_SONG } from '../show/demoSong'
import { backupFileName, makeBackup, parseBackup } from './backup'
import type { Setlist } from './types'

let n = 0
const seqId = () => `nuevo-${++n}`

const setlist: Setlist = {
  id: 'sl1',
  name: 'Show Alberdi',
  showDate: '2026-11-14',
  items: [
    { type: 'song', songId: DEMO_SONG.id },
    { type: 'enganchado', id: 'e1', name: 'Enganchado', songIds: ['a', 'b'] },
  ],
  createdAt: '2026-11-01T00:00:00.000Z',
  clientUpdatedAt: '2026-11-01T00:00:00.000Z',
  deletedAt: null,
  dirty: 0,
}

describe('backup', () => {
  it('ida y vuelta: lo exportado se restaura igual', () => {
    const borrada = { ...DEMO_SONG, id: 'borrada', deletedAt: '2026-11-02T00:00:00.000Z' }
    const band = { quickMessages: ['Uno'], defaultAdvance: 'parte' as const, theme: { gabiStyle: 'c' as const }, clientUpdatedAt: '', dirty: 0 as const }
    const backup = makeBackup([DEMO_SONG, borrada], [setlist], band)
    const back = parseBackup(JSON.stringify(backup), seqId)

    expect(back.songs).toHaveLength(1) // la borrada no viaja
    expect(back.songs[0]).toEqual({ ...DEMO_SONG, dirty: 1 })
    expect(back.setlists[0]).toEqual({ ...setlist, dirty: 1 })
    expect(back.band).toEqual({ quickMessages: ['Uno'], defaultAdvance: 'parte', theme: { gabiStyle: 'c' } })
  })

  it('rechaza archivos que no son un backup', () => {
    expect(() => parseBackup('hola')).toThrow('no se pudo leer')
    expect(() => parseBackup('{"songs":[]}')).toThrow('no es un backup del teleprompter')
    expect(() => parseBackup('{"app":"garetto-teleprompter","version":99}')).toThrow('más nueva')
    expect(() => parseBackup('{"app":"garetto-teleprompter","version":1,"songs":[{"title":""}]}')).toThrow('vacío')
  })

  it('limpia lo que viene roto y completa lo que falta', () => {
    const raw = {
      app: 'garetto-teleprompter',
      version: 1,
      songs: [
        {
          title: ' Sin id ',
          kind: 'tango',
          advanceMode: 'auto',
          sections: [{ label: '', kind: 'rap', cues: ['x2', 'x2', 'fuego'], lines: [{ text: ' Hola ' }, { text: '' }, 'nada'] }, null],
        },
        'basura',
      ],
      setlists: [
        {
          name: 'Show',
          showDate: '14/11',
          items: [{ type: 'song' }, { type: 'enganchado', songIds: ['x'] }, { type: 'enganchado', songIds: ['x', 'y'] }, 7],
        },
      ],
    }
    const back = parseBackup(JSON.stringify(raw), seqId, new Date('2026-11-09T12:00:00Z'))
    expect(back.songs[0]).toMatchObject({
      title: 'Sin id',
      kind: 'otro',
      advanceMode: null,
      speed: 1,
      createdAt: '2026-11-09T12:00:00.000Z',
      sections: [{ label: 'Parte', kind: 'otro', cues: ['x2'], lines: [{ text: 'Hola', cues: [] }] }],
    })
    expect(back.songs[0].id).toMatch(/^nuevo-/)
    expect(back.setlists[0]).toMatchObject({
      showDate: null,
      items: [{ type: 'song', songId: 'x' }, { type: 'enganchado', name: 'Enganchado', songIds: ['x', 'y'] }],
    })
    expect(back.band).toBeNull()
  })

  it('nombre del archivo con la fecha local', () => {
    expect(backupFileName(new Date(2026, 10, 9, 23, 30))).toBe('garetto-backup-2026-11-09.json')
  })
})
