import { useSyncExternalStore } from 'react'
import { makeBackup, type Backup, type BackupContent } from './backup'
import { openTpDb } from './db'
import { DEFAULT_DEVICE, Repo, type NewSetlist, type NewSong } from './repo'
import type { BandSettings, DeviceSettings, Setlist, Song } from './types'

/*
 * Almacén de datos para la interfaz: guarda en memoria lo que hay en
 * IndexedDB y avisa a React cuando cambia. Toda escritura pasa por acá.
 * Si otra pestaña cambia algo, llega un aviso por BroadcastChannel y se recarga.
 */

export interface DataSnapshot {
  ready: boolean
  error: string | null
  songs: Song[]
  setlists: Setlist[]
  band: BandSettings | null
  /** Montaje del monitor: es de este equipo, no se sincroniza. */
  device: DeviceSettings
}

const DATA_CHANNEL = 'garetto-teleprompter-data'

export class DataStore {
  private repo: Repo | null = null
  private snapshot: DataSnapshot = { ready: false, error: null, songs: [], setlists: [], band: null, device: DEFAULT_DEVICE }
  private listeners = new Set<() => void>()
  private channel: BroadcastChannel | null = null
  private initPromise: Promise<void> | null = null

  init(dbName?: string): Promise<void> {
    this.initPromise ??= (async () => {
      try {
        this.repo = new Repo(await openTpDb(dbName))
        this.channel = new BroadcastChannel(DATA_CHANNEL)
        this.channel.onmessage = () => void this.reload()
        await this.reload()
      } catch (e) {
        this.set({ ...this.snapshot, ready: true, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return this.initPromise
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getSnapshot = () => this.snapshot

  songById(id: string): Song | undefined {
    return this.snapshot.songs.find((s) => s.id === id)
  }

  /* ---------- Escrituras ---------- */

  async createSong(input: NewSong) {
    return this.write((r) => r.createSong(input))
  }
  async saveSong(song: Song) {
    return this.write((r) => r.saveSong(song))
  }
  async deleteSong(id: string) {
    return this.write((r) => r.deleteSong(id))
  }
  async createSetlist(input: NewSetlist) {
    return this.write((r) => r.createSetlist(input))
  }
  async saveSetlist(setlist: Setlist) {
    return this.write((r) => r.saveSetlist(setlist))
  }
  async deleteSetlist(id: string) {
    return this.write((r) => r.deleteSetlist(id))
  }
  async saveBandSettings(patch: Parameters<Repo['saveBandSettings']>[0]) {
    return this.write((r) => r.saveBandSettings(patch))
  }
  async saveDeviceSettings(patch: Partial<DeviceSettings>) {
    return this.write((r) => r.saveDeviceSettings(patch))
  }

  /** Varias canciones de una vez (importación). Devuelve las creadas, en orden. */
  async createSongs(inputs: NewSong[]) {
    return this.write(async (r) => {
      const created: Song[] = []
      for (const input of inputs) created.push(await r.createSong(input))
      return created
    })
  }

  /** Vuelve a guardar una canción como estaba (por ejemplo, para deshacer un borrado). */
  async restoreSong(song: Song) {
    return this.write((r) => r.putRows('songs', [song]))
  }

  async restoreSetlist(setlist: Setlist) {
    return this.write((r) => r.putRows('setlists', [setlist]))
  }

  /** Restaura un backup. Devuelve una función que lo deshace. */
  async restoreBackup(content: BackupContent): Promise<() => Promise<void>> {
    return this.write(async (r) => {
      const songs = await r.putRows('songs', content.songs)
      const setlists = await r.putRows('setlists', content.setlists)
      const prevBand = await r.getBandSettings()
      if (content.band) {
        const { quickMessages, ...rest } = content.band
        await r.saveBandSettings(quickMessages.length ? content.band : rest)
      }
      return async () => {
        await this.write(async (repo) => {
          await repo.revertRows(songs)
          await repo.revertRows(setlists)
          if (content.band) {
            const { quickMessages, defaultAdvance, theme } = prevBand
            await repo.saveBandSettings({ quickMessages, defaultAdvance, theme })
          }
        })
      }
    })
  }

  /** Todo lo que hay, listo para bajar como .json. */
  backup(): Backup {
    const { songs, setlists, band } = this.snapshot
    return makeBackup(songs, setlists, band)
  }

  /* ---------- Interno ---------- */

  private async write<T>(fn: (repo: Repo) => Promise<T>): Promise<T> {
    if (!this.repo) await this.init()
    if (!this.repo) throw new Error('La base local no está disponible')
    const result = await fn(this.repo)
    await this.reload()
    this.channel?.postMessage('changed')
    return result
  }

  private async reload() {
    const repo = this.repo
    if (!repo) return
    const [songs, setlists, band, device] = await Promise.all([
      repo.listSongs(),
      repo.listSetlists(),
      repo.getBandSettings(),
      repo.getDeviceSettings(),
    ])
    this.set({ ready: true, error: null, songs, setlists, band, device })
  }

  private set(next: DataSnapshot) {
    this.snapshot = next
    for (const cb of this.listeners) cb()
  }
}

/** El almacén de la app. */
export const store = new DataStore()

export function useData(): DataSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
