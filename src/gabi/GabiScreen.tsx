import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Guitar, MessageSquare } from 'lucide-react'
import type { CueKind } from '../data/types'
import { CUES } from '../ui/cues'
import { cx } from '../ui/cx'
import { Wordmark } from '../ui/components'
import type { LyricView, Overlay, ShowState, ViewLine } from '../show/view'
import './gabi.css'

/**
 * Pantalla de Gabi. Solo dibuja el estado que manda la consola. Se usa en la
 * ventana del monitor de piso y, en chico, como vista previa en la consola.
 */
export function GabiScreen({ state, waiting = false }: { state: ShowState | null; waiting?: boolean }) {
  const device = state?.device
  const stage: CSSProperties = {
    transform: [device?.rotation === 180 && 'rotate(180deg)', device?.mirror && 'scaleX(-1)'].filter(Boolean).join(' ') || undefined,
    padding: device?.marginPct ? `${device.marginPct}%` : undefined,
  }

  return (
    <div className={cx('gabi', state?.style === 'c' && 'gabi--c')} aria-label="Pantalla de Gabi">
      <div className="gabi__stage" style={stage}>
        <div className="gabi__safe">
          {state?.lyric ? <Lyric view={state.lyric} /> : <Espera waiting={waiting} />}
          {state?.overlay && <OverlayView overlay={state.overlay} />}
        </div>
      </div>
    </div>
  )
}

/* ---------- Letra ---------- */

function Lyric({ view }: { view: LyricView }) {
  return (
    <>
      <div className={cx('g-part', view.kind === 'parte' && 'g-part--parte')}>
        <span>{view.part.label}</span>
        {view.kind === 'parte' && view.page && (
          <span className="g-page tabular">
            {view.page.n}/{view.page.total}
          </span>
        )}
        {view.part.cues.map((c) => (
          <CueTag key={c} kind={c} />
        ))}
      </div>

      {view.kind === 'linea' && <Lines view={view} />}
      {view.kind === 'parte' && <Parte view={view} />}
      {view.kind === 'instrumental' && (
        <div className="g-solo">
          <Guitar aria-hidden />
          <b>{view.part.label}</b>
          {view.next && <span>Vuelve: {view.next.text}</span>}
        </div>
      )}

      {view.sigue && (
        <div className="g-foot">
          Sigue <span className="g-sigue">{view.sigue}</span>
        </div>
      )}
      <div className="g-prog" aria-hidden>
        <i style={{ width: `${view.progress * 100}%` }} />
      </div>
    </>
  )
}

function Lines({ view }: { view: Extract<LyricView, { kind: 'linea' }> }) {
  const [n1, n2] = view.next
  return (
    <>
      {/* La key reinicia la animación de entrada en cada línea nueva. */}
      <div className="g-lines" key={view.now.id}>
        {view.prev && <p className="g-prev">{view.prev.text}</p>}
        <p className="g-now">{view.now.text}</p>
        {n1 && <p className="g-next">{n1.text}</p>}
        {n2 && <p className="g-next2">{n2.text}</p>}
      </div>
      {view.now.cues.length > 0 && (
        <div className="g-cue">
          {view.now.cues.map((c) => {
            const { icon: Icon, label } = CUES[c]
            return (
              <div key={c}>
                <Icon aria-hidden />
                <span>{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/** Tamaño de la letra en modo parte, en px de 1080p: arranca en 88 y baja hasta 64 si no entra. */
const PARTE_MAX = 88
const PARTE_MIN = 64

function Parte({ view }: { view: Extract<LyricView, { kind: 'parte' }> }) {
  const box = useRef<HTMLDivElement>(null)
  const pageKey = view.lines.map((l) => l.id).join()

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      let size = PARTE_MAX
      el.style.setProperty('--fs', String(size))
      while (size > PARTE_MIN && el.scrollHeight > el.clientHeight + 1) {
        size -= 4
        el.style.setProperty('--fs', String(size))
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageKey])

  // La barra de la línea marcada se desliza hasta la nueva posición.
  const marker = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    const bar = marker.current
    if (!el || !bar) return
    const place = () => {
      const line = el.querySelector<HTMLElement>('p.g-now')
      bar.style.opacity = line ? '1' : '0'
      if (!line) return
      bar.style.transform = `translateY(${line.offsetTop}px)`
      bar.style.height = `${line.offsetHeight}px`
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view.mark, pageKey])

  return (
    <div ref={box} className={cx('g-parte', view.mark && 'g-parte--marca')} key={pageKey}>
      <span ref={marker} className="g-marker" aria-hidden />
      {view.lines.map((l) => (
        <p key={l.id} className={cx(l.id === view.mark && 'g-now')}>
          {l.text}
          <LineCues line={l} />
        </p>
      ))}
    </div>
  )
}

function LineCues({ line }: { line: ViewLine }) {
  if (!line.cues.length) return null
  return (
    <span className="g-inline-cues">
      {line.cues.map((c) => (
        <CueTag key={c} kind={c} />
      ))}
    </span>
  )
}

function CueTag({ kind }: { kind: CueKind }) {
  const { icon: Icon, label } = CUES[kind]
  return (
    <span className="g-cuetag">
      <Icon aria-hidden />
      {label}
    </span>
  )
}

/* ---------- Espera y carteles ---------- */

function Espera({ waiting }: { waiting: boolean }) {
  return (
    <div className="g-espera papel">
      <div className="g-espera__logo">
        <Wordmark size={190} />
      </div>
      <p className="g-espera__frase">MANDALE BAILE</p>
      {waiting && <p className="g-espera__wait">Esperando la consola…</p>}
    </div>
  )
}

function useNow(active: boolean, ms = 100) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [active, ms])
  return now
}

function OverlayView({ overlay }: { overlay: Overlay }) {
  const now = useNow(overlay.kind === 'mensaje' || overlay.kind === 'cuenta')

  switch (overlay.kind) {
    case 'negro':
      return <div className="g-negro" />
    case 'logo':
      return (
        <div className="g-over">
          <Espera waiting={false} />
        </div>
      )
    case 'mensaje': {
      const left = Math.max(0, 1 - (now - overlay.shownAt) / overlay.durationMs)
      return (
        <div className="g-cartel papel" role="alert">
          <MessageSquare aria-hidden />
          <b>{overlay.text}</b>
          <i className="g-cartel__bar" style={{ width: `${left * 100}%` }} />
        </div>
      )
    }
    case 'cuenta': {
      const seconds = Math.max(0, Math.ceil((overlay.endsAt - now) / 1000))
      return (
        <div className="g-cuenta">
          <b className="tabular">{seconds}</b>
          {overlay.label && <span>{overlay.label}</span>}
        </div>
      )
    }
  }
}
