import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, CircleAlert, ListPlus, LoaderCircle, Redo2, Trash2, Undo2, Wand2 } from 'lucide-react'
import { analyzeLyrics, type LyricsAnalysis } from '../data/parser'
import { store } from '../data/store'
import { SONG_KINDS, type CueKind, type Song } from '../data/types'
import { PAGE_LINES, pageRanges } from '../show/cursor'
import { Button, Cue, Segmented } from '../ui/components'
import { CUES } from '../ui/cues'
import { cx } from '../ui/cx'
import { SONG_KIND_LABEL } from '../ui/labels'
import {
  applyDraft,
  draftErrors,
  draftFromSong,
  insertSection,
  lineContext,
  removeTitleLine,
  titleCandidate,
  toggleCue,
  type Draft,
} from './draft'
import { initHistory, record, redo, undo, type History } from './history'

const SAVE_DELAY_MS = 700

const PARTS = ['Estrofa', 'Coro', 'Puente', 'Intro', 'Solo', 'Final']
const CUE_BUTTONS: CueKind[] = ['x2', 'corte', 'silencio', 'solo']

const PLACEHOLDER = `Pegá la letra acá, o escribila.

[Estrofa]
Llegamos de lejos con ganas de fiesta

[Coro x2]
Mandale baile
que la noche es larga (corte)`

function emptyDraft(title = ''): Draft {
  return { title, artist: '', kind: 'cuarteto', duration: '', advanceMode: null, notes: '', text: '' }
}

const BLANK: Song = {
  id: '',
  title: '',
  artist: null,
  kind: 'cuarteto',
  sections: [],
  speed: 1,
  advanceMode: null,
  durationSeconds: null,
  notes: null,
  createdAt: '',
  clientUpdatedAt: '',
  deletedAt: null,
  dirty: 1,
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'failed'; message: string }

/** Primer lugar donde dos textos difieren: ahí queda el cursor al deshacer. */
function firstDiff(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

export interface EditorProps {
  /** null: tema nuevo, todavía sin guardar. */
  song: Song | null
  initialTitle?: string
  inSetlist: boolean
  canAddToSetlist: boolean
  onCreated: (id: string) => void
  onAddToSetlist: (id: string) => void
  onDelete: (song: Song) => void
  onDiscard: () => void
}

/**
 * Editor de una canción. La letra se escribe como texto, con encabezados
 * ("[Coro]") e indicaciones ("(corte)"); al lado se ve cómo queda. Se guarda
 * solo, y Ctrl+Z deshace cualquier cambio del editor.
 */
export function Editor({ song, initialTitle, inSetlist, canAddToSetlist, onCreated, onAddToSetlist, onDelete, onDiscard }: EditorProps) {
  const [hist, setHist] = useState<History<Draft>>(() => initHistory(song ? draftFromSong(song) : emptyDraft(initialTitle)))
  const draft = hist.present
  const [saved, setSaved] = useState<Draft>(draft)
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })
  const [caret, setCaret] = useState(0)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)

  const analysis = useMemo(() => analyzeLyrics(draft.text), [draft.text])
  const errors = draftErrors(draft)
  const hasErrors = Object.keys(errors).length > 0
  const dirty = draft !== saved

  /* ---------- Guardado ---------- */

  // Las escrituras van en fila: así un tema nuevo se crea una sola vez.
  const songId = useRef<string | null>(song?.id ?? null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const persist = useCallback(
    (d: Draft) => {
      queue.current = queue.current.then(async () => {
        setSave({ kind: 'saving' })
        try {
          const sections = analyzeLyrics(d.text).sections
          const id = songId.current
          if (id) {
            const base = store.songById(id)
            if (base) await store.saveSong(applyDraft(base, d, sections))
          } else {
            const { id: _i, createdAt: _c, clientUpdatedAt: _u, deletedAt: _d, dirty: _x, ...input } = applyDraft(BLANK, d, sections)
            const created = await store.createSong(input)
            songId.current = created.id
            onCreated(created.id)
          }
          setSaved(d)
          setSave({ kind: 'idle' })
        } catch (e) {
          setSave({ kind: 'failed', message: e instanceof Error ? e.message : String(e) })
        }
      })
      return queue.current
    },
    [onCreated],
  )

  // Autoguardado: un ratito después del último cambio.
  useEffect(() => {
    if (!dirty || hasErrors) return
    const t = setTimeout(() => void persist(draft), SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [draft, dirty, hasErrors, persist])

  // Al cerrar o cambiar de tema, se guarda lo que haya quedado pendiente.
  const latest = useRef({ draft, dirty, hasErrors })
  useEffect(() => {
    latest.current = { draft, dirty, hasErrors }
  })
  useEffect(
    () => () => {
      const l = latest.current
      if (l.dirty && !l.hasErrors) void persist(l.draft)
    },
    [persist],
  )

  /* ---------- Cambios e historial ---------- */

  const update = (patch: Partial<Draft>, key: string | null) =>
    setHist((h) => record(h, { ...h.present, ...patch }, key, Date.now()))

  const travel = (fn: typeof undo) => {
    const next = fn(hist)
    if (next === hist) return
    if (next.present.text !== draft.text) pendingCaret.current = firstDiff(draft.text, next.present.text)
    setHist(next)
  }

  // Después de un cambio hecho con botones o al deshacer, el cursor vuelve a su lugar.
  useLayoutEffect(() => {
    const ta = textRef.current
    const at = pendingCaret.current
    if (!ta || at === null) return
    pendingCaret.current = null
    ta.setSelectionRange(at, at)
    setCaret(at)
  }, [draft.text])

  const editText = (fn: (text: string, caret: number) => { text: string; caret: number }) => {
    const ta = textRef.current
    const at = ta ? ta.selectionStart : caret
    const r = fn(draft.text, at)
    if (r.text === draft.text) return
    pendingCaret.current = r.caret
    update({ text: r.text }, null)
    ta?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 'z' && !e.shiftKey) travel(undo)
    else if (k === 'y' || (k === 'z' && e.shiftKey)) travel(redo)
    else if (k === 's') {
      if (dirty && !hasErrors) void persist(draft)
    } else return
    e.preventDefault()
    e.stopPropagation()
  }

  /* ---------- Render ---------- */

  const ctx = lineContext(draft.text, caret)
  const suggestion = !draft.title.trim() ? titleCandidate(draft.text) : null
  const id = song?.id ?? null

  return (
    <div className="ed" onKeyDown={onKeyDown}>
      <header className="ed-head">
        <input
          className={cx('ed-title', errors.title && 'is-invalid')}
          value={draft.title}
          onChange={(e) => update({ title: e.target.value }, 'title')}
          placeholder="Título del tema"
          aria-label="Título"
          aria-invalid={!!errors.title}
          maxLength={200}
          autoFocus={!song}
        />
        <Status save={save} dirty={dirty} errors={errors} isNew={!id} />
        <div className="ed-head__actions">
          <Button size="sm" variant="ghost" icon={Undo2} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)" disabled={!hist.past.length} onClick={() => travel(undo)} />
          <Button size="sm" variant="ghost" icon={Redo2} aria-label="Rehacer (Ctrl+Y)" title="Rehacer (Ctrl+Y)" disabled={!hist.future.length} onClick={() => travel(redo)} />
          {canAddToSetlist && id && (
            <Button size="sm" icon={inSetlist ? Check : ListPlus} disabled={inSetlist} onClick={() => onAddToSetlist(id)}>
              {inSetlist ? 'Está en el setlist' : 'Agregar al setlist'}
            </Button>
          )}
          {song ? (
            <Button size="sm" variant="ghost" icon={Trash2} aria-label="Borrar el tema" title="Borrar el tema" onClick={() => onDelete(song)} />
          ) : (
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              Descartar
            </Button>
          )}
        </div>
      </header>

      {suggestion && (
        <div className="ed-suggest">
          <Wand2 aria-hidden />
          <span>
            ¿El título es <b>“{suggestion}”</b>?
          </span>
          <Button size="sm" onClick={() => update({ title: suggestion, text: removeTitleLine(draft.text) }, null)}>
            Usarlo
          </Button>
        </div>
      )}

      <div className="ed-meta">
        <label className="ed-field">
          <span className="label">Artista</span>
          <input value={draft.artist} onChange={(e) => update({ artist: e.target.value }, 'artist')} placeholder="Si es un cover" maxLength={200} />
        </label>
        <label className="ed-field ed-field--kind">
          <span className="label">Tipo</span>
          <select value={draft.kind} onChange={(e) => update({ kind: e.target.value as Draft['kind'] }, null)}>
            {SONG_KINDS.map((k) => (
              <option key={k} value={k}>
                {SONG_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="ed-field ed-field--dur">
          <span className="label">Duración</span>
          <input
            className={cx('tabular', errors.duration && 'is-invalid')}
            value={draft.duration}
            onChange={(e) => update({ duration: e.target.value }, 'duration')}
            placeholder="4:10"
            inputMode="numeric"
            aria-invalid={!!errors.duration}
            title={errors.duration}
          />
        </label>
        <div className="ed-field">
          <span className="label">Avance</span>
          <Segmented
            label="Avance de este tema"
            value={draft.advanceMode ?? 'consola'}
            onChange={(v) => update({ advanceMode: v === 'consola' ? null : v }, null)}
            options={[
              { value: 'consola', label: 'Consola' },
              { value: 'linea', label: 'Línea' },
              { value: 'parte', label: 'Parte' },
            ]}
          />
        </div>
        <label className="ed-field ed-field--notes">
          <span className="label">Notas para la banda</span>
          <input value={draft.notes} onChange={(e) => update({ notes: e.target.value }, 'notes')} placeholder="Tono, quién arranca, etc." maxLength={5000} />
        </label>
      </div>

      <div className="ed-body">
        <section className="ed-card" aria-label="Letra">
          <div className="ed-tools" role="toolbar" aria-label="Partes e indicaciones">
            <div className="ed-tools__row">
            <span className="label">Parte</span>
            {PARTS.map((p) => (
              <button key={p} type="button" className="ed-tool" onMouseDown={(e) => e.preventDefault()} onClick={() => editText((t, c) => insertSection(t, c, p))} title={`Marcar acá el comienzo de: ${p}`}>
                {p}
              </button>
            ))}
            </div>
            <div className="ed-tools__row">
            <span className="label">En la línea</span>
            {CUE_BUTTONS.map((c) => {
              const { label, icon: Icon } = CUES[c]
              const on = ctx.type === 'lyric' ? ctx.cues.includes(c) : ctx.type === 'header' && c === 'x2' && ctx.x2
              const usable = ctx.type === 'lyric' || (ctx.type === 'header' && c === 'x2')
              return (
                <button
                  key={c}
                  type="button"
                  className="ed-tool ed-tool--cue"
                  aria-pressed={on}
                  disabled={!usable}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editText((t, at) => toggleCue(t, at, c))}
                  title={usable ? `${label} en el renglón del cursor` : 'Poné el cursor en una línea de letra'}
                >
                  <Icon aria-hidden />
                  {label}
                </button>
              )
            })}
            </div>
          </div>
          <textarea
            ref={textRef}
            className="ed-text"
            value={draft.text}
            onChange={(e) => {
              update({ text: e.target.value }, 'text')
              setCaret(e.target.selectionStart)
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            aria-label="Letra"
            autoFocus={!!song && !draft.text}
          />
        </section>

        <section className="ed-card" aria-label="Cómo queda">
          <Preview analysis={analysis} />
        </section>
      </div>
    </div>
  )
}

/* ---------- Estado del guardado ---------- */

function Status({ save, dirty, errors, isNew }: { save: SaveState; dirty: boolean; errors: ReturnType<typeof draftErrors>; isNew: boolean }) {
  let icon = <Check aria-hidden />
  let text = 'Guardado'
  let tone: 'ok' | 'alerta' | 'muted' = 'ok'
  if (save.kind === 'failed') {
    icon = <CircleAlert aria-hidden />
    text = `No se pudo guardar: ${save.message}`
    tone = 'alerta'
  } else if (errors.title) {
    icon = <CircleAlert aria-hidden />
    text = isNew ? 'Poné un título para guardar' : 'Falta el título: no se guarda'
    tone = 'alerta'
  } else if (errors.duration) {
    icon = <CircleAlert aria-hidden />
    text = 'Revisá la duración'
    tone = 'alerta'
  } else if (save.kind === 'saving' || dirty) {
    icon = <LoaderCircle aria-hidden className="ed-spin" />
    text = 'Guardando…'
    tone = 'muted'
  }
  return (
    <span className={`ed-status ed-status--${tone}`} role="status">
      {icon}
      {text}
    </span>
  )
}

/* ---------- Cómo queda ---------- */

function Preview({ analysis }: { analysis: LyricsAnalysis }) {
  const { sections, chordLines } = analysis
  const lines = sections.reduce((n, s) => n + s.lines.length, 0)
  return (
    <div className="ed-prev">
      <header className="ed-prev__head">
        <span className="label">Cómo queda</span>
        <span className="ed-prev__count">
          {sections.length} {sections.length === 1 ? 'parte' : 'partes'} · {lines} {lines === 1 ? 'línea' : 'líneas'}
        </span>
      </header>
      <div className="ed-prev__body" tabIndex={0} aria-label="Partes detectadas">
        {chordLines.length > 0 && (
          <details className="ed-note">
            <summary>
              Se sacaron {chordLines.length} {chordLines.length === 1 ? 'renglón' : 'renglones'} de acordes
            </summary>
            <ul>
              {chordLines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </details>
        )}
        {sections.length === 0 && (
          <div className="ed-prev__empty">
            <p>Acá vas a ver las partes que se detectan.</p>
            <p className="con-muted">
              Una línea en blanco separa partes. Los encabezados van entre corchetes: <code>[Coro]</code>,{' '}
              <code>[Coro x2]</code>. Las indicaciones, al final de la línea: <code>(corte)</code>, <code>(x2)</code>.
            </p>
          </div>
        )}
        {sections.map((s) => (
          <div key={s.id} className={cx('ed-part', `ed-part--${s.kind}`)}>
            <div className="ed-part__h">
              <b>{s.label}</b>
              {s.cues.map((c) => (
                <Cue key={c} kind={c} />
              ))}
              {s.lines.length > PAGE_LINES && <span className="ed-part__warn">En modo parte va en {pageRanges(s.lines.length).length} pantallas</span>}
            </div>
            {s.lines.length === 0 ? (
              <p className="ed-part__inst">Instrumental: en la pantalla se ve “{s.label}”.</p>
            ) : (
              <ol>
                {s.lines.map((l) => (
                  <li key={l.id}>
                    <span>{l.text}</span>
                    {l.cues.map((c) => (
                      <Cue key={c} kind={c} />
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
