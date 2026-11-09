import type { SongKind } from '../data/types'

export const SONG_KIND_LABEL: Record<SongKind, string> = {
  propia: 'Propia',
  cuarteto: 'Cuarteto',
  cumbia: 'Cumbia',
  cover: 'Cover',
  otro: 'Otro',
}

/** Sin tildes y en minúscula, para buscar "corazon" y encontrar "Corazón". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Avisos de la consola: un mensaje, y si se puede, cómo deshacerlo. */
export interface Notice {
  message: string
  tone?: 'ok' | 'alerta'
  undo?: () => unknown
}
export type Notify = (n: Notice) => void
