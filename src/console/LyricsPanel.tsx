import { useEffect, useRef } from 'react'
import { formatDuration } from '../data/setlist'
import type { Song } from '../data/types'
import { findStep, pageOfLine } from '../show/cursor'
import type { ShowController } from '../show/useShow'
import { ListMusic, Music, Pencil } from 'lucide-react'
import { isReducedMotion } from '../platform/motion'
import { Button, Cue, Kbd } from '../ui/components'
import { cx } from '../ui/cx'
import { SONG_KIND_LABEL } from '../ui/labels'

/** La letra del tema en curso. Clic en una línea para saltar ahí. */
export function LyricsPanel({
  song,
  show,
  position,
  onEdit,
  empty,
  onOpenLibrary,
}: {
  song: Song | null
  show: ShowController
  position: string | null
  onEdit: (songId: string) => void
  /** Qué falta cuando no hay tema para mostrar. */
  empty: 'sin-canciones' | 'sin-setlist' | 'setlist-vacio'
  onOpenLibrary: () => void
}) {
  const body = useRef<HTMLDivElement>(null)
  const step = show.step

  // La línea actual siempre a la vista, más o menos a un tercio de la altura.
  useEffect(() => {
    const el = body.current?.querySelector<HTMLElement>('.ly-line.is-now, .ly-part__h.is-now')
    if (!el || !body.current) return
    const box = body.current
    const top = el.offsetTop - box.clientHeight / 3
    const reduce = isReducedMotion()
    box.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  }, [step, song?.id])

  if (!song) {
    return (
      <section className="panel con-lyrics" aria-label="Letra">
        <div className="con-empty con-empty--big">
          {empty === 'sin-canciones' ? (
            <>
              <Music aria-hidden className="con-empty__icon" />
              <p>Todavía no hay canciones.</p>
              <p className="con-muted">Cargalas en Canciones: pegando la letra o con archivos .txt, .docx o PDF.</p>
              <Button variant="primary" icon={Music} onClick={onOpenLibrary}>
                Abrir Canciones
              </Button>
            </>
          ) : empty === 'setlist-vacio' ? (
            <>
              <ListMusic aria-hidden className="con-empty__icon" />
              <p>El setlist está vacío.</p>
              <p className="con-muted">
                Buscá los temas en la columna de la izquierda (<Kbd>/</Kbd>) y se agregan en orden.
              </p>
            </>
          ) : (
            <>
              <ListMusic aria-hidden className="con-empty__icon" />
              <p>Todavía no hay un setlist.</p>
              <p className="con-muted">Creá uno a la izquierda para el próximo show.</p>
            </>
          )}
        </div>
      </section>
    )
  }

  // Número de la primera línea de cada parte, contando desde 1.
  const firstLine = song.sections.reduce<number[]>((acc, _s, i) => [...acc, i === 0 ? 1 : acc[i - 1] + song.sections[i - 1].lines.length], [])
  const totalLines = song.sections.reduce((n, s) => n + s.lines.length, 0)

  return (
    <section className="panel con-lyrics" aria-label="Letra">
      <header className="ly-head">
        <div className="ly-head__row">
          <h2>{song.title}</h2>
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(song.id)} aria-label="Editar este tema">
            Editar
          </Button>
        </div>
        <div className="ly-head__meta">
          <span>{SONG_KIND_LABEL[song.kind]}</span>
          {song.artist && <span>{song.artist}</span>}
          {song.durationSeconds != null && <span className="tabular">{formatDuration(song.durationSeconds)}</span>}
          <span>{show.mode === 'linea' ? 'Por línea' : 'Por parte'}</span>
          {position && <span className="tabular">{position}</span>}
        </div>
      </header>
      <div className="ly" ref={body}>
        {totalLines === 0 && song.sections.length === 0 && (
          <div className="con-empty">
            <p>Este tema no tiene letra cargada.</p>
            <p className="con-muted">En la pantalla de Gabi se ve el logo hasta que pases al tema siguiente.</p>
            <Button icon={Pencil} onClick={() => onEdit(song.id)}>
              Cargar la letra
            </Button>
          </div>
        )}
        {song.sections.map((s, si) => {
          const partNow = step?.section === si
          const partDone = step ? si < step.section : false
          return (
            <div key={s.id} className="ly-part">
              <button
                type="button"
                className={cx('ly-part__h', partNow && 'is-now')}
                onClick={() => show.actions.goTo(findStep(show.steps, { section: si, page: 0, line: null }))}
              >
                {s.label}
                {s.cues.map((c) => (
                  <Cue key={c} kind={c} />
                ))}
              </button>
              {s.lines.length === 0 && <div className={cx('ly-line ly-line--empty', partNow && 'is-now')}>Instrumental</div>}
              {s.lines.map((l, li) => {
                const page = pageOfLine(s.lines.length, li)
                const now = partNow && (step?.line === null ? step.page === page : step?.line === li)
                const done = partDone || (partNow && step != null && (step.line === null ? page < step.page : li < (step.line ?? 0)))
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={cx('ly-line', now && 'is-now', done && 'is-done')}
                    onClick={() => show.actions.goTo(findStep(show.steps, { section: si, page, line: li }))}
                  >
                    <span className="ly-line__n tabular" aria-hidden>
                      {firstLine[si] + li}
                    </span>
                    <span className="ly-line__t">{l.text}</span>
                    {l.cues.map((c) => (
                      <Cue key={c} kind={c} />
                    ))}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
