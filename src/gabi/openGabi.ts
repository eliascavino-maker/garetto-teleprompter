import { placeOnExternalScreen, type Placement } from '../platform/screens'

const WINDOW_NAME = 'garetto-gabi'

let win: Window | null = null

export type OpenResult = { blocked: true } | ({ blocked: false } & Placement)

/**
 * Abre la ventana de Gabi (o la trae al frente si ya está) y la manda al
 * monitor de piso si se puede. Tiene que llamarse desde un clic o una tecla:
 * la ventana se abre antes de cualquier espera, para que Chrome no la bloquee.
 */
export async function openGabiWindow({ place = true }: { place?: boolean } = {}): Promise<OpenResult | null> {
  if (!win || win.closed) {
    // Si la consola se recargó, el mismo nombre encuentra la ventana que ya estaba.
    const url = `${import.meta.env.BASE_URL}#/gabi`
    win = window.open(url, WINDOW_NAME, 'popup,width=960,height=540')
  }
  if (!win) return { blocked: true }
  win.focus()
  // Si ya está en pantalla completa en el monitor, no se mueve.
  if (!place) return null
  return { blocked: false, ...(await placeOnExternalScreen(win)) }
}
