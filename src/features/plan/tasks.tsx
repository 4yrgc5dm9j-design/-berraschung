import { useEffect, useMemo, useState, useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Flag, Plus, Repeat, Trash2, Link2 } from 'lucide-react'
import { Button, Chip, ConfirmDialog, EmptyState, Field, IconButton, Modal, Segmented } from '@/components/ui'
import { actions, useApp, useData, useSettings } from '@/data/store'
import type { Priority, Recurrence, Task } from '@/data/types'
import { cn, matches } from '@/lib/utils'
import { addDays, diffDays, nextOccurrence, recurrenceLabel, relativeDay, todayKey } from '@/lib/dates'
import { toast } from '@/data/toasts'

export const priorityLabel: Record<Priority, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' }
const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export function sortTasks(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1
  const ad = a.due ?? '9999', bd = b.due ?? '9999'
  if (ad !== bd) return ad.localeCompare(bd)
  return priorityRank[a.priority] - priorityRank[b.priority]
}

/** Aufgabe abhaken; bei Wiederholung wird automatisch der nächste Termin angelegt. */
export function toggleTask(t: Task) {
  const { update, add } = actions()
  if (!t.done) {
    update('tasks', t.id, { done: true, doneAt: new Date().toISOString() })
    if (t.recurrence !== 'none') {
      const base = t.due ?? todayKey()
      let next = nextOccurrence(base, t.recurrence)
      while (next < todayKey()) next = nextOccurrence(next, t.recurrence)
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = t
      add('tasks', { ...rest, due: next, done: false, doneAt: null })
      toast(`Nächste Wiederholung: ${relativeDay(next)}`, 'success')
    }
  } else {
    update('tasks', t.id, { done: false, doneAt: null })
  }
}

export function dueTone(t: Task): 'overdue' | 'today' | 'soon' | 'later' | null {
  if (!t.due || t.done) return null
  const d = diffDays(t.due, todayKey())
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 2) return 'soon'
  return 'later'
}

export function TaskRow({ task, onOpen, compact }: { task: Task; onOpen: (t: Task) => void; compact?: boolean }) {
  const tone = dueTone(task)
  return (
    <div className={cn('group flex items-start gap-3 rounded-2xl px-2 transition hover:bg-surface-2', compact ? 'py-1.5' : 'py-2.5')}>
      <button
        onClick={() => toggleTask(task)}
        aria-label={task.done ? 'Als offen markieren' : 'Als erledigt markieren'}
        className="-m-1.5 grid size-11 shrink-0 place-items-center"
      >
        <span
          className={cn(
            'grid size-[22px] place-items-center rounded-full border-2 transition',
            task.done ? 'animate-pop border-success bg-success text-white' : task.priority === 'high' ? 'border-danger' : 'border-line-strong hover:border-accent',
          )}
        >
          {task.done && <Check className="size-3.5" strokeWidth={3.5} />}
        </span>
      </button>
      <button onClick={() => onOpen(task)} className="min-w-0 flex-1 py-0.5 text-left">
        <span className={cn('block font-semibold leading-snug', task.done && 'text-faint line-through')}>{task.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {task.due && (
            <span className={cn(tone === 'overdue' && 'font-bold text-danger', tone === 'today' && 'font-bold text-accent')}>
              {tone === 'overdue' ? 'Überfällig · ' : ''}
              {relativeDay(task.due)}
              {task.dueTime && `, ${task.dueTime}`}
            </span>
          )}
          {task.category && <span>{task.category}</span>}
          {task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-0.5">
              <Repeat className="size-3" />
              {recurrenceLabel[task.recurrence]}
            </span>
          )}
          {task.priority === 'high' && !task.done && (
            <span className="inline-flex items-center gap-0.5 text-danger">
              <Flag className="size-3" /> Hoch
            </span>
          )}
          {task.sourceItemId && <Link2 className="size-3" aria-label="Aus Sammlung" />}
        </span>
      </button>
    </div>
  )
}

type Draft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>

export const emptyTask = (category = 'Privat'): Draft => ({
  title: '',
  notes: '',
  priority: 'medium',
  due: todayKey(),
  dueTime: null,
  category,
  recurrence: 'none',
  done: false,
  doneAt: null,
  sourceItemId: null,
})

export function TaskEditor({ open, task, initial, onClose }: { open: boolean; task?: Task | null; initial?: Partial<Draft>; onClose: () => void }) {
  const settings = useSettings()
  const [d, setD] = useState<Draft>(emptyTask())
  const [confirm, setConfirm] = useState(false)

  useLayoutEffect(() => {
    if (open) setD(task ? { ...task } : { ...emptyTask(settings.taskCategories[0]), ...initial })
  }, [open, task?.id])

  const save = () => {
    if (!d.title.trim()) return
    if (task) actions().update('tasks', task.id, { ...d, title: d.title.trim() })
    else {
      actions().add('tasks', { ...d, title: d.title.trim() })
      toast('Aufgabe angelegt', 'success')
    }
    onClose()
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const quickDates = [
    { label: 'Heute', v: todayKey() },
    { label: 'Morgen', v: addDays(todayKey(), 1) },
    { label: 'Nächste Woche', v: addDays(todayKey(), 7) },
    { label: 'Ohne', v: null },
  ]

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
        footer={
          <>
            {task && (
              <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                Löschen
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={save} disabled={!d.title.trim()}>
              Speichern
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Titel">
            <input className="field text-base" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Was ist zu tun?" />
          </Field>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Fällig</span>
            <div className="scroll-x -mx-1 mb-2 flex gap-2 px-1">
              {quickDates.map((q) => (
                <Chip key={q.label} active={d.due === q.v} onClick={() => set('due', q.v)}>
                  {q.label}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field" value={d.due ?? ''} onChange={(e) => set('due', e.target.value || null)} aria-label="Datum" />
              <input type="time" className="field" value={d.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || null)} aria-label="Uhrzeit" />
            </div>
          </div>
          <Field label="Priorität" group>
            <Segmented
              className="w-full"
              value={d.priority}
              onChange={(v) => set('priority', v)}
              options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: priorityLabel[p] }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategorie">
              <select className="field" value={d.category} onChange={(e) => set('category', e.target.value)}>
                {settings.taskCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Wiederholen">
              <select className="field" value={d.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
                {Object.entries(recurrenceLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notizen">
            <textarea className="field min-h-24" value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Details, Links, Gedanken …" />
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Aufgabe löschen?"
        message={`„${task?.title}“ wird gelöscht. Du kannst das direkt danach rückgängig machen.`}
        onConfirm={() => {
          if (task) actions().remove('tasks', task.id, 'Aufgabe gelöscht')
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

type Filter = 'offen' | 'heute' | 'woche' | 'erledigt'

export function TasksView() {
  const tasks = useData('tasks')
  const categories = useApp((s) => s.settings.taskCategories)
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('offen')
  const [cat, setCat] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [quick, setQuick] = useState('')
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    const id = params.get('open')
    if (id) {
      const t = tasks.find((x) => x.id === id)
      if (t) setEditing(t)
      params.delete('open')
      setParams(params, { replace: true })
    }
  }, [params, setParams, tasks])

  const today = todayKey()
  const filtered = useMemo(() => {
    return tasks
      .filter((t) => (cat ? t.category === cat : true))
      .filter((t) => matches(q, t.title, t.notes))
      .filter((t) => {
        if (filter === 'erledigt') return t.done
        if (filter === 'heute') return !t.done && t.due != null && t.due <= today
        if (filter === 'woche') return !t.done && t.due != null && t.due <= addDays(today, 7)
        return !t.done
      })
      .sort(sortTasks)
  }, [tasks, cat, q, filter, today])

  const groups = useMemo(() => {
    if (filter === 'erledigt') return [{ label: 'Erledigt', items: filtered.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')) }]
    const g: { label: string; items: Task[] }[] = [
      { label: 'Überfällig', items: [] },
      { label: 'Heute', items: [] },
      { label: 'Morgen', items: [] },
      { label: 'Demnächst', items: [] },
      { label: 'Ohne Datum', items: [] },
    ]
    for (const t of filtered) {
      if (!t.due) g[4].items.push(t)
      else if (t.due < today) g[0].items.push(t)
      else if (t.due === today) g[1].items.push(t)
      else if (t.due === addDays(today, 1)) g[2].items.push(t)
      else g[3].items.push(t)
    }
    return g.filter((x) => x.items.length)
  }, [filtered, filter, today])

  const recentlyDone = tasks.filter((t) => t.done && t.doneAt && t.doneAt.slice(0, 10) === today)

  const quickAdd = () => {
    const title = quick.trim()
    if (!title) return
    actions().add('tasks', { ...emptyTask(cat ?? categories[0]), title, due: filter === 'offen' ? null : today })
    setQuick('')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            quickAdd()
          }}
          className="card mb-4 flex items-center gap-2 p-2"
        >
          <Plus className="ml-2 size-5 text-accent" />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Neue Aufgabe – Enter zum Speichern"
            className="min-h-11 flex-1 bg-transparent px-1 outline-none placeholder:text-faint"
            aria-label="Schnell eine Aufgabe hinzufügen"
          />
          <Button size="sm" variant="ghost" type="button" onClick={() => setCreating(true)}>
            Details
          </Button>
        </form>

        <div className="scroll-x -mx-1 mb-3 flex gap-2 px-1">
          {(['offen', 'heute', 'woche', 'erledigt'] as Filter[]).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {{ offen: 'Alle offenen', heute: 'Heute', woche: '7 Tage', erledigt: 'Erledigt' }[f]}
            </Chip>
          ))}
        </div>

        {groups.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="✅"
              title={filter === 'erledigt' ? 'Noch nichts erledigt' : 'Alles erledigt!'}
              text={filter === 'erledigt' ? 'Abgehakte Aufgaben erscheinen hier.' : 'Keine offenen Aufgaben in dieser Ansicht. Zeit für eine Pause.'}
              action={
                <Button variant="soft" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  Aufgabe anlegen
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.label} className="card p-3">
                <h3 className={cn('mb-1 px-2 pt-1 text-xs font-bold uppercase tracking-wider', g.label === 'Überfällig' ? 'text-danger' : 'text-faint')}>
                  {g.label} · {g.items.length}
                </h3>
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={setEditing} />
                ))}
              </section>
            ))}
          </div>
        )}

        {filter !== 'erledigt' && recentlyDone.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setShowDone(!showDone)} className="flex min-h-10 items-center gap-1 px-2 text-sm font-semibold text-muted">
              <ChevronDown className={cn('size-4 transition', showDone && 'rotate-180')} />
              Heute erledigt ({recentlyDone.length})
            </button>
            {showDone && (
              <div className="card mt-2 p-3">
                {recentlyDone.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={setEditing} compact />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aufgaben durchsuchen" className="field" aria-label="Aufgaben durchsuchen" />
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-faint">Kategorien</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={cat === null} onClick={() => setCat(null)}>
              Alle
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>
                {c} <span className="opacity-60">{tasks.filter((t) => !t.done && t.category === c).length}</span>
              </Chip>
            ))}
          </div>
        </div>
        {filter === 'erledigt' && filtered.length > 0 && (
          <Button
            variant="ghost"
            className="w-full"
            icon={<Trash2 className="size-4" />}
            onClick={() => actions().removeMany('tasks', filtered.map((t) => t.id), `${filtered.length} erledigte Aufgaben gelöscht`)}
          >
            Erledigte löschen
          </Button>
        )}
      </aside>

      <TaskEditor open={creating || !!editing} task={editing} initial={cat ? { category: cat } : undefined} onClose={() => { setCreating(false); setEditing(null) }} />
    </div>
  )
}

export function AddTaskButton({ label = 'Aufgabe' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={`${label} hinzufügen`} size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
      </IconButton>
      <TaskEditor open={open} onClose={() => setOpen(false)} />
    </>
  )
}
