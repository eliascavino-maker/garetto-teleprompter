import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ArrowLeft, Check, DatabaseBackup, Download, FileUp, LoaderCircle, Music, Plus, Search, Upload, X } from 'lucide-react'
import { backupFileName, parseBackup, type BackupContent } from '../data/backup'
import { analyzeLyrics } from '../data/parser'
import { entries, formatDuration } from '../data/setlist'
import { store } from '../data/store'
import type { Setlist, Song } from '../data/types'
import { LYRICS_ACCEPT, ImportError, readLyricsFile } from '../import/readFile'
import { Button, Kbd } from '../ui/components'
import { cx } from '../ui/cx'
import { SONG_KIND_LABEL, fold, type Notify } from '../ui/labels'
import { removeTitleLine, titleCandidate } from './draft'
import { Editor } from './Editor'
import './editor.css'

export type LibraryStart = { songId: string } | { newTitle: string } | null

type Target = { mode: 'song'; songId: string } | { mode: 'new'; title?: string } | { mode: 'none' }
/** key cambia cada vez que se abre otro tema: así el editor arranca de cero. */
type Selection = { key: number } & Target

interface Props {
  songs: Song[]
  setlist: Setlist | null
  /** Qué abrir: un tema, uno nuevo con ese título, o lo primero de la lista. */
  start: LibraryStart
  onClose: () => void
  onAddToSetlist: (songId: string) => void
  notify: Notify
}

const LAST_BACKUP_KEY = 'garetto-teleprompter:ultimo-backup'
const BACKUP_NUDGE_DAYS = 14

function readLastBackup(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_BACKUP_KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Canciones: la lista de temas, el editor, la importación y el backup. Se abre
 * encima de la consola, así la pantalla de Gabi sigue conectada.
 */
export function Library({ songs, setlist, start, onClose, onAddToSetlist, notify }: Props) {
  const [sel, setSel] = useState<Selection>(() => {
    if (start && 'songId' in start) return { key: 0, mode: 'song', songId: start.songId }
    if (start && 'newTitle' in start) return { key: 0, mode: 'new', title: start.newTitle }
    return songs[0] ? { key: 0, mode: 'song', songId: songs[0].id } : { key: 0, mode: 'none' }
  })
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [restore, setRestore] = useState<BackupContent | null>(null)
  const [lastBackup, setLastBackup] = useState(readLastBackup)
  const [openedAt] = useState(Date.now)
  const lyricsInput = useRef<HTMLInputElement>(null)
  const backupInput = useRef<HTMLInputElement>(null)

  const select = (next: Target) => setSel((s) => ({ ...next, key: s.key + 1 }))

  const inSetlist = useMemo(() => new Set(setlist ? entries(setlist.items).map((e) => e.songId) : []), [setlist])
  const shown = useMemo(() => {
    const q = fold(query.trim())
    return q ? songs.filter((s) => fold(`${s.title} ${s.artist ?? ''}`).includes(q)) : songs
  }, [songs, query])

  const current = sel.mode === 'song' ? (songs.find((s) => s.id === sel.songId) ?? null) : null

  // Esc vuelve a la consola (lo pendiente se guarda al cerrar el editor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (restore) setRestore(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [restore, onClose])

  /* ---------- Importar ---------- */

  const importFiles = async (files: File[]) => {
    const backup = files.find((f) => /\.json$/i.test(f.name))
    const lyrics = files.filter((f) => !/\.json$/i.test(f.name))
    if (backup) await askRestore(backup)
    if (lyrics.length === 0) return

    setBusy(true)
    try {
      const results = await Promise.allSettled(lyrics.map(readLyricsFile))
      const inputs = results.flatMap((r) => {
        if (r.status !== 'fulfilled') return []
        const { title, text } = r.value
        // Si la letra arranca con el mismo título del archivo, no se repite.
        const cand = titleCandidate(text)
        const body = cand && fold(cand) === fold(title) ? removeTitleLine(text) : text
        return [{ title, sections: analyzeLyrics(body).sections }]
      })
      const failed = results.flatMap((r) =>
        r.status === 'rejected' ? [r.reason instanceof ImportError ? r.reason.message : 'Un archivo no se pudo leer.'] : [],
      )
      const created = inputs.length ? await store.createSongs(inputs) : []
      if (created[0]) select({ mode: 'song', songId: created[0].id })

      const ok = created.length === 1 ? `Se importó “${created[0].title}”.` : created.length ? `Se importaron ${created.length} temas.` : ''
      const undo = created.length ? () => Promise.all(created.map((s) => store.deleteSong(s.id))) : undefined
      if (failed.length) notify({ tone: 'alerta', message: [ok, ...failed].filter(Boolean).join(' '), undo })
      else notify({ message: ok, undo })
    } finally {
      setBusy(false)
    }
  }

  /* ---------- Backup ---------- */

  const exportBackup = () => {
    const data = store.backup()
    download(JSON.stringify(data, null, 2), backupFileName())
    const now = Date.now()
    try {
      localStorage.setItem(LAST_BACKUP_KEY, String(now))
    } catch {
      // Sin localStorage no se recuerda la fecha; el backup se bajó igual.
    }
    setLastBackup(now)
    notify({ message: `Backup bajado: ${data.songs.length} temas y ${data.setlists.length} setlists.` })
  }

  const askRestore = async (file: File) => {
    try {
      setRestore(parseBackup(await file.text()))
    } catch (e) {
      notify({ tone: 'alerta', message: e instanceof Error ? e.message : 'No se pudo leer el backup.' })
    }
  }

  const doRestore = async () => {
    if (!restore) return
    const content = restore
    setRestore(null)
    const undo = await store.restoreBackup(content)
    notify({ message: `Backup restaurado: ${content.songs.length} temas y ${content.setlists.length} setlists.`, undo })
  }

  /* ---------- Borrar ---------- */

  const remove = async (song: Song) => {
    const i = shown.findIndex((s) => s.id === song.id)
    const neighbor = shown[i + 1] ?? shown[i - 1]
    await store.deleteSong(song.id)
    select(neighbor ? { mode: 'song', songId: neighbor.id } : { mode: 'none' })
    notify({ message: `Borraste “${song.title}”.`, undo: () => store.restoreSong(song) })
  }

  /* ---------- Arrastrar archivos ---------- */

  const dragProps = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
    },
    onDrop: (e: DragEvent) => {
      if (!e.dataTransfer.files.length) return
      e.preventDefault()
      setDragging(false)
      void importFiles([...e.dataTransfer.files])
    },
  }

  /* ---------- Render ---------- */

  const days = lastBackup ? Math.max(0, Math.floor((openedAt - lastBackup) / 86_400_000)) : null
  const nudge = songs.length > 0 && (days === null || days >= BACKUP_NUDGE_DAYS)

  return (
    <div className="lib" role="dialog" aria-modal="true" aria-label="Canciones" {...dragProps}>
      <header className="lib-bar">
        <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={onClose} kbd="Esc">
          Volver a la consola
        </Button>
        <h1 className="lib-bar__title">
          <Music aria-hidden />
          Canciones
          <span className="tabular">{songs.length}</span>
        </h1>
        <div className="lib-bar__right">
          {busy && (
            <span className="lib-busy">
              <LoaderCircle aria-hidden className="ed-spin" />
              Importando…
            </span>
          )}
          <Button size="sm" icon={FileUp} onClick={() => lyricsInput.current?.click()} disabled={busy}>
            Importar archivos
          </Button>
          <Button size="sm" variant="primary" icon={Plus} onClick={() => select({ mode: 'new' })}>
            Nuevo tema
          </Button>
        </div>
        <input
          ref={lyricsInput}
          type="file"
          accept={`${LYRICS_ACCEPT},.json`}
          multiple
          hidden
          onChange={(e) => {
            void importFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <input
          ref={backupInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void askRestore(f)
            e.target.value = ''
          }}
        />
      </header>

      <div className="lib-body">
        <aside className="lib-list" aria-label="Lista de temas">
          <label className="con-search">
            <Search aria-hidden />
            <input type="search" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar tema" />
            {query && (
              <button type="button" className="con-search__clear" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                <X aria-hidden />
              </button>
            )}
          </label>
          <ul className="lib-songs">
            {sel.mode === 'new' && (
              <li>
                <div className="lib-song is-selected is-new">
                  <span className="lib-song__t">{sel.title || 'Tema nuevo'}</span>
                  <span className="lib-song__m">Sin guardar</span>
                </div>
              </li>
            )}
            {shown.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={cx('lib-song', current?.id === s.id && 'is-selected')}
                  aria-current={current?.id === s.id ? 'true' : undefined}
                  onClick={() => select({ mode: 'song', songId: s.id })}
                >
                  <span className="lib-song__t">{s.title}</span>
                  <span className="lib-song__m">
                    {SONG_KIND_LABEL[s.kind]}
                    {s.durationSeconds != null && <span className="tabular"> · {formatDuration(s.durationSeconds)}</span>}
                    {` · ${s.sections.length} ${s.sections.length === 1 ? 'parte' : 'partes'}`}
                  </span>
                  {inSetlist.has(s.id) && (
                    <span className="lib-song__in" title="Está en el setlist abierto">
                      <Check aria-hidden />
                      <span className="sr-only">En el setlist</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
            {query && shown.length === 0 && (
              <li className="lib-songs__none">
                <p className="con-muted">No hay temas con “{query}”.</p>
                <Button size="sm" icon={Plus} onClick={() => select({ mode: 'new', title: query.trim() })}>
                  Crear “{query.trim()}”
                </Button>
              </li>
            )}
          </ul>
          <footer className="lib-backup">
            <div className={cx('lib-backup__when', nudge && 'is-nudge')}>
              <DatabaseBackup aria-hidden />
              {lastBackup ? `Último backup: ${days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`}` : 'Todavía no bajaste ningún backup'}
            </div>
            <div className="lib-backup__row">
              <Button size="sm" icon={Download} onClick={exportBackup} disabled={songs.length === 0}>
                Bajar backup
              </Button>
              <Button size="sm" variant="ghost" icon={Upload} onClick={() => backupInput.current?.click()}>
                Restaurar
              </Button>
            </div>
          </footer>
        </aside>

        <main className="lib-main">
          {sel.mode === 'none' || (sel.mode === 'song' && !current) ? (
            <div className="lib-empty">
              {songs.length === 0 ? (
                <>
                  <Music aria-hidden />
                  <p className="lib-empty__t">Todavía no hay canciones.</p>
                  <p className="con-muted">Escribí o pegá una letra, o traé archivos .txt, .docx o PDF.</p>
                </>
              ) : (
                <p className="lib-empty__t">Elegí un tema de la lista.</p>
              )}
              <div className="lib-empty__row">
                <Button variant="primary" icon={Plus} onClick={() => select({ mode: 'new' })}>
                  Nuevo tema
                </Button>
                <Button icon={FileUp} onClick={() => lyricsInput.current?.click()}>
                  Importar archivos
                </Button>
              </div>
              <p className="con-muted">También podés arrastrar los archivos acá.</p>
            </div>
          ) : (
            <Editor
              key={sel.key}
              song={current}
              initialTitle={sel.mode === 'new' ? sel.title : undefined}
              inSetlist={!!current && inSetlist.has(current.id)}
              canAddToSetlist={!!setlist}
              onCreated={(id) => setSel((s) => ({ key: s.key, mode: 'song', songId: id }))}
              onAddToSetlist={(id) => {
                onAddToSetlist(id)
                notify({ message: `Agregado al setlist “${setlist?.name}”.` })
              }}
              onDelete={(song) => void remove(song)}
              onDiscard={() => select(songs[0] ? { mode: 'song', songId: songs[0].id } : { mode: 'none' })}
            />
          )}
        </main>
      </div>

      {dragging && (
        <div className="lib-drop" aria-hidden>
          <FileUp />
          <b>Soltá los archivos para importarlos</b>
          <span>.txt, .docx o PDF: un tema por archivo. Un backup .json se restaura.</span>
        </div>
      )}

      {restore && (
        <div className="lib-confirm" role="alertdialog" aria-modal="true" aria-labelledby="restore-t">
          <div className="lib-confirm__box">
            <h2 id="restore-t">¿Restaurar el backup?</h2>
            <p>
              Trae <b>{restore.songs.length} temas</b> y <b>{restore.setlists.length} setlists</b>
              {restore.exportedAt && ` del ${new Date(restore.exportedAt).toLocaleDateString('es-AR')}`}.
            </p>
            <p className="con-muted">
              Los temas y setlists que ya están se reemplazan por los del backup. Lo demás no se toca. Después lo podés deshacer.
            </p>
            <div className="lib-confirm__row">
              <Button variant="primary" icon={Upload} onClick={() => void doRestore()} autoFocus>
                Restaurar
              </Button>
              <Button variant="ghost" onClick={() => setRestore(null)}>
                Cancelar <Kbd>Esc</Kbd>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
