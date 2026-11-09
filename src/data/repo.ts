import type { TpDB } from './db'
import {
  LIMITS,
  type AdvanceMode,
  type BandSettings,
  type DeviceSettings,
  type Setlist,
  type SetlistItem,
  type Song,
  SONG_KINDS,
} from './types'

export type Clock = () => string
export type NewId = () => string

const isoNow: Clock = () => new Date().toISOString()
const uuid: NewId = () => crypto.randomUUID()

export const DEFAULT_QUICK_MESSAGES = ['Repetí el coro', 'Más lento', 'Último coro', 'Cortamos acá', 'Enganchamos']

export const DEFAULT_DEVICE: DeviceSettings = { rotation: 0, mirror: false, marginPct: 0, reduceMotion: false }

const KV_BAND = 'band'
const KV_DEVICE = 'device'

/** Compara fechas ISO aunque vengan con formatos distintos (la base usa microsegundos y +00:00). */
export function isNewer(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function cleanText(s: string | null | undefined, max: number): string | null {
  const t = s?.trim()
  return t ? t.slice(0, max) : null
}

export type NewSong = Partial<Omit<Song, 'id' | 'createdAt' | 'clientUpdatedAt' | 'deletedAt' | 'dirty'>> & {
  title: string
}

export type NewSetlist = { name: string; showDate?: string | null; items?: SetlistItem[] }

export type RowOf<S extends 'songs' | 'setlists'> = S extends 'songs' ? Song : Setlist

/** Cómo estaban unas filas antes de un cambio grande. null: no existía. */
export interface Snapshot<S extends 'songs' | 'setlists' = 'songs' | 'setlists'> {
  store: S
  rows: Array<{ id: string; prev: RowOf<S> | null }>
}

/**
 * Acceso a los datos locales. Toda escritura marca la fila como pendiente de
 * subir (dirty) y le pone la hora del equipo, que decide quién gana.
 */
export class Repo {
  private readonly db: TpDB
  private readonly now: Clock
  private readonly newId: NewId

  constructor(db: TpDB, now: Clock = isoNow, newId: NewId = uuid) {
    this.db = db
    this.now = now
    this.newId = newId
  }

  /* ---------- Canciones ---------- */

  async listSongs(): Promise<Song[]> {
    const all = await this.db.getAll('songs')
    return all.filter((s) => !s.deletedAt).sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }))
  }

  async getSong(id: string): Promise<Song | undefined> {
    const s = await this.db.get('songs', id)
    return s && !s.deletedAt ? s : undefined
  }

  async createSong(input: NewSong): Promise<Song> {
    const now = this.now()
    const song = this.normalizeSong({
      id: this.newId(),
      title: input.title,
      artist: input.artist ?? null,
      kind: input.kind ?? 'cuarteto',
      sections: input.sections ?? [],
      speed: input.speed ?? 1,
      advanceMode: input.advanceMode ?? null,
      durationSeconds: input.durationSeconds ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      clientUpdatedAt: now,
      deletedAt: null,
      dirty: 1,
    })
    await this.db.add('songs', song)
    return song
  }

  async saveSong(song: Song): Promise<Song> {
    const saved = this.normalizeSong({ ...song, clientUpdatedAt: this.now(), dirty: 1 })
    await this.db.put('songs', saved)
    return saved
  }

  /** Borrado lógico: queda en la base para que el borrado se sincronice. */
  async deleteSong(id: string): Promise<void> {
    const s = await this.db.get('songs', id)
    if (!s || s.deletedAt) return
    const now = this.now()
    await this.db.put('songs', { ...s, deletedAt: now, clientUpdatedAt: now, dirty: 1 })
  }

  private normalizeSong(s: Song): Song {
    const title = cleanText(s.title, LIMITS.titleMax)
    if (!title) throw new Error('La canción necesita un título')
    return {
      ...s,
      title,
      artist: cleanText(s.artist, LIMITS.artistMax),
      kind: SONG_KINDS.includes(s.kind) ? s.kind : 'otro',
      speed: Math.round(clamp(s.speed, LIMITS.speedMin, LIMITS.speedMax) * 100) / 100,
      durationSeconds:
        s.durationSeconds == null ? null : Math.round(clamp(s.durationSeconds, 0, LIMITS.durationMax)),
      notes: cleanText(s.notes, LIMITS.notesMax),
    }
  }

  /* ---------- Setlists ---------- */

  async listSetlists(): Promise<Setlist[]> {
    const all = await this.db.getAll('setlists')
    // Los shows más nuevos primero; los que no tienen fecha, al final.
    return all
      .filter((s) => !s.deletedAt)
      .sort((a, b) => (b.showDate ?? '').localeCompare(a.showDate ?? '') || a.name.localeCompare(b.name, 'es'))
  }

  async getSetlist(id: string): Promise<Setlist | undefined> {
    const s = await this.db.get('setlists', id)
    return s && !s.deletedAt ? s : undefined
  }

  async createSetlist(input: NewSetlist): Promise<Setlist> {
    const name = cleanText(input.name, LIMITS.titleMax)
    if (!name) throw new Error('El setlist necesita un nombre')
    const now = this.now()
    const setlist: Setlist = {
      id: this.newId(),
      name,
      showDate: input.showDate ?? null,
      items: input.items ?? [],
      createdAt: now,
      clientUpdatedAt: now,
      deletedAt: null,
      dirty: 1,
    }
    await this.db.add('setlists', setlist)
    return setlist
  }

  async saveSetlist(setlist: Setlist): Promise<Setlist> {
    const name = cleanText(setlist.name, LIMITS.titleMax)
    if (!name) throw new Error('El setlist necesita un nombre')
    const saved: Setlist = { ...setlist, name, clientUpdatedAt: this.now(), dirty: 1 }
    await this.db.put('setlists', saved)
    return saved
  }

  async deleteSetlist(id: string): Promise<void> {
    const s = await this.db.get('setlists', id)
    if (!s || s.deletedAt) return
    const now = this.now()
    await this.db.put('setlists', { ...s, deletedAt: now, clientUpdatedAt: now, dirty: 1 })
  }

  /* ---------- Ajustes ---------- */

  async getBandSettings(): Promise<BandSettings> {
    const saved = (await this.db.get('kv', KV_BAND)) as BandSettings | undefined
    return (
      saved ?? {
        quickMessages: [...DEFAULT_QUICK_MESSAGES],
        defaultAdvance: 'linea' satisfies AdvanceMode,
        theme: {},
        clientUpdatedAt: new Date(0).toISOString(),
        dirty: 0,
      }
    )
  }

  async saveBandSettings(patch: Partial<Omit<BandSettings, 'clientUpdatedAt' | 'dirty'>>): Promise<BandSettings> {
    const current = await this.getBandSettings()
    const next: BandSettings = { ...current, ...patch, clientUpdatedAt: this.now(), dirty: 1 }
    await this.db.put('kv', next, KV_BAND)
    return next
  }

  async getDeviceSettings(): Promise<DeviceSettings> {
    const saved = (await this.db.get('kv', KV_DEVICE)) as Partial<DeviceSettings> | undefined
    return { ...DEFAULT_DEVICE, ...saved }
  }

  async saveDeviceSettings(patch: Partial<DeviceSettings>): Promise<DeviceSettings> {
    const next = { ...(await this.getDeviceSettings()), ...patch }
    await this.db.put('kv', next, KV_DEVICE)
    return next
  }

  /* ---------- Restaurar y deshacer ---------- */

  /**
   * Guarda filas enteras (de un backup, o para deshacer) como edición nueva de
   * este equipo. Devuelve cómo estaba cada una antes, para poder volver atrás.
   */
  async putRows<S extends 'songs' | 'setlists'>(store: S, rows: RowOf<S>[]): Promise<Snapshot<S>> {
    const now = this.now()
    const before: Snapshot<S> = { store, rows: [] }
    for (const row of rows) {
      const prev = (await this.db.get(store, row.id)) as RowOf<S> | undefined
      before.rows.push({ id: row.id, prev: prev ?? null })
      const next = { ...row, deletedAt: null, clientUpdatedAt: now, dirty: 1 as const }
      await this.db.put(store, (store === 'songs' ? this.normalizeSong(next as Song) : next) as never)
    }
    return before
  }

  /** Deja las filas como estaban en la foto: las que no existían quedan borradas. */
  async revertRows<S extends 'songs' | 'setlists'>(snapshot: Snapshot<S>): Promise<void> {
    const now = this.now()
    for (const { id, prev } of snapshot.rows) {
      const current = await this.db.get(snapshot.store, id)
      if (prev) await this.db.put(snapshot.store, { ...prev, clientUpdatedAt: now, dirty: 1 } as never)
      else if (current && !current.deletedAt) await this.db.put(snapshot.store, { ...current, deletedAt: now, clientUpdatedAt: now, dirty: 1 } as never)
    }
  }

  /* ---------- Sincronización ---------- */

  /** Filas con cambios locales que todavía no se subieron (incluye borradas). */
  async pending(): Promise<{ songs: Song[]; setlists: Setlist[] }> {
    const [songs, setlists] = await Promise.all([
      this.db.getAllFromIndex('songs', 'by-dirty', 1),
      this.db.getAllFromIndex('setlists', 'by-dirty', 1),
    ])
    return { songs, setlists }
  }

  /**
   * Marca una fila como subida. Si se volvió a editar mientras se subía
   * (cambió clientUpdatedAt), queda pendiente para la próxima vuelta.
   */
  async markSynced(store: 'songs' | 'setlists', id: string, uploadedAt: string): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite')
    const row = await tx.store.get(id)
    if (row && row.clientUpdatedAt === uploadedAt) await tx.store.put({ ...row, dirty: 0 })
    await tx.done
  }

  /**
   * Aplica una fila que llegó de Supabase. Gana la edición más nueva, igual
   * que el trigger de la base. Devuelve true si la fila local cambió.
   */
  async applyRemote<S extends 'songs' | 'setlists'>(
    store: S,
    remote: S extends 'songs' ? Song : Setlist,
  ): Promise<boolean> {
    const tx = this.db.transaction(store, 'readwrite')
    const local = await tx.store.get(remote.id)
    const wins = !local || isNewer(remote.clientUpdatedAt, local.clientUpdatedAt)
    if (wins) await tx.store.put({ ...remote, dirty: 0 })
    await tx.done
    return wins
  }
}
