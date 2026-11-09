/*
 * Modelo de datos. Sigue el esquema de supabase/migrations: los nombres van en
 * camelCase acá y en snake_case en la base. Las fechas son strings ISO.
 */

export type SongKind = 'propia' | 'cuarteto' | 'cumbia' | 'cover' | 'otro'
export const SONG_KINDS: readonly SongKind[] = ['propia', 'cuarteto', 'cumbia', 'cover', 'otro']

/** Línea por línea, o la parte entera (estrofa o estribillo) en pantalla. */
export type AdvanceMode = 'linea' | 'parte'

/** Indicaciones que se pueden marcar en una línea o en una parte. */
export type CueKind = 'silencio' | 'corte' | 'x2' | 'solo'

export type SectionKind = 'estrofa' | 'coro' | 'puente' | 'intro' | 'solo' | 'final' | 'otro'

export interface Line {
  id: string
  text: string
  cues: CueKind[]
}

/** Una parte de la canción: estrofa, coro, puente, etc. */
export interface Section {
  id: string
  label: string
  kind: SectionKind
  /** Indicaciones de la parte entera, por ejemplo "Coro ×2". */
  cues: CueKind[]
  lines: Line[]
}

/** Campos que comparten las filas que se sincronizan con Supabase. */
export interface Synced {
  id: string
  /** Cuándo se editó en el equipo. Gana la edición más nueva. */
  clientUpdatedAt: string
  createdAt: string
  /** Borrado lógico: el borrado también se sincroniza. */
  deletedAt: string | null
  /** 1 si tiene cambios locales que todavía no se subieron. Número porque IndexedDB no indexa booleanos. */
  dirty: 0 | 1
}

export interface Song extends Synced {
  title: string
  artist: string | null
  kind: SongKind
  sections: Section[]
  /** Multiplicador de velocidad, de 0,25 a 4. */
  speed: number
  /** null: usa el modo elegido en la consola. */
  advanceMode: AdvanceMode | null
  durationSeconds: number | null
  notes: string | null
}

export type SetlistItem =
  | { type: 'song'; songId: string }
  /** Temas enganchados: van unidos, sin pausa entre uno y otro. */
  | { type: 'enganchado'; id: string; name: string; songIds: string[] }

export interface Setlist extends Synced {
  name: string
  /** Fecha del show, YYYY-MM-DD. */
  showDate: string | null
  items: SetlistItem[]
}

/** Ajustes compartidos por toda la banda. Se sincronizan. */
export interface BandSettings {
  quickMessages: string[]
  defaultAdvance: AdvanceMode
  theme: {
    /** Estilo de la pantalla de Gabi: A (letra a la izquierda) o C (una línea gigante). */
    gabiStyle?: 'a' | 'c'
    [key: string]: unknown
  }
  clientUpdatedAt: string
  dirty: 0 | 1
}

/** Montaje del monitor. Depende de cada equipo: no se sincroniza. */
export interface DeviceSettings {
  rotation: 0 | 180
  mirror: boolean
  /** Margen de seguridad en % del ancho, por si el monitor recorta los bordes. */
  marginPct: number
}

export const LIMITS = {
  titleMax: 200,
  artistMax: 200,
  notesMax: 5000,
  speedMin: 0.25,
  speedMax: 4,
  durationMax: 3600,
} as const
