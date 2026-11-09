import { Guitar, Pause, Repeat, Scissors, type LucideIcon } from 'lucide-react'
import type { CueKind } from '../data/types'

export type { CueKind }

export const CUES: Record<CueKind, { label: string; icon: LucideIcon }> = {
  silencio: { label: 'Silencio', icon: Pause },
  corte: { label: 'Corte', icon: Scissors },
  x2: { label: '×2', icon: Repeat },
  solo: { label: 'Solo', icon: Guitar },
}
