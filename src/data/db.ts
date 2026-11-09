import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Setlist, Song } from './types'

/*
 * IndexedDB es la fuente de verdad durante el show: todo se lee y se escribe
 * acá, con o sin internet. Supabase es el respaldo.
 */

export const DB_NAME = 'garetto-teleprompter'
export const DB_VERSION = 1

export interface TpSchema extends DBSchema {
  songs: { key: string; value: Song; indexes: { 'by-dirty': number } }
  setlists: { key: string; value: Setlist; indexes: { 'by-dirty': number } }
  /** Clave y valor: ajustes de la banda, del equipo y el cursor de sincronización. */
  kv: { key: string; value: unknown }
}

export type TpDB = IDBPDatabase<TpSchema>

export function openTpDb(name: string = DB_NAME): Promise<TpDB> {
  return openDB<TpSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const songs = db.createObjectStore('songs', { keyPath: 'id' })
        songs.createIndex('by-dirty', 'dirty')
        const setlists = db.createObjectStore('setlists', { keyPath: 'id' })
        setlists.createIndex('by-dirty', 'dirty')
        db.createObjectStore('kv')
      }
    },
  })
}
