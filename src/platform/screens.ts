/*
 * Window Management API (Chrome): saber qué monitores hay y mandar la ventana
 * de Gabi al de piso. Si no está o no hay permiso, queda la alternativa manual:
 * arrastrar la ventana al monitor y hacer clic (o F11).
 */

/** Lo que usamos de cada pantalla. */
export interface ScreenArea {
  label: string
  isPrimary: boolean
  isInternal: boolean
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
}

type ScreenDetailed = ScreenArea
interface ScreenDetails extends EventTarget {
  readonly screens: ScreenDetailed[]
  readonly currentScreen: ScreenDetailed
}

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetails>
  }
  interface Screen {
    /** true si hay más de un monitor (Chrome, sin pedir permiso). */
    readonly isExtended?: boolean
  }
}

/**
 * El monitor para Gabi: otro que no sea donde está la consola, mejor si es
 * externo (no la pantalla de la notebook). null si hay uno solo.
 */
export function pickExternal<S extends ScreenArea>(screens: S[], current: S): S | null {
  const others = screens.filter((s) => s !== current)
  return others.find((s) => !s.isInternal) ?? others[0] ?? null
}

export type Placement =
  /** Se mandó al otro monitor. */
  | { kind: 'external'; label: string }
  /** Hay un solo monitor (o no está en modo "Extender"). */
  | { kind: 'single' }
  /** El navegador no dio permiso para ubicar ventanas. */
  | { kind: 'denied' }
  /** El navegador no tiene la API. */
  | { kind: 'unsupported' }

/** Mueve la ventana al monitor de Gabi y la estira a todo el monitor. */
export async function placeOnExternalScreen(win: Window): Promise<Placement> {
  if (!window.getScreenDetails) return { kind: 'unsupported' }
  if (window.screen.isExtended === false) return { kind: 'single' }
  let details: ScreenDetails
  try {
    details = await window.getScreenDetails()
  } catch {
    return { kind: 'denied' }
  }
  const target = pickExternal(details.screens, details.currentScreen)
  if (!target) return { kind: 'single' }
  const place = () => {
    win.moveTo(target.availLeft, target.availTop)
    win.resizeTo(target.availWidth, target.availHeight)
  }
  place()
  // Una ventana recién abierta a veces ignora el primer movimiento.
  win.addEventListener('load', place, { once: true })
  return { kind: 'external', label: target.label }
}
