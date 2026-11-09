import { useState } from 'react'
import { ChevronsLeft, ChevronsRight, FlipHorizontal2, MessageSquare, RotateCw, Send, Timer } from 'lucide-react'
import type { DeviceSettings } from '../data/types'
import { GabiScreen } from '../gabi/GabiScreen'
import type { GabiStyle } from '../show/view'
import type { ShowController } from '../show/useShow'
import { Button, Pad, Segmented, Switch } from '../ui/components'

export const COUNTDOWN_S = 5

interface Props {
  show: ShowController
  messages: string[]
  freeTextRef: React.RefObject<HTMLInputElement | null>
  nav: { next: () => void; prev: () => void; nextPart: () => void; prevPart: () => void }
  onStyle: (s: GabiStyle) => void
  onDevice: (d: Partial<DeviceSettings>) => void
}

export function ControlPanel({ show, messages, freeTextRef, nav, onStyle, onDevice }: Props) {
  const [text, setText] = useState('')
  const on = (kind: string) => show.overlay?.kind === kind

  const sendText = () => {
    const t = text.trim()
    if (!t) return
    show.actions.message(t)
    setText('')
    freeTextRef.current?.blur()
  }

  return (
    <section className="panel con-controls" aria-label="Controles">
      <div className="panel__body con-controls__body">
        <div className="con-preview" aria-label="Lo que ve Gabi">
          <GabiScreen state={show.state} />
        </div>

        <div className="con-transport">
          <Button variant="primary" size="lg" kbd="→" onClick={nav.next} center>
            Siguiente
          </Button>
          <Button size="lg" kbd="←" onClick={nav.prev} aria-label="Anterior" title="Anterior" />
          <Button size="lg" icon={ChevronsRight} kbd="⇧→" onClick={nav.nextPart} aria-label="Parte siguiente" title="Parte siguiente" />
          <Button size="lg" icon={ChevronsLeft} kbd="⇧←" onClick={nav.prevPart} aria-label="Parte anterior" title="Parte anterior" />
        </div>

        <div className="con-row">
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
              Marcar línea
            </Switch>
          )}
        </div>

        <div className="con-row">
          <Segmented
            label="Estilo de la pantalla de Gabi"
            value={show.style}
            onChange={onStyle}
            options={[
              { value: 'a', label: 'Estilo A' },
              { value: 'c', label: 'Estilo C' },
            ]}
          />
          <Button
            icon={RotateCw}
            pressed={show.device.rotation === 180}
            onClick={() => onDevice({ rotation: show.device.rotation === 180 ? 0 : 180 })}
            aria-label="Rotar la pantalla de Gabi 180°"
            title="Rotar 180°"
          />
          <Button
            icon={FlipHorizontal2}
            pressed={show.device.mirror}
            onClick={() => onDevice({ mirror: !show.device.mirror })}
            aria-label="Espejar la pantalla de Gabi"
            title="Espejo"
          />
        </div>

        <p className="label">Mensajes a Gabi</p>
        <div className="con-pads">
          {messages.slice(0, 5).map((m, i) => (
            <Pad
              key={`${i}-${m}`}
              label={m}
              kbd={`F${i + 1}`}
              fired={show.overlay?.kind === 'mensaje' && show.overlay.text === m}
              onClick={() => show.actions.message(m)}
            />
          ))}
          <Pad tone="cnt" icon={Timer} label={`Cuenta ${COUNTDOWN_S}`} kbd="C" fired={on('cuenta')} onClick={() => show.actions.countdown(COUNTDOWN_S)} />
          <Pad tone="logo" label="LOGO" kbd="L" fired={on('logo')} onClick={show.actions.toggleLogo} />
          <Pad tone="negro" label="NEGRO" kbd="B" fired={on('negro')} onClick={show.actions.toggleNegro} />
        </div>

        <form
          className="con-freetext"
          onSubmit={(e) => {
            e.preventDefault()
            sendText()
          }}
        >
          <MessageSquare aria-hidden />
          <input
            ref={freeTextRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensaje libre (F6)"
            maxLength={60}
            aria-label="Mensaje libre para Gabi"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setText('')
                e.currentTarget.blur()
              }
            }}
          />
          <Button type="submit" size="sm" icon={Send} aria-label="Mandar mensaje" disabled={!text.trim()} />
        </form>
      </div>
    </section>
  )
}
