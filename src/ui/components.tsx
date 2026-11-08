import {
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { LucideIcon } from 'lucide-react'
import { CUES, type CueKind } from './cues'
import { cx } from './cx'


/* ---------- Tecla ---------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

/* ---------- Botón ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'negro' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  /** Atajo de teclado que se muestra a la derecha. */
  kbd?: string
  block?: boolean
  center?: boolean
  /** Para botones que prenden y apagan algo (aria-pressed). */
  pressed?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  icon: Icon,
  kbd,
  block,
  center,
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = Icon && !children
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
        center && 'btn--center',
        iconOnly && 'btn--icon',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden />}
      {children}
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  )
}

/* ---------- Pad ---------- */

type PadProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  tone?: 'msg' | 'cnt' | 'negro' | 'logo'
  label: ReactNode
  icon?: LucideIcon
  kbd?: string
  /** Encendido: el mensaje está en la pantalla de Gabi. */
  fired?: boolean
}

export function Pad({ tone = 'msg', label, icon: Icon, kbd, fired, className, type = 'button', ...rest }: PadProps) {
  return (
    <button
      type={type}
      aria-pressed={fired}
      className={cx('pad', `pad--${tone}`, tone === 'logo' && 'papel', className)}
      {...rest}
    >
      {kbd ? <Kbd>{kbd}</Kbd> : Icon ? <Icon aria-hidden /> : <span />}
      <span>{label}</span>
    </button>
  )
}

/* ---------- Pastilla ---------- */

export function Pill({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: 'neutral' | 'live' | 'ok' | 'alerta'
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <span className={cx('pill', tone !== 'neutral' && `pill--${tone}`)}>
      {Icon && <Icon aria-hidden />}
      {children}
    </span>
  )
}

/* ---------- Indicación de la letra ---------- */

export function Cue({ kind }: { kind: CueKind }) {
  const { label, icon: Icon } = CUES[kind]
  return (
    <span className="cue">
      <Icon aria-hidden />
      {label}
    </span>
  )
}

/* ---------- Interruptor ---------- */

export function Switch({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track" aria-hidden />
      {children}
    </button>
  )
}

/* ---------- Selector segmentado ---------- */

export type SegOption<T extends string> = { value: T; label: ReactNode; kbd?: string }

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Nombre accesible del grupo. */
  label: string
  options: SegOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const index = options.findIndex((o) => o.value === value)

  // Flechas para moverse entre opciones, como un grupo de radios.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = options[(index + step + options.length) % options.length]
    onChange(next.value)
    const group = e.currentTarget
    requestAnimationFrame(() => group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
  }

  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="seg__opt"
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.kbd && <Kbd>{o.kbd}</Kbd>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Deslizador ---------- */

export function Slider({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  format = (v) => String(v),
  onChange,
}: {
  label: string
  icon?: LucideIcon
  value: number
  min: number
  max: number
  step: number
  format?: (value: number) => string
  onChange: (value: number) => void
}) {
  const id = useId()
  const pct = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className="slider">
      {Icon && <Icon aria-hidden />}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        style={{ '--pct': pct } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id}>{format(value)}</output>
    </div>
  )
}

/* ---------- Panel ---------- */

export function Panel({
  title,
  icon: Icon,
  actions,
  card,
  children,
  className,
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  card?: boolean
}) {
  return (
    <section className={cx('panel', card && 'panel--card', className)} {...rest}>
      {title && (
        <header className="panel__head">
          {Icon && <Icon aria-hidden />}
          <h2 className="panel__title">{title}</h2>
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  )
}

/* ---------- Aviso flotante ---------- */

export function Toast({
  icon: Icon,
  tone = 'ok',
  children,
  action,
}: {
  icon: LucideIcon
  tone?: 'ok' | 'alerta'
  children: ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className={cx('toast', tone === 'alerta' && 'toast--alerta')} role="status">
      <Icon aria-hidden />
      <span>{children}</span>
      {action && (
        <button type="button" className="toast__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

/* ---------- Wordmark provisorio ---------- */

/** "LA" chico arriba de "GARETTO", con la TT unida. Se reemplaza por el SVG del logo. */
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }} role="img" aria-label="La Garetto">
      <span className="wordmark__la" aria-hidden>
        La
      </span>
      <span className="wordmark__name" aria-hidden>
        Gare<span className="wordmark__tt">tt</span>o
      </span>
    </span>
  )
}
