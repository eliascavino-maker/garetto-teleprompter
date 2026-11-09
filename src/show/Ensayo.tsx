import { useEffect, useState } from 'react'
import {
  ChevronsLeft,
  ChevronsRight,
  FlipHorizontal2,
  Monitor,
  Palette,
  RotateCw,
  Timer,
} from 'lucide-react'
import { DEFAULT_QUICK_MESSAGES } from '../data/repo'
import { GabiScreen } from '../gabi/GabiScreen'
import { openGabiWindow } from '../gabi/openGabi'
import { Button, Cue, Kbd, Pad, Panel, Pill, Segmented, Switch, Toast, Wordmark } from '../ui/components'
import { cx } from '../ui/cx'
import { pageOfLine, findStep } from './cursor'
import { DEMO_SONG } from './demoSong'
import { useShow, type ShowController } from './useShow'
import './ensayo.css'

const COUNTDOWN_S = 5

/**
 * Consola de ensayo provisoria: maneja la pantalla de Gabi con una canción de
 * prueba. La consola real (setlist, editor) llega en la etapa 5.
 */
export function Ensayo() {
  const show = useShow(DEMO_SONG, { defaultMode: 'linea', nextSong: 'La que sigue' })
  const [blocked, setBlocked] = useState(false)
  useShowKeys(show)

  const open = () => setBlocked(!openGabiWindow())
  const step = show.steps[show.index]
  const isOn = (kind: string) => show.overlay?.kind === kind

  return (
    <div className="ens">
      <header className="ens-bar">
        <Wordmark size={14} />
        <span className="ens-bar__title">Ensayo · {DEMO_SONG.title}</span>
        <div className="ens-bar__right">
          {show.connected ? (
            <Pill tone="ok" icon={Monitor}>
              Pantalla conectada
            </Pill>
          ) : (
            <Pill tone="alerta" icon={Monitor}>
              Pantalla cerrada
            </Pill>
          )}
          <Button variant="primary" icon={Monitor} onClick={open}>
            {show.connected ? 'Traer pantalla' : 'Abrir pantalla de Gabi'}
          </Button>
          <a className="ens-bar__link" href="#/sistema">
            Sistema de diseño
          </a>
        </div>
      </header>

      <main className="ens-body">
        <Panel title="Letra" actions={<Kbd>clic para saltar</Kbd>} className="ens-letra">
          <div className="ens-ly">
            {DEMO_SONG.sections.map((s, si) => (
              <div key={s.id} className="ens-part">
                <div className={cx('ens-part__h', step?.section === si && 'is-now')}>
                  {s.label}
                  {s.cues.map((c) => (
                    <Cue key={c} kind={c} />
                  ))}
                </div>
                {s.lines.length === 0 && (
                  <button
                    type="button"
                    className={cx('ens-line', 'ens-line--empty', step?.section === si && 'is-now')}
                    onClick={() => show.actions.goTo(findStep(show.steps, { section: si, page: 0, line: null }))}
                  >
                    Instrumental
                  </button>
                )}
                {s.lines.map((l, li) => {
                  const page = pageOfLine(s.lines.length, li)
                  const now =
                    step?.section === si && (step.line === null ? step.page === page : step.line === li)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={cx('ens-line', now && 'is-now')}
                      onClick={() => show.actions.goTo(findStep(show.steps, { section: si, page, line: li }))}
                    >
                      <span>{l.text}</span>
                      {l.cues.map((c) => (
                        <Cue key={c} kind={c} />
                      ))}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </Panel>

        <aside className="ens-side">
          <div className="ens-preview" aria-label="Vista previa">
            <GabiScreen state={show.state} />
          </div>
          <p className="ens-status tabular">
            Paso {show.index + 1} de {show.steps.length}
            {show.atEnd && <b> · Fin del tema</b>}
          </p>

          <div className="ens-transport">
            <Button icon={ChevronsLeft} kbd="⇧←" onClick={show.actions.prevPart} aria-label="Parte anterior" />
            <Button kbd="←" onClick={show.actions.prev} center>
              Anterior
            </Button>
            <Button variant="primary" kbd="→" onClick={show.actions.next} center size="lg">
              Siguiente
            </Button>
            <Button icon={ChevronsRight} kbd="⇧→" onClick={show.actions.nextPart} aria-label="Parte siguiente" />
          </div>

          <div className="ens-row">
            <Segmented
              label="Avance"
              value={show.mode}
              onChange={show.actions.setMode}
              options={[
                { value: 'linea', label: 'Línea' },
                { value: 'parte', label: 'Parte', kbd: 'M' },
              ]}
            />
            {show.mode === 'parte' && (
              <Switch checked={show.marcar} onChange={show.actions.setMarcar}>
                Marcar la línea
              </Switch>
            )}
          </div>

          <div className="ens-row">
            <Segmented
              label="Estilo de la pantalla"
              value={show.style}
              onChange={show.actions.setStyle}
              options={[
                { value: 'a', label: 'Estilo A' },
                { value: 'c', label: 'Estilo C' },
              ]}
            />
            <Button
              icon={RotateCw}
              pressed={show.device.rotation === 180}
              onClick={() => show.actions.setDevice({ ...show.device, rotation: show.device.rotation === 180 ? 0 : 180 })}
              aria-label="Rotar 180°"
              title="Rotar 180°"
            />
            <Button
              icon={FlipHorizontal2}
              pressed={show.device.mirror}
              onClick={() => show.actions.setDevice({ ...show.device, mirror: !show.device.mirror })}
              aria-label="Espejo"
              title="Espejo"
            />
          </div>

          <p className="label">Mensajes a Gabi</p>
          <div className="ens-pads">
            {DEFAULT_QUICK_MESSAGES.map((m, i) => (
              <Pad
                key={m}
                label={m}
                kbd={`F${i + 1}`}
                fired={show.overlay?.kind === 'mensaje' && show.overlay.text === m}
                onClick={() => show.actions.message(m)}
              />
            ))}
            <Pad tone="cnt" icon={Timer} label={`Cuenta ${COUNTDOWN_S}`} kbd="C" fired={isOn('cuenta')} onClick={() => show.actions.countdown(COUNTDOWN_S)} />
            <Pad tone="negro" label="NEGRO" kbd="B" fired={isOn('negro')} onClick={show.actions.toggleNegro} />
            <Pad tone="logo" label="LOGO" kbd="L" fired={isOn('logo')} onClick={show.actions.toggleLogo} />
          </div>
        </aside>
      </main>

      {blocked && (
        <div className="ens-toast">
          <Toast icon={Palette} tone="alerta" action={{ label: 'Entendido', onClick: () => setBlocked(false) }}>
            Chrome bloqueó la ventana: permití las ventanas emergentes para este sitio.
          </Toast>
        </div>
      )}
    </div>
  )
}

/** Atajos de teclado de la consola. También sirven los pasadores (PageUp / PageDown). */
function useShowKeys(show: ShowController) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const a = show.actions
      const key = e.key
      const fn = /^F([1-5])$/.exec(key)
      let handled = true
      if (fn) a.message(DEFAULT_QUICK_MESSAGES[Number(fn[1]) - 1])
      else if (key === 'ArrowRight' || key === 'PageDown' || key === ' ') (e.shiftKey ? a.nextPart : a.next)()
      else if (key === 'ArrowLeft' || key === 'PageUp') (e.shiftKey ? a.prevPart : a.prev)()
      else if (key === 'm' || key === 'M') a.toggleMode()
      else if (key === 'b' || key === 'B') a.toggleNegro()
      else if (key === 'l' || key === 'L') a.toggleLogo()
      else if (key === 'c' || key === 'C') a.countdown(COUNTDOWN_S)
      else if (key === 'Escape') a.clearOverlay()
      else handled = false
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])
}
