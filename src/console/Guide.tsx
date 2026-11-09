import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, ListMusic, Monitor, Music, PartyPopper, X } from 'lucide-react'
import { Button, Kbd } from '../ui/components'
import { cx } from '../ui/cx'

export interface GuideProgress {
  songs: boolean
  setlist: boolean
  /** La pantalla está abierta pero le falta la pantalla completa. */
  screenOpen: boolean
  screen: boolean
}

interface Props {
  progress: GuideProgress
  hasSetlist: boolean
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
  onClose: () => void
  onOpenLibrary: () => void
  onLoadExample: () => void
  onCreateSetlist: () => void
  onFocusSearch: () => void
  onOpenScreen: () => void
}

/**
 * Primeros pasos: tres tareas, de cero al show armado. Cada una se marca sola
 * cuando se cumple. No tapa la consola: se puede achicar o cerrar.
 */
export function Guide({ progress, hasSetlist, collapsed, ...p }: Props) {
  const flags = [progress.songs, progress.setlist, progress.screen]
  const done = flags.filter(Boolean).length
  const all = done === 3
  // Solo el paso que toca muestra el detalle; los demás quedan en una línea.
  const current = flags.indexOf(false) + 1

  if (collapsed) {
    return (
      <button type="button" className="guia guia--pill" onClick={() => p.onCollapse(false)}>
        <span className="guia__count tabular">{done}/3</span>
        Primeros pasos
        <ChevronUp aria-hidden />
      </button>
    )
  }

  return (
    <section className="guia" aria-label="Primeros pasos">
      <header className="guia__head">
        <h2>{all ? 'Todo listo para el show' : 'Primeros pasos'}</h2>
        <span className="guia__count tabular" aria-label={`${done} de 3 hechos`}>
          {done}/3
        </span>
        <button type="button" className="icon-btn" onClick={() => p.onCollapse(true)} aria-label="Achicar" title="Achicar">
          <ChevronDown aria-hidden />
        </button>
        <button type="button" className="icon-btn" onClick={p.onClose} aria-label="Cerrar la guía" title="Cerrar (se vuelve a abrir con ?)">
          <X aria-hidden />
        </button>
      </header>

      {all ? (
        <div className="guia__fin">
          <PartyPopper aria-hidden />
          <p>
            Probá con <Kbd>→</Kbd> y mirá cómo avanza la letra en la pantalla de Gabi. Los atajos están en la ayuda (<Kbd>?</Kbd>).
          </p>
          <Button size="sm" variant="primary" onClick={p.onClose}>
            Cerrar la guía
          </Button>
        </div>
      ) : (
        <ol className="guia__steps">
          <Step n={1} open={current === 1} done={progress.songs} icon={Music} title="Cargá las canciones">
            <p>Pegá una letra o traé archivos .txt, .docx o PDF.</p>
            <div className="guia__row">
              <Button size="sm" variant="primary" icon={Music} onClick={p.onOpenLibrary}>
                Abrir Canciones
              </Button>
              <Button size="sm" variant="ghost" onClick={p.onLoadExample}>
                Probar con el ejemplo
              </Button>
            </div>
          </Step>
          <Step n={2} open={current === 2} done={progress.setlist} icon={ListMusic} title="Armá el setlist">
            <p>
              Agregá los temas con el buscador (<Kbd>/</Kbd>). Para que dos temas vayan seguidos, enganchalos con el botón de la cadena.
            </p>
            <div className="guia__row">
              {hasSetlist ? (
                <Button size="sm" onClick={p.onFocusSearch}>
                  Buscar un tema
                </Button>
              ) : (
                <Button size="sm" onClick={p.onCreateSetlist}>
                  Nuevo setlist
                </Button>
              )}
            </div>
          </Step>
          <Step n={3} open={current === 3} done={progress.screen} icon={Monitor} title="Conectá la pantalla de Gabi">
            {progress.screenOpen ? (
              <p className="guia__falta">Falta un clic en la ventana de Gabi para la pantalla completa (o F11 en esa ventana).</p>
            ) : (
              <p>
                Enchufá el monitor por HDMI y elegí “Extender” (<Kbd>Windows</Kbd> + <Kbd>P</Kbd>). Después abrí la pantalla: si Chrome pide permiso para
                ubicar ventanas, aceptalo.
              </p>
            )}
            {!progress.screenOpen && (
              <div className="guia__row">
                <Button size="sm" icon={Monitor} onClick={p.onOpenScreen}>
                  Abrir pantalla de Gabi
                </Button>
              </div>
            )}
          </Step>
        </ol>
      )}
    </section>
  )
}

function Step({ n, open, done, icon: Icon, title, children }: { n: number; open: boolean; done: boolean; icon: typeof Music; title: string; children: ReactNode }) {
  return (
    <li className={cx('guia__step', done && 'is-done', open && 'is-open')} aria-current={open ? 'step' : undefined}>
      <span className="guia__mark" aria-hidden>
        {done ? <Check /> : n}
      </span>
      <div className="guia__body">
        <h3>
          <Icon aria-hidden />
          {title}
          {done && <span className="sr-only"> (hecho)</span>}
        </h3>
        {open && children}
      </div>
    </li>
  )
}
