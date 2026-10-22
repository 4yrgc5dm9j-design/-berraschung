import { useEffect, useMemo, useState, useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckSquare, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Chip, ConfirmDialog, EmptyState, Field, IconButton, Modal } from '@/components/ui'
import { actions, useData } from '@/data/store'
import type { Note, NoteColor } from '@/data/types'
import { cn, matches, parseTags } from '@/lib/utils'
import { timeAgo } from '@/lib/dates'
import { toast } from '@/data/toasts'
import { emptyTask } from './tasks'

export const noteColors: Record<NoteColor, { label: string; bg: string; dot: string }> = {
  none: { label: 'Standard', bg: '', dot: 'var(--surface-3)' },
  gelb: { label: 'Gelb', bg: 'bg-[#fff6d6] dark:bg-[#2b2614]', dot: '#f5c84b' },
  gruen: { label: 'Grün', bg: 'bg-[#e4f7ea] dark:bg-[#14271c]', dot: '#4cc47a' },
  blau: { label: 'Blau', bg: 'bg-[#e4eeff] dark:bg-[#141e33]', dot: '#5b8cff' },
  rosa: { label: 'Rosa', bg: 'bg-[#ffe8ef] dark:bg-[#2e1620]', dot: '#f2709c' },
  lila: { label: 'Lila', bg: 'bg-[#efe8ff] dark:bg-[#1f1833]', dot: '#9b7bf2' },
}

type Draft = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
const emptyNote = (): Draft => ({ title: '', body: '', pinned: false, color: 'none', tags: [] })

export function NoteEditor({ open, note, onClose }: { open: boolean; note?: Note | null; onClose: () => void }) {
  const [d, setD] = useState<Draft>(emptyNote())
  const [tags, setTags] = useState('')
  const [confirm, setConfirm] = useState(false)
  useLayoutEffect(() => {
    if (open) {
      setD(note ? { ...note } : emptyNote())
      setTags(note ? note.tags.join(', ') : '')
    }
  }, [open, note])
  const empty = !d.title.trim() && !d.body.trim()
  const save = () => {
    if (empty) return onClose()
    const v = { ...d, tags: parseTags(tags) }
    if (note) actions().update('notes', note.id, v)
    else {
      actions().add('notes', v)
      toast('Notiz gespeichert', 'success')
    }
    onClose()
  }
  const toTasks = () => {
    // Jede Zeile, die wie ein Listenpunkt aussieht, wird zur Aufgabe.
    const bullet = /^\s*([-*•]|\[ \]|\d+\.)\s+/
    const lines = d.body
      .split('\n')
      .filter((l) => bullet.test(l))
      .map((l) => l.replace(bullet, '').trim())
      .filter(Boolean)
    if (!lines.length) return toast('Keine Listenpunkte gefunden („- …“)')
    for (const l of lines) actions().add('tasks', { ...emptyTask('Privat'), title: l, due: null })
    toast(`${lines.length} Aufgabe(n) erstellt`, 'success')
  }
  return (
    <>
      <Modal
        open={open}
        onClose={save}
        title={note ? 'Notiz' : 'Neue Notiz'}
        wide
        footer={
          <>
            {note && (
              <IconButton label="Notiz löschen" onClick={() => setConfirm(true)} className="mr-auto text-danger">
                <Trash2 className="size-5" />
              </IconButton>
            )}
            <IconButton label="Listenpunkte als Aufgaben übernehmen" onClick={toTasks}>
              <CheckSquare className="size-5" />
            </IconButton>
            <IconButton label={d.pinned ? 'Lösen' : 'Anheften'} active={d.pinned} onClick={() => setD({ ...d, pinned: !d.pinned })}>
              {d.pinned ? <PinOff className="size-5" /> : <Pin className="size-5" />}
            </IconButton>
            <Button variant="primary" onClick={save}>
              Fertig
            </Button>
          </>
        }
      >
        <input
          className="w-full bg-transparent py-2 font-display text-2xl font-semibold outline-none placeholder:text-faint"
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder="Titel"
          aria-label="Titel"
        />
        <textarea
          className="min-h-[38vh] w-full resize-none bg-transparent py-2 leading-relaxed outline-none placeholder:text-faint"
          value={d.body}
          onChange={(e) => setD({ ...d, body: e.target.value })}
          placeholder={'Schreib los …\n\nTipp: Zeilen mit „- “ kannst du mit einem Tipp als Aufgaben übernehmen.'}
          aria-label="Inhalt"
        />
        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <Field label="Tags">
            <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="uni, idee, bank" />
          </Field>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Farbe</span>
            <div className="flex gap-2">
              {(Object.keys(noteColors) as NoteColor[]).map((c) => (
                <button
                  key={c}
                  aria-label={noteColors[c].label}
                  onClick={() => setD({ ...d, color: c })}
                  className={cn('size-10 rounded-full border-2 transition', d.color === c ? 'border-text' : 'border-transparent')}
                  style={{ background: noteColors[c].dot }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Notiz löschen?"
        message="Die Notiz wird gelöscht. Direkt danach kannst du das rückgängig machen."
        onConfirm={() => {
          if (note) actions().remove('notes', note.id, 'Notiz gelöscht')
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

export function NotesView() {
  const notes = useData('notes')
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Note | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const id = params.get('open')
    if (id) {
      const n = notes.find((x) => x.id === id)
      if (n) setEditing(n)
      params.delete('open')
      setParams(params, { replace: true })
    }
  }, [params, setParams, notes])

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes])
  const list = useMemo(
    () =>
      notes
        .filter((n) => matches(q, n.title, n.body, n.tags.join(' ')))
        .filter((n) => (tag ? n.tags.includes(tag) : true))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    [notes, q, tag],
  )

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Notizen durchsuchen" aria-label="Notizen durchsuchen" />
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
          Neue Notiz
        </Button>
      </div>
      {allTags.length > 0 && (
        <div className="scroll-x -mx-1 mb-4 flex gap-2 px-1">
          <Chip active={!tag} onClick={() => setTag(null)}>
            Alle
          </Chip>
          {allTags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </Chip>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📝"
            title={notes.length ? 'Keine Treffer' : 'Noch keine Notizen'}
            text={notes.length ? 'Versuch einen anderen Suchbegriff.' : 'Halte Gedanken, Vorlesungsnotizen oder Ideen fest.'}
            action={!notes.length && <Button variant="soft" onClick={() => setCreating(true)}>Erste Notiz schreiben</Button>}
          />
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {list.map((n) => (
            <button
              key={n.id}
              onClick={() => setEditing(n)}
              className={cn('card mb-4 block w-full break-inside-avoid p-4 text-left transition hover:-translate-y-0.5', noteColors[n.color].bg)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-semibold">{n.title || 'Ohne Titel'}</h3>
                {n.pinned && <Pin className="size-4 shrink-0 text-accent" />}
              </div>
              {n.body && <p className="mt-1.5 line-clamp-[8] whitespace-pre-line text-sm text-muted">{n.body}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-faint">
                {n.tags.map((t) => (
                  <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">
                    #{t}
                  </span>
                ))}
                <span className="ml-auto">{timeAgo(n.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <NoteEditor open={creating || !!editing} note={editing} onClose={() => { setCreating(false); setEditing(null) }} />
    </div>
  )
}
