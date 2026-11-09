import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Monitor, Radio, Square, TriangleAlert } from 'lucide-react'
import { DEFAULT_QUICK_MESSAGES } from '../data/repo'
import * as sl from '../data/setlist'
import { store, useData } from '../data/store'
import { openGabiWindow } from '../gabi/openGabi'
import { pageOfLine } from '../show/cursor'
import { DEMO_SONG } from '../show/demoSong'
import { useShow } from '../show/useShow'
import { Button, Pill, Toast, Wordmark } from '../ui/components'
import { COUNTDOWN_S, ControlPanel } from './ControlPanel'
import { LyricsPanel } from './LyricsPanel'
import { SetlistPanel } from './SetlistPanel'
import { usePrefs, type ConsolePrefs } from './prefs'
import './console.css'

/**
 * Consola del operador, dirección A "Mesa de luces": setlist, letra y
 * controles en tres columnas que se pueden ensanchar.
 */
export function Console() {
  const data = useData()
  const [prefs, setPrefs] = usePrefs()
  const [popupBlocked, setPopupBlocked] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const freeTextRef = useRef<HTMLInputElement>(null)

  /* ---------- Setlist y tema en curso ---------- */

  const setlist = data.setlists.find((s) => s.id === prefs.setlistId) ?? data.setlists[0] ?? null
  const byId = useMemo(() => new Map(data.songs.map((s) => [s.id, s])), [data.songs])
  const list = useMemo(
    () => (setlist ? sl.entries(sl.withoutMissing(setlist.items, (id) => byId.has(id))) : []),
    [setlist, byId],
  )
  const entryIndex = Math.max(0, Math.min(prefs.entry, list.length - 1))
  const entry = list[entryIndex]
  const song = (entry && byId.get(entry.songId)) ?? null
  const nextSong = list[entryIndex + 1] ? (byId.get(list[entryIndex + 1].songId)?.title ?? null) : null

  const band = data.band
  const show = useShow(song, {
    defaultMode: band?.defaultAdvance ?? 'linea',
    nextSong,
    loadKey: song ? `${setlist?.id}:${entryIndex}:${song.id}` : undefined,
    startAt: (songId) => (prefs.pos?.songId === songId ? prefs.pos.step : null),
    style: band?.theme.gabiStyle ?? 'a',
    device: data.device,
  })

  // Guarda la posición para retomar si se recarga la página.
  const step = show.step
  useEffect(() => {
    if (song && step) setPrefs({ pos: { songId: song.id, step } })
  }, [song, step, setPrefs])

  /* ---------- Navegación entre temas ---------- */

  const goEntry = useCallback(
    (i: number, at: 'start' | 'end' = 'start') => {
      if (i < 0 || i >= list.length) return false
      const target = byId.get(list[i].songId)
      // "end": al volver con ← desde el comienzo de un tema, cae en el final del anterior.
      const lastStep = target && at === 'end' ? lastStepOf(target.sections) : null
      setPrefs({
        entry: i,
        pos: target && lastStep ? { songId: target.id, step: lastStep } : null,
        songStartedAt: Date.now(),
      })
      return true
    },
    [list, byId, setPrefs],
  )

  const nav = useMemo(
    () => ({
      next: () => show.actions.next() || goEntry(entryIndex + 1),
      prev: () => show.actions.prev() || goEntry(entryIndex - 1, 'end'),
      nextPart: () => show.actions.nextPart() || goEntry(entryIndex + 1),
      prevPart: () => show.actions.prevPart() || goEntry(entryIndex - 1),
    }),
    [show.actions, goEntry, entryIndex],
  )

  /* ---------- Atajos ---------- */

  const messages = band?.quickMessages ?? DEFAULT_QUICK_MESSAGES
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"], [data-drag-handle]')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const a = show.actions
      const fn = /^F([1-6])$/.exec(e.key)
      let handled = true
      if (fn) {
        const n = Number(fn[1])
        if (n === 6) freeTextRef.current?.focus()
        else if (messages[n - 1]) a.message(messages[n - 1])
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        ;(e.shiftKey ? nav.nextPart : nav.next)()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        ;(e.shiftKey ? nav.prevPart : nav.prev)()
      } else {
        switch (e.key.toLowerCase()) {
          case 'm':
            a.toggleMode()
            break
          case 'b':
            a.toggleNegro()
            break
          case 'l':
            a.toggleLogo()
            break
          case 'c':
            a.countdown(COUNTDOWN_S)
            break
          case '/':
            searchRef.current?.focus()
            break
          case 'escape':
            a.clearOverlay()
            break
          default:
            handled = false
        }
      }
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show.actions, nav, messages])

  /* ---------- Acciones de datos ---------- */

  const createSetlist = async () => {
    const today = new Date()
    const name = `Show ${today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`
    const s = await store.createSetlist({ name, showDate: today.toISOString().slice(0, 10) })
    setPrefs({ setlistId: s.id, entry: 0, pos: null })
  }

  const loadExample = async () => {
    const { id: _id, createdAt: _c, clientUpdatedAt: _u, deletedAt: _d, dirty: _x, ...rest } = DEMO_SONG
    const s = await store.createSong({ ...rest, title: 'Mandale baile (ejemplo)' })
    const target = setlist ?? (await store.createSetlist({ name: 'Ejemplo' }))
    await store.saveSetlist({ ...target, items: sl.addSong(target.items, s.id) })
    setPrefs({ setlistId: target.id })
  }

  const open = () => setPopupBlocked(!openGabiWindow())

  /* ---------- Render ---------- */

  const position = show.steps.length ? `Paso ${show.index + 1} de ${show.steps.length}` : null

  if (!data.ready) return <div className="con-loading">Cargando…</div>

  return (
    <div
      className="con"
      style={{ '--col-setlist': `${prefs.columns.setlist}px`, '--col-controls': `${prefs.columns.controls}px` } as React.CSSProperties}
    >
      <header className="con-bar">
        <Wordmark size={15} />
        <span className="con-bar__title">Gabi Garetto · Teleprompter</span>
        <Clocks prefs={prefs} songDuration={song?.durationSeconds ?? null} />
        <div className="con-bar__right">
          {prefs.showStartedAt ? (
            <Button size="sm" variant="ghost" icon={Square} onClick={() => setPrefs({ showStartedAt: null })} className="con-live">
              <Pill tone="live">EN VIVO</Pill>
              <span className="sr-only">Terminar el show</span>
            </Button>
          ) : (
            <Button size="sm" icon={Radio} onClick={() => setPrefs({ showStartedAt: Date.now(), songStartedAt: Date.now() })}>
              Empezar show
            </Button>
          )}
          {show.connected ? (
            <Pill tone="ok" icon={Monitor}>
              Pantalla conectada
            </Pill>
          ) : (
            <Button size="sm" variant="primary" icon={Monitor} onClick={open}>
              Abrir pantalla de Gabi
            </Button>
          )}
          {show.connected && (
            <Button size="sm" variant="ghost" icon={Monitor} onClick={open} aria-label="Traer la pantalla de Gabi al frente" title="Traer la pantalla al frente" />
          )}
        </div>
      </header>

      <main className="con-body">
        <SetlistPanel
          setlists={data.setlists}
          setlist={setlist}
          songs={data.songs}
          current={entry ? entryIndex : -1}
          searchRef={searchRef}
          onPickSetlist={(id) => setPrefs({ setlistId: id, entry: 0, pos: null })}
          onCreateSetlist={createSetlist}
          onSaveSetlist={(s) => void store.saveSetlist(s)}
          onDeleteSetlist={(id) => {
            void store.deleteSetlist(id)
            setPrefs({ setlistId: null, entry: 0, pos: null })
          }}
          onSelectEntry={(i) => goEntry(i)}
          onLoadExample={loadExample}
        />
        <Splitter
          label="Ancho del setlist"
          value={prefs.columns.setlist}
          min={220}
          max={460}
          onChange={(v) => setPrefs((p) => ({ columns: { ...p.columns, setlist: v } }))}
        />
        <LyricsPanel song={song} show={show} position={position} />
        <Splitter
          label="Ancho de los controles"
          value={prefs.columns.controls}
          min={320}
          max={560}
          invert
          onChange={(v) => setPrefs((p) => ({ columns: { ...p.columns, controls: v } }))}
        />
        <ControlPanel
          show={show}
          messages={messages}
          freeTextRef={freeTextRef}
          nav={nav}
          onStyle={(gabiStyle) => void store.saveBandSettings({ theme: { ...band?.theme, gabiStyle } })}
          onDevice={(d) => void store.saveDeviceSettings(d)}
        />
      </main>

      {(popupBlocked || data.error) && (
        <div className="con-toast">
          <Toast
            icon={TriangleAlert}
            tone="alerta"
            action={popupBlocked ? { label: 'Entendido', onClick: () => setPopupBlocked(false) } : undefined}
          >
            {popupBlocked
              ? 'Chrome bloqueó la ventana: permití las ventanas emergentes para este sitio.'
              : `No se pudo abrir la base local: ${data.error}`}
          </Toast>
        </div>
      )}
    </div>
  )
}

/* ---------- Relojes ---------- */

function Clocks({ prefs, songDuration }: { prefs: ConsolePrefs; songDuration: number | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const showS = prefs.showStartedAt ? (now - prefs.showStartedAt) / 1000 : null
  const songS = prefs.showStartedAt && prefs.songStartedAt ? (now - Math.max(prefs.songStartedAt, prefs.showStartedAt)) / 1000 : null
  return (
    <div className="con-clock tabular" aria-label="Relojes">
      <div>
        <small>Show</small>
        <b>{showS === null ? '--:--' : sl.formatDuration(showS)}</b>
      </div>
      <div className="con-clock__song">
        <small>Tema</small>
        <b>
          {songS === null ? '--:--' : sl.formatDuration(songS)}
          {songDuration != null && <span> / {sl.formatDuration(songDuration)}</span>}
        </b>
      </div>
    </div>
  )
}

/* ---------- Divisor entre columnas ---------- */

function Splitter(props: { label: string; value: number; min: number; max: number; invert?: boolean; onChange: (v: number) => void }) {
  const { value, min, max, invert, onChange } = props
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)))

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startV = value
    const move = (ev: PointerEvent) => onChange(clamp(startV + (ev.clientX - startX) * (invert ? -1 : 1)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('is-resizing')
    }
    document.body.classList.add('is-resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      className="con-split"
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-drag-handle
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(clamp((min + max) / 2))}
      onKeyDown={(e) => {
        const d = e.key === 'ArrowRight' ? 16 : e.key === 'ArrowLeft' ? -16 : 0
        if (!d) return
        e.preventDefault()
        onChange(clamp(value + d * (invert ? -1 : 1)))
      }}
    />
  )
}

function lastStepOf(sections: { lines: unknown[] }[]) {
  const section = sections.length - 1
  if (section < 0) return null
  const count = sections[section].lines.length
  return count ? { section, page: pageOfLine(count, count - 1), line: count - 1 } : { section, page: 0, line: null }
}
