import { useEffect, useRef } from 'react'
import { BookOpen, CircleHelp, Keyboard, Monitor, PenLine, Settings2, X } from 'lucide-react'
import { Button, Kbd, Switch } from '../ui/components'

interface Props {
  reduceMotion: boolean
  onReduceMotion: (v: boolean) => void
  onShowGuide: () => void
  onClose: () => void
}

/**
 * Atajos: cada tecla es una palabra; "+", "/" y "–" van como texto entre teclas.
 * Los de la consola, en el orden en que se usan en un show.
 */
type KeyRow = [keys: string, what: string]

const SHOW_KEYS: KeyRow[] = [
  ['→ Espacio AvPág', 'Avanzar. Al final del tema pasa al siguiente.'],
  ['← RePág', 'Volver. Desde el comienzo, vuelve al final del tema anterior.'],
  ['⇧ + → / ←', 'Parte siguiente o anterior.'],
  ['M', 'Avance por línea o por parte.'],
  ['F1 – F5', 'Mensajes rápidos a Gabi. Otra vez la misma tecla lo saca.'],
  ['F6', 'Escribir un mensaje libre (Enter lo manda).'],
  ['C', 'Cuenta regresiva de 5.'],
  ['L', 'LOGO en la pantalla de Gabi.'],
  ['B', 'NEGRO: la pantalla de Gabi en negro total.'],
  ['Esc', 'Sacar el mensaje, la cuenta, LOGO o NEGRO.'],
  ['/', 'Buscar un tema para agregar al setlist.'],
  ['Ctrl + Z', 'Deshacer lo último: sacar un tema, borrar, importar.'],
  ['?', 'Esta ayuda.'],
]

const EDITOR_KEYS: KeyRow[] = [
  ['Ctrl + Z / Y', 'Deshacer y rehacer en el editor.'],
  ['Ctrl + S', 'Guardar ya (igual se guarda solo).'],
  ['Esc', 'Volver a la consola.'],
]

const SEPARATORS = new Set(['+', '–'])

/** Ayuda: atajos, formato de la letra, cómo conectar el monitor y ajustes de este equipo. */
export function Help({ reduceMotion, onReduceMotion, onShowGuide, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)

  // Esc cierra la ayuda antes que cualquier otra cosa (por ejemplo, Canciones).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    const prev = document.activeElement as HTMLElement | null
    box.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div className="help" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="help__box" role="dialog" aria-modal="true" aria-labelledby="help-t" tabIndex={-1} ref={box}>
        <header className="help__head">
          <CircleHelp aria-hidden />
          <h2 id="help-t">Ayuda</h2>
          <Button size="sm" variant="ghost" icon={X} kbd="Esc" onClick={onClose}>
            Cerrar
          </Button>
        </header>

        <div className="help__body">
          <section className="help__sec help__sec--keys">
            <h3>
              <Keyboard aria-hidden />
              Atajos durante el show
            </h3>
            <Keys rows={SHOW_KEYS} />
          </section>

          <div className="help__col">
            <section className="help__sec">
              <h3>
                <Monitor aria-hidden />
                Conectar el monitor de Gabi
              </h3>
              <ol className="help__steps">
                <li>
                  Enchufá el monitor por HDMI y elegí “Extender” con <Kbd>Windows</Kbd> + <Kbd>P</Kbd>.
                </li>
                <li>Apretá “Abrir pantalla de Gabi”. Si Chrome pide permiso para ubicar ventanas, aceptalo: la ventana va sola al monitor.</li>
                <li>Hacé un clic en la ventana de Gabi para la pantalla completa (o F11 en esa ventana).</li>
                <li>
                  Sin permiso: arrastrá la ventana al monitor y hacé el clic. La barra avisa si falta la pantalla completa.
                </li>
              </ol>
            </section>

            <section className="help__sec">
              <h3>
                <PenLine aria-hidden />
                Cómo escribir la letra
              </h3>
              <ul className="help__list">
                <li>Una línea en blanco separa las partes. Los coros que se repiten se detectan solos.</li>
                <li>
                  Encabezados entre corchetes: <code>[Coro]</code>, <code>[Coro x2]</code>, <code>[Solo de acordeón]</code>. Un <code>[Coro]</code> vacío
                  repite el último coro.
                </li>
                <li>
                  Indicaciones al final de la línea: <code>(corte)</code>, <code>(silencio)</code>, <code>(solo)</code>, <code>(x2)</code>.
                </li>
                <li>Los acordes se sacan solos, también los que van entre corchetes en la letra.</li>
              </ul>
              <Keys rows={EDITOR_KEYS} />
            </section>

            <section className="help__sec">
              <h3>
                <Settings2 aria-hidden />
                Este equipo
              </h3>
              <Switch checked={reduceMotion} onChange={onReduceMotion}>
                Reducir movimiento en las dos pantallas
              </Switch>
              <p className="help__note">Apagado, sigue lo que diga Windows. Prendido, la letra cambia con un fundido corto, sin deslizarse.</p>
              <Button
                size="sm"
                icon={BookOpen}
                onClick={() => {
                  onShowGuide()
                  onClose()
                }}
              >
                Ver los primeros pasos
              </Button>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Keys({ rows }: { rows: KeyRow[] }) {
  return (
    <dl className="help__keys">
      {rows.map(([keys, what]) => (
        <div key={keys}>
          <dt>
            {keys.split(' ').map((k, i, all) =>
              // "/" es tecla si va sola; entre otras teclas, es separador.
              SEPARATORS.has(k) || (k === '/' && all.length > 1) ? (
                <span key={i}>{k}</span>
              ) : (
                <Kbd key={i}>{k}</Kbd>
              ),
            )}
          </dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  )
}
