import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, Link2, ListMusic, Pencil, Plus, Search, Trash2, Unlink, X } from 'lucide-react'
import * as sl from '../data/setlist'
import type { Setlist, SetlistItem, Song } from '../data/types'
import { Button, Kbd } from '../ui/components'
import { cx } from '../ui/cx'

interface Props {
  setlists: Setlist[]
  setlist: Setlist | null
  songs: Song[]
  /** Entrada en curso (tema que está sonando). */
  current: number
  searchRef: React.RefObject<HTMLInputElement | null>
  onPickSetlist: (id: string) => void
  onCreateSetlist: () => void
  onSaveSetlist: (s: Setlist) => void
  onDeleteSetlist: (id: string) => void
  onSelectEntry: (entry: number) => void
  onLoadExample: () => void
}

/** Sin tildes y en minúscula, para buscar "corazon" y encontrar "Corazón". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function SetlistPanel({ searchRef, setlist, songs, ...p }: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs])
  const items = useMemo(() => (setlist ? sl.withoutMissing(setlist.items, (id) => byId.has(id)) : []), [setlist, byId])
  const list = useMemo(() => sl.entries(items), [items])
  const total = list.reduce((sum, e) => sum + (byId.get(e.songId)?.durationSeconds ?? 0), 0)

  const results = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    return songs.filter((s) => fold(`${s.title} ${s.artist ?? ''}`).includes(q)).slice(0, 30)
  }, [query, songs])

  const save = (next: SetlistItem[]) => setlist && p.onSaveSetlist({ ...setlist, items: next })

  const add = (songId: string) => {
    if (!setlist) return
    save(sl.addSong(items, songId))
    setQuery('')
  }

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results[0]) add(results[0].id)
    if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map((_, i) => `item-${i}`)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    save(sl.moveItem(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  // Número de entrada donde arranca cada ítem.
  const firstEntry = items.map((_, i) => list.findIndex((e) => e.item === i))

  return (
    <section className="panel con-setlist" aria-label="Setlist">
      <header className="panel__head">
        <ListMusic aria-hidden />
        {setlist && !editing ? (
          <select
            className="con-select"
            value={setlist.id}
            onChange={(e) => p.onPickSetlist(e.target.value)}
            aria-label="Elegir setlist"
          >
            {p.setlists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.showDate ? ` · ${formatDate(s.showDate)}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <h2 className="panel__title">{editing ? 'Editar setlist' : 'Setlist'}</h2>
        )}
        <div className="panel__actions">
          {setlist && (
            <Button size="sm" variant="ghost" icon={Pencil} aria-label="Editar nombre y fecha" title="Editar nombre y fecha" pressed={editing} onClick={() => setEditing(!editing)} />
          )}
          <Button size="sm" variant="ghost" icon={Plus} aria-label="Nuevo setlist" title="Nuevo setlist" onClick={p.onCreateSetlist} />
        </div>
      </header>

      {setlist && editing && (
        <SetlistForm
          setlist={setlist}
          confirmDelete={confirmDelete}
          onSave={(s) => {
            p.onSaveSetlist(s)
            setEditing(false)
          }}
          onDelete={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            p.onDeleteSetlist(setlist.id)
            setConfirmDelete(false)
            setEditing(false)
          }}
          onCancel={() => {
            setEditing(false)
            setConfirmDelete(false)
          }}
        />
      )}

      {!setlist ? (
        <Empty>
          <p>Todavía no hay ningún setlist.</p>
          <Button variant="primary" icon={Plus} onClick={p.onCreateSetlist}>
            Nuevo setlist
          </Button>
          {songs.length === 0 && (
            <Button variant="ghost" onClick={p.onLoadExample}>
              Cargar un ejemplo para probar
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <label className="con-search">
            <Search aria-hidden />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar tema para agregar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              aria-label="Buscar tema para agregar al setlist"
            />
            {query ? (
              <button type="button" className="con-search__clear" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                <X aria-hidden />
              </button>
            ) : (
              <Kbd>/</Kbd>
            )}
          </label>

          <div className="panel__body">
            {query ? (
              <ul className="con-results" aria-label="Resultados">
                {results.length === 0 && <li className="con-muted">No hay temas con “{query}”.</li>}
                {results.map((s, i) => (
                  <li key={s.id}>
                    <button type="button" className="con-result" onClick={() => add(s.id)}>
                      <Plus aria-hidden />
                      <span className="con-result__t">{s.title}</span>
                      {s.durationSeconds != null && <span className="tabular">{sl.formatDuration(s.durationSeconds)}</span>}
                      {i === 0 && <Kbd>Enter</Kbd>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <Empty>
                <p>El setlist está vacío.</p>
                <p className="con-muted">
                  {songs.length ? 'Buscá un tema arriba para agregarlo.' : 'Todavía no hay canciones cargadas.'}
                </p>
                {songs.length === 0 && (
                  <Button variant="ghost" onClick={p.onLoadExample}>
                    Cargar un ejemplo para probar
                  </Button>
                )}
              </Empty>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <ol className="sl">
                    {items.map((it, i) => (
                      <SortableItem key={ids[i]} id={ids[i]}>
                        {(handle) =>
                          it.type === 'song' ? (
                            <Row
                              n={firstEntry[i]}
                              song={byId.get(it.songId)}
                              current={p.current}
                              handle={handle}
                              onSelect={p.onSelectEntry}
                              onRemove={() => save(sl.removeEntry(items, firstEntry[i]))}
                              onLink={i < items.length - 1 ? () => save(sl.linkWithNext(items, i)) : undefined}
                            />
                          ) : (
                            <div className="eng">
                              <div className="eng-h">
                                {handle}
                                <Link2 aria-hidden />
                                <EngName name={it.name} onRename={(name) => save(sl.renameEng(items, it.id, name))} />
                                <span className="eng-h__actions">
                                  {i < items.length - 1 && (
                                    <IconBtn label="Enganchar con el siguiente" onClick={() => save(sl.linkWithNext(items, i))}>
                                      <Link2 aria-hidden />
                                    </IconBtn>
                                  )}
                                  <IconBtn label="Desenganchar" onClick={() => save(sl.unlink(items, i))}>
                                    <Unlink aria-hidden />
                                  </IconBtn>
                                </span>
                              </div>
                              {it.songIds.map((songId, k) => (
                                <Row
                                  key={`${songId}-${k}`}
                                  n={firstEntry[i] + k}
                                  song={byId.get(songId)}
                                  current={p.current}
                                  onSelect={p.onSelectEntry}
                                  onRemove={() => save(sl.removeEntry(items, firstEntry[i] + k))}
                                />
                              ))}
                            </div>
                          )
                        }
                      </SortableItem>
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <footer className="con-setlist__foot">
            <span>
              {list.length} {list.length === 1 ? 'tema' : 'temas'}
            </span>
            {total > 0 && <span className="tabular">{sl.formatDuration(total)}</span>}
          </footer>
        </>
      )}
    </section>
  )
}

/* ---------- Partes ---------- */

function SortableItem({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button type="button" className="grip" ref={setActivatorNodeRef} data-drag-handle aria-label="Arrastrar para mover" {...attributes} {...listeners}>
      <GripVertical aria-hidden />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      className={cx('sl-item', isDragging && 'is-dragging')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children(handle)}
    </li>
  )
}

function Row(props: {
  n: number
  song: Song | undefined
  current: number
  handle?: ReactNode
  onSelect: (entry: number) => void
  onRemove: () => void
  onLink?: () => void
}) {
  const { n, song, current } = props
  const state = n < current ? 'done' : n === current ? 'now' : null
  return (
    <div className={cx('sl-row', state && `is-${state}`)}>
      {props.handle ?? <span className="grip grip--empty" />}
      <button type="button" className="sl-row__main" onClick={() => props.onSelect(n)} aria-current={state === 'now' ? 'true' : undefined}>
        <span className="sl-row__n tabular">{n + 1}</span>
        <span className="sl-row__t">{song?.title ?? 'Tema borrado'}</span>
        <span className="sl-row__d tabular">{song?.durationSeconds != null ? sl.formatDuration(song.durationSeconds) : ''}</span>
      </button>
      <span className="sl-row__actions">
        {props.onLink && (
          <IconBtn label="Enganchar con el siguiente" onClick={props.onLink}>
            <Link2 aria-hidden />
          </IconBtn>
        )}
        <IconBtn label="Sacar del setlist" onClick={props.onRemove}>
          <X aria-hidden />
        </IconBtn>
      </span>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function EngName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  if (!editing)
    return (
      <button type="button" className="eng-h__name" onClick={() => setEditing(true)} title="Cambiar el nombre">
        {name === sl.DEFAULT_ENG_NAME ? name : `Enganchado · ${name}`}
      </button>
    )
  const done = () => {
    onRename(input.current?.value ?? name)
    setEditing(false)
  }
  return (
    <input
      ref={input}
      className="eng-h__input"
      defaultValue={name}
      autoFocus
      aria-label="Nombre del enganchado"
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

function SetlistForm(props: {
  setlist: Setlist
  confirmDelete: boolean
  onSave: (s: Setlist) => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(props.setlist.name)
  const [date, setDate] = useState(props.setlist.showDate ?? '')
  return (
    <form
      className="con-form"
      onSubmit={(e) => {
        e.preventDefault()
        props.onSave({ ...props.setlist, name, showDate: date || null })
      }}
    >
      <label>
        <span className="label">Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus />
      </label>
      <label>
        <span className="label">Fecha del show</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="con-form__row">
        <Button type="submit" variant="primary" size="sm" icon={Check}>
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onCancel}>
          Cancelar
        </Button>
        <Button size="sm" variant="danger" icon={Trash2} onClick={props.onDelete} className="con-form__del">
          {props.confirmDelete ? '¿Seguro? Borrar' : 'Borrar'}
        </Button>
      </div>
    </form>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="con-empty">{children}</div>
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
