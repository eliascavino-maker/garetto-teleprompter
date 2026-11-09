const WINDOW_NAME = 'garetto-gabi'

let win: Window | null = null

/**
 * Abre la ventana de Gabi, o la trae al frente si ya está abierta. Tiene que
 * llamarse desde un clic o una tecla: el navegador bloquea las ventanas que
 * se abren solas. Devuelve false si la bloqueó igual.
 */
export function openGabiWindow(): boolean {
  if (win && !win.closed) {
    win.focus()
    return true
  }
  const url = `${import.meta.env.BASE_URL}#/gabi`
  win = window.open(url, WINDOW_NAME, 'popup,width=960,height=540')
  return win !== null
}
