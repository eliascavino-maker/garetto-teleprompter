import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openTpDb } from './db'
import { Repo } from './repo'
import type { Song } from './types'

let repo: Repo
let tick: number

beforeEach(async () => {
  // Reloj falso: cada escritura avanza un segundo.
  tick = 0
  const clock = () => new Date(Date.UTC(2026, 10, 8, 20, 0, tick++)).toISOString()
  let id = 0
  const db = await openTpDb(`test-${crypto.randomUUID()}`)
  repo = new Repo(db, clock, () => `id-${++id}`)
})

describe('canciones', () => {
  it('crea con valores por defecto y queda pendiente de subir', async () => {
    const s = await repo.createSong({ title: '  Mandale baile  ' })
    expect(s).toMatchObject({
      id: 'id-1',
      title: 'Mandale baile',
      artist: null,
      kind: 'cuarteto',
      speed: 1,
      advanceMode: null,
      deletedAt: null,
      dirty: 1,
    })
    expect(await repo.getSong('id-1')).toEqual(s)
  })

  it('valida y acota los campos', async () => {
    await expect(repo.createSong({ title: '   ' })).rejects.toThrow('título')
    const s = await repo.createSong({ title: 'X', speed: 9, durationSeconds: -5, artist: ' ', kind: 'tango' as never })
    expect(s).toMatchObject({ speed: 4, durationSeconds: 0, artist: null, kind: 'otro' })
  })

  it('lista sin las borradas y en orden alfabético', async () => {
    await repo.createSong({ title: 'Zamba' })
    const b = await repo.createSong({ title: 'ángel' })
    await repo.createSong({ title: 'Baile' })
    const borrar = await repo.createSong({ title: 'Borrame' })
    await repo.deleteSong(borrar.id)
    expect((await repo.listSongs()).map((s) => s.title)).toEqual(['ángel', 'Baile', 'Zamba'])
    expect(await repo.getSong(borrar.id)).toBeUndefined()
    expect(b.title).toBe('ángel')
  })

  it('guardar actualiza la hora del equipo', async () => {
    const s = await repo.createSong({ title: 'A' })
    const saved = await repo.saveSong({ ...s, title: 'B' })
    expect(saved.title).toBe('B')
    expect(Date.parse(saved.clientUpdatedAt)).toBeGreaterThan(Date.parse(s.clientUpdatedAt))
    expect(saved.createdAt).toBe(s.createdAt)
  })
})

describe('setlists', () => {
  it('crea, lista por fecha y borra', async () => {
    await repo.createSetlist({ name: 'Viejo', showDate: '2026-10-01' })
    const nuevo = await repo.createSetlist({
      name: 'Sábado',
      showDate: '2026-11-14',
      items: [
        { type: 'song', songId: 'a' },
        { type: 'enganchado', id: 'e1', name: "Cumbias pa' arrancar", songIds: ['b', 'c'] },
      ],
    })
    await repo.createSetlist({ name: 'Sin fecha' })
    expect((await repo.listSetlists()).map((s) => s.name)).toEqual(['Sábado', 'Viejo', 'Sin fecha'])
    await repo.deleteSetlist(nuevo.id)
    expect((await repo.listSetlists()).map((s) => s.name)).toEqual(['Viejo', 'Sin fecha'])
  })
})

describe('ajustes', () => {
  it('la banda arranca con los mensajes rápidos por defecto', async () => {
    const band = await repo.getBandSettings()
    expect(band.quickMessages).toContain('Repetí el coro')
    expect(band.dirty).toBe(0)
    const saved = await repo.saveBandSettings({ defaultAdvance: 'parte' })
    expect(saved).toMatchObject({ defaultAdvance: 'parte', dirty: 1 })
    expect(await repo.getBandSettings()).toEqual(saved)
  })

  it('el montaje del monitor se guarda solo en el equipo', async () => {
    expect(await repo.getDeviceSettings()).toEqual({ rotation: 0, mirror: false, marginPct: 0, reduceMotion: false })
    await repo.saveDeviceSettings({ rotation: 180, reduceMotion: true })
    expect(await repo.getDeviceSettings()).toEqual({ rotation: 180, mirror: false, marginPct: 0, reduceMotion: true })
  })
})

describe('sincronización', () => {
  it('pending devuelve lo que falta subir, incluidas las borradas', async () => {
    const a = await repo.createSong({ title: 'A' })
    const b = await repo.createSong({ title: 'B' })
    await repo.deleteSong(b.id)
    await repo.markSynced('songs', a.id, a.clientUpdatedAt)
    const { songs } = await repo.pending()
    expect(songs.map((s) => [s.title, s.deletedAt !== null])).toEqual([['B', true]])
  })

  it('markSynced no limpia una fila que se editó mientras se subía', async () => {
    const a = await repo.createSong({ title: 'A' })
    const subida = a.clientUpdatedAt
    await repo.saveSong({ ...a, title: 'A editada' })
    await repo.markSynced('songs', a.id, subida)
    expect((await repo.pending()).songs).toHaveLength(1)
  })

  it('applyRemote: gana la edición más nueva', async () => {
    const local = await repo.createSong({ title: 'Local' }) // 20:00:00
    const remote = (title: string, at: string): Song => ({ ...local, title, clientUpdatedAt: at, dirty: 0 })

    // Más vieja que la local: se descarta.
    expect(await repo.applyRemote('songs', remote('Vieja', '2026-11-08T19:59:59.000000+00:00'))).toBe(false)
    expect((await repo.getSong(local.id))?.title).toBe('Local')

    // Más nueva, con el formato de Postgres: se aplica y no queda pendiente.
    expect(await repo.applyRemote('songs', remote('Remota', '2026-11-08T20:00:05.123456+00:00'))).toBe(true)
    expect(await repo.getSong(local.id)).toMatchObject({ title: 'Remota', dirty: 0 })

    // Una fila que no existía se agrega.
    expect(await repo.applyRemote('songs', { ...remote('Nueva', '2026-11-08T21:00:00Z'), id: 'otra' })).toBe(true)
    expect((await repo.listSongs()).map((s) => s.title)).toEqual(['Nueva', 'Remota'])
  })
})

describe('restaurar y deshacer', () => {
  it('putRows guarda filas enteras y revertRows deja todo como estaba', async () => {
    const vieja = await repo.createSong({ title: 'Vieja' })
    await repo.saveSong({ ...vieja, title: 'Vieja editada' })
    const nueva = { ...vieja, id: 'del-backup', title: 'Del backup' }
    const snap = await repo.putRows('songs', [{ ...vieja, title: 'Restaurada' }, nueva])

    expect((await repo.listSongs()).map((s) => s.title)).toEqual(['Del backup', 'Restaurada'])
    expect((await repo.pending()).songs).toHaveLength(2)

    await repo.revertRows(snap)
    expect((await repo.listSongs()).map((s) => s.title)).toEqual(['Vieja editada'])
    // La que no existía queda borrada (así el borrado también se sincroniza).
    expect((await repo.pending()).songs.find((s) => s.id === 'del-backup')?.deletedAt).not.toBeNull()
  })

  it('putRows revive una canción borrada', async () => {
    const s = await repo.createSong({ title: 'Borrada' })
    await repo.deleteSong(s.id)
    await repo.putRows('songs', [s])
    expect(await repo.getSong(s.id)).toMatchObject({ title: 'Borrada', deletedAt: null })
  })
})
