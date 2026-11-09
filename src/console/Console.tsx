import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { CircleCheck, CircleHelp, ListMusic, Monitor, MonitorUp, Music, Radio, RefreshCw, Square, TriangleAlert, WifiOff } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useWakeLock } from '../platform/wakeLock'
import type { ScreenInfo } from '../show/channel'
import { DEFAULT_QUICK_MESSAGES } from '../data/repo'
import * as sl from '../data/setlist'
import { store, useData } from '../data/store'
import { openGabiWindow } from '../gabi/openGabi'
import { pageOfLine } from '../show/cursor'
import { Library, type LibraryStart } from '../editor/Library'
import { DEMO_SONG } from '../show/demoSong'
import { useShow } from '../show/useShow'
import { Button, Pill, Toast, Wordmark } from '../ui/components'
import { cx } from '../ui/cx'
import type { Notice } from '../ui/labels'
import { COUNTDOWN_S, ControlPanel } from './ControlPanel'
import { LyricsPanel } from './LyricsPanel'
import { SetlistPanel } from './SetlistPanel'
import { Guide } from './Guide'
import { Help } from './Help'
import { useGuidePrefs, usePrefs, type ConsolePrefs } from './prefs'
import { useReducedMotion } from '../platform/motion'
import './console.css'

/**
 * Consola del operador, dirección A "Mesa de luces": setlist, letra y
 * controles en tres columnas que se pueden ensanchar.
 */
export function Console() {
  const data = useData()
  const [prefs, setPrefs] = usePrefs()
  const [guide, setGuide] = useGuidePrefs()
  const [help, setHelp] = useState(false)
  // En pantallas angostas (tablet vertical) el setlist es un panel que se abre aparte.
  const [setlistOpen, setSetlistOpen] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [library, setLibrary] = useState<{ start: LibraryStart } | null>(null)
  const [notice, setNotice] = useState<(Notice & { id: number }) | null>(null)
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

  /* ---------- Avisos con deshacer ---------- */

  const notify = useCallback((n: Notice) => setNotice({ ...n, id: Date.now() }), [])
  const runUndo = useCallback(() => {
    const undo = notice?.undo
    if (!undo) return
    setNotice(null)
    void Promise.resolve(undo()).then(() => setNotice({ id: Date.now(), message: 'Listo, se deshizo.' }))
  }, [notice])

  useEffect(() => {
    if (!notice) return
    const ms = notice.tone === 'alerta' ? 10_000 : notice.undo ? 8000 : 4000
    const t = setTimeout(() => setNotice((n) => (n?.id === notice.id ? null : n)), ms)
    return () => clearTimeout(t)
  }, [notice])

  const openLibrary = useCallback((start: LibraryStart) => setLibrary({ start }), [])
  const closeLibrary = useCallback(() => setLibrary(null), [])
  const closeHelp = useCallback(() => setHelp(false), [])

  // En pantalla angosta el buscador está en el panel del setlist: primero se abre.
  const focusSearch = useCallback(() => {
    const input = searchRef.current
    input?.focus()
    // Visible: ya tiene el foco y lo que se tipee entra ahí. Si estaba en el panel cerrado, se enfoca al abrirlo.
    if (input && document.activeElement === input) return
    setSetlistOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [])

  /* ---------- Atajos ---------- */

  const messages = band?.quickMessages ?? DEFAULT_QUICK_MESSAGES
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"], [data-drag-handle]')) return
      // Ctrl+Z deshace lo último que avisó la consola (sacar un tema, borrar, importar).
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && notice?.undo) {
        e.preventDefault()
        runUndo()
        return
      }
      // Con Canciones abierto, los atajos del show no corren.
      // La ayuda tapa todo: mientras está abierta, los atajos no corren.
      if (help) return
      if (e.key === '?') {
        e.preventDefault()
        setHelp(true)
        return
      }
      if (library) return
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
            focusSearch()
            break
          case 'escape':
            a.clearOverlay()
            break
          default:
            handled = false
        }
      }
      if (handled) {
        // Las teclas del show son de la consola: un botón o selector con foco (por un clic)
        // no las recibe. Si no, → sobre "Parte" volvería a "Línea" y Espacio sobre LOGO lo apagaría.
        e.preventDefault()
        e.stopPropagation()
      }
    }
    // En captura: corre antes que los controles de la página.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [show.actions, nav, messages, library, help, notice, runUndo, focusSearch])

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

  /** Abre la pantalla de Gabi y la manda al monitor de piso. Avisa qué pasó. */
  const open = async () => {
    const r = await openGabiWindow({ place: !show.screen?.fullscreen })
    setPopupBlocked(r?.blocked === true)
    if (!r || r.blocked) return
    if (r.kind === 'external')
      notify({ message: `Pantalla de Gabi en ${r.label ? `“${r.label}”` : 'el otro monitor'}. Hacé un clic en ella para ponerla en pantalla completa.` })
    else if (r.kind === 'single')
      notify({ tone: 'alerta', message: 'No encuentro el monitor de Gabi. Conectalo y elegí “Extender” (Windows + P).' })
    else notify({ tone: 'alerta', message: 'Arrastrá la ventana de Gabi al monitor y hacé un clic en ella (o F11) para pantalla completa.' })
  }

  // Que no se apague la pantalla de la notebook durante el show.
  useWakeLock(show.connected || prefs.showStartedAt !== null)
  useReducedMotion(data.device.reduceMotion ?? false)

  // App sin internet: avisa cuando quedó lista y cuando hay una versión nueva.
  // Nunca se actualiza sola: el operador elige cuándo.
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onOfflineReady: () => notify({ message: 'Listo: la app ya funciona sin internet.' }) })
  const online = useOnline()

  /* ---------- Render ---------- */

  const position = show.steps.length ? `Paso ${show.index + 1} de ${show.steps.length}` : null

  if (!data.ready) return <div className="con-loading">Cargando…</div>

  return (
    <>
    <div
      className="con"
      data-setlist-open={setlistOpen || undefined}
      inert={!!library || help}
      style={{ '--col-setlist': `${prefs.columns.setlist}px`, '--col-controls': `${prefs.columns.controls}px` } as React.CSSProperties}
    >
      <header className="con-bar">
        <Button size="sm" variant="ghost" icon={ListMusic} className="con-bar__setlist" pressed={setlistOpen} onClick={() => setSetlistOpen(!setlistOpen)}>
          Setlist
        </Button>
        <Wordmark size={15} />
        <span className="con-bar__title">Gabi Garetto · Teleprompter</span>
        <Button size="sm" variant="ghost" icon={Music} onClick={() => openLibrary(song ? { songId: song.id } : null)}>
          Canciones
        </Button>
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
          {!online && (
            <span title="No pasa nada: todo funciona sin internet.">
              <Pill icon={WifiOff}>Sin internet</Pill>
            </span>
          )}
          {needRefresh && (
            <Button
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              onClick={() => void updateServiceWorker(true)}
              title="Hay una versión nueva. Se recarga la consola; la pantalla de Gabi sigue igual."
            >
              Actualizar
            </Button>
          )}
          {show.connected ? (
            <ScreenPill info={show.screen} />
          ) : (
            <Button size="sm" variant="primary" icon={Monitor} onClick={() => void open()}>
              Abrir pantalla de Gabi
            </Button>
          )}
          {show.connected && (
            <Button
              size="sm"
              variant="ghost"
              icon={show.screen?.fullscreen ? Monitor : MonitorUp}
              onClick={() => void open()}
              aria-label={show.screen?.fullscreen ? 'Traer la pantalla de Gabi al frente' : 'Mandar la pantalla de Gabi al monitor'}
              title={show.screen?.fullscreen ? 'Traer la pantalla al frente' : 'Mandar la pantalla al monitor'}
            />
          )}
          <Button size="sm" variant="ghost" icon={CircleHelp} onClick={() => setHelp(true)} aria-label="Ayuda (?)" title="Ayuda y atajos (?)" />
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
          onDeleteSetlist={(s) => {
            void store.deleteSetlist(s.id)
            setPrefs({ setlistId: null, entry: 0, pos: null })
            notify({
              message: `Borraste el setlist “${s.name}”.`,
              undo: async () => {
                await store.restoreSetlist(s)
                setPrefs({ setlistId: s.id, entry: 0, pos: null })
              },
            })
          }}
          onSelectEntry={(i) => {
            goEntry(i)
            setSetlistOpen(false)
          }}
          onLoadExample={loadExample}
          onOpenLibrary={openLibrary}
          notify={notify}
        />
        <Splitter
          label="Ancho del setlist"
          className="con-split--setlist"
          value={prefs.columns.setlist}
          min={220}
          max={460}
          onChange={(v) => setPrefs((p) => ({ columns: { ...p.columns, setlist: v } }))}
        />
        <LyricsPanel
          song={song}
          show={show}
          position={position}
          onEdit={(id) => openLibrary({ songId: id })}
          empty={data.songs.length === 0 ? 'sin-canciones' : setlist ? 'setlist-vacio' : 'sin-setlist'}
          onOpenLibrary={() => openLibrary(null)}
        />
        <Splitter
          label="Ancho de los controles"
          value={prefs.columns.controls}
          min={320}
          max={760}
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
      {setlistOpen && <div className="con-drawer-backdrop" onClick={() => setSetlistOpen(false)} aria-hidden />}

      {!guide.dismissed && (
        <Guide
          progress={{
            songs: data.songs.length > 0,
            setlist: data.setlists.some((s) => s.items.length > 0),
            screenOpen: show.connected && !show.screen?.fullscreen,
            screen: show.connected && !!show.screen?.fullscreen,
          }}
          hasSetlist={!!setlist}
          // En pleno show queda achicada para no tapar la letra.
          collapsed={guide.collapsed || prefs.showStartedAt !== null}
          onCollapse={(collapsed) => setGuide({ collapsed })}
          onClose={() => setGuide({ dismissed: true })}
          onOpenLibrary={() => openLibrary(null)}
          onLoadExample={() => void loadExample()}
          onCreateSetlist={() => void createSetlist()}
          onFocusSearch={focusSearch}
          onOpenScreen={() => void open()}
        />
      )}

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

    {library && (
      <Library
        songs={data.songs}
        setlist={setlist}
        start={library.start}
        onClose={closeLibrary}
        onAddToSetlist={(id) => setlist && void store.saveSetlist({ ...setlist, items: sl.addSong(setlist.items, id) })}
        notify={notify}
      />
    )}

    {help && (
      <Help
        reduceMotion={data.device.reduceMotion ?? false}
        onReduceMotion={(reduceMotion) => void store.saveDeviceSettings({ reduceMotion })}
        onShowGuide={() => setGuide({ dismissed: false, collapsed: false })}
        onClose={closeHelp}
      />
    )}

    {notice && (
      <div className="con-toast con-toast--top" key={notice.id}>
        <Toast
          icon={notice.tone === 'alerta' ? TriangleAlert : CircleCheck}
          tone={notice.tone ?? 'ok'}
          action={notice.undo ? { label: 'Deshacer', onClick: runUndo } : { label: 'Cerrar', onClick: () => setNotice(null) }}
        >
          {notice.message}
        </Toast>
      </div>
    )}
    </>
  )
}

/* ---------- Estado de la pantalla de Gabi ---------- */

function ScreenPill({ info }: { info: ScreenInfo | null }) {
  // Lo que falta, en orden de importancia.
  const problem = !info ? null : !info.fullscreen ? 'falta pantalla completa' : info.wakeLock === false ? 'se puede apagar' : null
  const detail = !info
    ? undefined
    : !info.fullscreen
      ? 'Hacé un clic en la pantalla de Gabi (o F11 en esa ventana).'
      : info.wakeLock === false
        ? 'El navegador no dejó que la pantalla quede siempre encendida: revisá el ahorro de energía.'
        : `${info.width}×${info.height}, siempre encendida.`
  return (
    <span title={detail}>
      <Pill tone={problem ? 'alerta' : 'ok'} icon={Monitor}>
        Pantalla conectada{problem && <span className="con-pill-extra"> · {problem}</span>}
      </Pill>
    </span>
  )
}

/** Si hay conexión. Solo informa: la app no la necesita. */
function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
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

function Splitter(props: { label: string; value: number; min: number; max: number; invert?: boolean; className?: string; onChange: (v: number) => void }) {
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
      className={cx('con-split', props.className)}
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
