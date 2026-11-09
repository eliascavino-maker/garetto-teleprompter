/*
 * Backup en .json: todas las canciones, los setlists y los ajustes de la banda.
 * Al restaurar se valida todo: un archivo roto o ajeno no entra a la base.
 */
import {
  SONG_KINDS,
  type BandSettings,
  type CueKind,
  type Line,
  type Section,
  type SectionKind,
  type Setlist,
  type SetlistItem,
  type Song,
} from './types'

export const BACKUP_APP = 'garetto-teleprompter'
export const BACKUP_VERSION = 1

export type BackupBand = Pick<BandSettings, 'quickMessages' | 'defaultAdvance' | 'theme'>

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  songs: Song[]
  setlists: Setlist[]
  band: BackupBand | null
}

/** Lo que queda después de validar un backup: listo para guardar. */
export interface BackupContent {
  exportedAt: string | null
  songs: Song[]
  setlists: Setlist[]
  band: BackupBand | null
}

export function makeBackup(songs: Song[], setlists: Setlist[], band: BandSettings | null, now = new Date()): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    songs: songs.filter((s) => !s.deletedAt),
    setlists: setlists.filter((s) => !s.deletedAt),
    band: band ? { quickMessages: band.quickMessages, defaultAdvance: band.defaultAdvance, theme: band.theme } : null,
  }
}

/** Nombre del archivo: garetto-backup-2026-11-09.json */
export function backupFileName(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  return `garetto-backup-${d}.json`
}

/* ---------- Validación ---------- */

const SECTION_KINDS: readonly SectionKind[] = ['estrofa', 'coro', 'puente', 'intro', 'solo', 'final', 'otro']
const CUE_KINDS: readonly CueKind[] = ['silencio', 'corte', 'x2', 'solo']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const isoOr = (v: unknown, fallback: string) => {
  const s = str(v)
  return s && !Number.isNaN(Date.parse(s)) ? s : fallback
}
const cues = (v: unknown): CueKind[] => [...new Set(arr(v).filter((c): c is CueKind => CUE_KINDS.includes(c as CueKind)))]

function line(v: unknown, newId: () => string): Line | null {
  if (!isObj(v)) return null
  const text = str(v.text)?.trim()
  return text ? { id: str(v.id) || newId(), text, cues: cues(v.cues) } : null
}

function section(v: unknown, newId: () => string): Section | null {
  if (!isObj(v)) return null
  const kind = SECTION_KINDS.includes(v.kind as SectionKind) ? (v.kind as SectionKind) : 'otro'
  return {
    id: str(v.id) || newId(),
    label: str(v.label)?.trim() || 'Parte',
    kind,
    cues: cues(v.cues),
    lines: arr(v.lines)
      .map((l) => line(l, newId))
      .filter((l): l is Line => l !== null),
  }
}

function song(v: unknown, newId: () => string, now: string): Song | null {
  if (!isObj(v)) return null
  const title = str(v.title)?.trim()
  if (!title) return null
  const mode = v.advanceMode === 'linea' || v.advanceMode === 'parte' ? v.advanceMode : null
  return {
    id: str(v.id) || newId(),
    title,
    artist: str(v.artist),
    kind: SONG_KINDS.includes(v.kind as Song['kind']) ? (v.kind as Song['kind']) : 'otro',
    sections: arr(v.sections)
      .map((s) => section(s, newId))
      .filter((s): s is Section => s !== null),
    speed: num(v.speed) ?? 1,
    advanceMode: mode,
    durationSeconds: num(v.durationSeconds),
    notes: str(v.notes),
    createdAt: isoOr(v.createdAt, now),
    clientUpdatedAt: isoOr(v.clientUpdatedAt, now),
    deletedAt: null,
    dirty: 1,
  }
}

function item(v: unknown, newId: () => string): SetlistItem | null {
  if (!isObj(v)) return null
  if (v.type === 'song') {
    const songId = str(v.songId)
    return songId ? { type: 'song', songId } : null
  }
  if (v.type === 'enganchado') {
    const songIds = arr(v.songIds).filter((id): id is string => typeof id === 'string')
    if (songIds.length === 0) return null
    if (songIds.length === 1) return { type: 'song', songId: songIds[0] }
    return { type: 'enganchado', id: str(v.id) || newId(), name: str(v.name) || 'Enganchado', songIds }
  }
  return null
}

function setlist(v: unknown, newId: () => string, now: string): Setlist | null {
  if (!isObj(v)) return null
  const name = str(v.name)?.trim()
  if (!name) return null
  const date = str(v.showDate)
  return {
    id: str(v.id) || newId(),
    name,
    showDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    items: arr(v.items)
      .map((i) => item(i, newId))
      .filter((i): i is SetlistItem => i !== null),
    createdAt: isoOr(v.createdAt, now),
    clientUpdatedAt: isoOr(v.clientUpdatedAt, now),
    deletedAt: null,
    dirty: 1,
  }
}

function band(v: unknown): BackupBand | null {
  if (!isObj(v)) return null
  const quickMessages = arr(v.quickMessages).filter((m): m is string => typeof m === 'string' && m.trim() !== '')
  return {
    quickMessages: quickMessages.slice(0, 5),
    defaultAdvance: v.defaultAdvance === 'parte' ? 'parte' : 'linea',
    theme: isObj(v.theme) ? v.theme : {},
  }
}

/** Lee y valida un backup. Si no sirve, tira un error que se puede mostrar tal cual. */
export function parseBackup(text: string, newId: () => string = () => crypto.randomUUID(), now = new Date()): BackupContent {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un backup: no se pudo leer como .json.')
  }
  if (!isObj(data) || data.app !== BACKUP_APP) throw new Error('Este archivo no es un backup del teleprompter.')
  if ((num(data.version) ?? 0) > BACKUP_VERSION) throw new Error('El backup es de una versión más nueva de la app. Actualizá la página y probá de nuevo.')

  const iso = now.toISOString()
  const songs = arr(data.songs)
    .map((s) => song(s, newId, iso))
    .filter((s): s is Song => s !== null)
  const setlists = arr(data.setlists)
    .map((s) => setlist(s, newId, iso))
    .filter((s): s is Setlist => s !== null)
  if (songs.length === 0 && setlists.length === 0) throw new Error('El backup está vacío: no tiene canciones ni setlists.')

  return { exportedAt: str(data.exportedAt), songs, setlists, band: band(data.band) }
}
