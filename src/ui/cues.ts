import { Guitar, Pause, Repeat, Scissors, type LucideIcon } from 'lucide-react'

/** Indicaciones que se pueden marcar en una línea de la letra. */
export type CueKind = 'silencio' | 'corte' | 'x2' | 'solo'

export const CUES: Record<CueKind, { label: string; icon: LucideIcon }> = {
  silencio: { label: 'Silencio', icon: Pause },
  corte: { label: 'Corte', icon: Scissors },
  x2: { label: '×2', icon: Repeat },
  solo: { label: 'Solo', icon: Guitar },
}
