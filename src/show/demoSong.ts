import { parseLyrics } from '../data/parser'
import type { Song } from '../data/types'

/** Letra inventada para probar la pantalla hasta que haya canciones cargadas. */
const LETRA = `[Intro]
(solo)

[Estrofa]
Llegamos de lejos con ganas de fiesta
la noche recién empieza en Córdoba
y si el cuarteto te llama a la pista
no hay forma de quedarse quieto

[Coro]
Mandale baile, mandale baile (x2)
que la noche es larga y el cuarteto no para
mandale baile, que nadie se vaya
hasta que salga el sol

[Estrofa]
Las manos arriba, que suene el acordeón
la gente que salta de lado a lado
(corte)
y una voz que se suma a la canción

[Solo de acordeón]

[Coro]

[Final]
Mandale baile, mandale baile
que esto recién empieza
mandale baile, mandale baile
la Garetto no para
mandale baile, mandale baile
que suene otra vez
mandale baile, mandale baile
hasta el amanecer
gracias Córdoba (silencio)
nos vemos en la próxima`

export const DEMO_SONG: Song = {
  id: 'demo',
  title: 'Mandale baile (demo)',
  artist: 'La Garetto',
  kind: 'cuarteto',
  sections: parseLyrics(LETRA, (() => {
    let n = 0
    return () => `demo-${++n}`
  })()),
  speed: 1,
  advanceMode: null,
  durationSeconds: 245,
  notes: null,
  createdAt: '2026-11-09T00:00:00.000Z',
  clientUpdatedAt: '2026-11-09T00:00:00.000Z',
  deletedAt: null,
  dirty: 0,
}
