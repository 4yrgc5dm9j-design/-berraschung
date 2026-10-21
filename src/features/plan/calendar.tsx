import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, Field, IconButton, Modal } from '@/components/ui'
import { actions, useData } from '@/data/store'
import type { CalEvent, EventKind, Recurrence, Task } from '@/data/types'
import { cn } from '@/lib/utils'
import { addDays, fmtDate, fromDateKey, monthMatrix, occursOn, recurrenceLabel, relativeDay, todayKey } from '@/lib/dates'
import { toast } from '@/data/toasts'
import { TaskEditor, TaskRow } from './tasks'

export const kindMeta: Record<EventKind, { label: string; color: string }> = {
  termin: { label: 'Termin', color: '#3b82f6' },
  pruefung: { label: 'Prüfung', color: '#ef4444' },
  vorlesung: { label: 'Vorlesung', color: '#8b5cf6' },
  arbeit: { label: 'Arbeit', color: '#0ea5a4' },
  privat: { label: 'Privat', color: '#f59e0b' },
}

export function eventsOn(events: CalEvent[], key: string) {
  return events
    .filter((e) => occursOn(e.date, e.recurrence, key))
    .sort((a, b) => (a.start ?? '00:00').localeCompare(b.start ?? '00:00'))
}

/** Kommende Termine (inkl. Wiederholungen) für die nächsten `days` Tage. */
export function upcomingEvents(events: CalEvent[], days = 14, from = todayKey()) {
  const out: { event: CalEvent; date: string }[] = []
  for (let i = 0; i <= days; i++) {
    const key = addDays(from, i)
    for (const e of eventsOn(events, key)) out.push({ event: e, date: key })
  }
  return out
}

export function EventPill({ e, date, onClick }: { e: CalEvent; date?: string; onClick?: () => void }) {
  const meta = kindMeta[e.kind]
  return (
    <button onClick={onClick} className="flex w-full items-stretch gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-surface-2">
      <span className="w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
      <span className="w-12 shrink-0 pt-0.5 text-sm font-bold tabular">{e.start ?? 'Ganzt.'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{e.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {date && <span>{relativeDay(date)}</span>}
          <span style={{ color: meta.color }} className="font-semibold">
            {meta.label}
          </span>
          {e.end && <span>bis {e.end}</span>}
          {e.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" />
              {e.location}
            </span>
          )}
          {e.recurrence !== 'none' && <Repeat className="size-3" aria-label="Wiederholt sich" />}
        </span>
      </span>
    </button>
  )
}

type Draft = Omit<CalEvent, 'id' | 'createdAt' | 'updatedAt'>
const emptyEvent = (date = todayKey()): Draft => ({ title: '', date, start: '09:00', end: null, kind: 'termin', location: '', notes: '', recurrence: 'none' })

export function EventEditor({ open, event, date, onClose }: { open: boolean; event?: CalEvent | null; date?: string; onClose: () => void }) {
  const [d, setD] = useState<Draft>(emptyEvent())
  const [allDay, setAllDay] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (open) {
      const init = event ? { ...event } : emptyEvent(date)
      setD(init)
      setAllDay(!init.start)
    }
  }, [open, event, date])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const save = () => {
    if (!d.title.trim() || !d.date) return
    const v = { ...d, title: d.title.trim(), start: allDay ? null : d.start, end: allDay ? null : d.end }
    if (event) actions().update('events', event.id, v)
    else {
      actions().add('events', v)
      toast('Termin gespeichert', 'success')
    }
    onClose()
  }
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={event ? 'Termin bearbeiten' : 'Neuer Termin'}
        footer={
          <>
            {event && (
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
        <div className="space-y-4">
          <Field label="Titel">
            <input className="field text-base" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Klausur Makroökonomie" onKeyDown={(e) => e.key === 'Enter' && save()} />
          </Field>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Art</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(kindMeta) as EventKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => set('kind', k)}
                  className={cn('inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold', d.kind === k ? 'border-transparent bg-text text-bg' : 'border-line text-muted')}
                >
                  <span className="size-2.5 rounded-full" style={{ background: kindMeta[k].color }} />
                  {kindMeta[k].label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Datum">
            <input type="date" className="field" value={d.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            Ganztägig
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Beginn">
                <input type="time" className="field" value={d.start ?? ''} onChange={(e) => set('start', e.target.value || null)} />
              </Field>
              <Field label="Ende">
                <input type="time" className="field" value={d.end ?? ''} onChange={(e) => set('end', e.target.value || null)} />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ort">
              <input className="field" value={d.location} onChange={(e) => set('location', e.target.value)} placeholder="optional" />
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
            <textarea className="field min-h-20" value={d.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Termin löschen?"
        message={event?.recurrence !== 'none' ? 'Alle Wiederholungen dieses Termins werden gelöscht.' : `„${event?.title}“ wird gelöscht.`}
        onConfirm={() => {
          if (event) actions().remove('events', event.id, 'Termin gelöscht')
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

export function CalendarView() {
  const events = useData('events')
  const tasks = useData('tasks')
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState(params.get('date') ?? todayKey())
  const [cursor, setCursor] = useState(() => {
    const d = fromDateKey(params.get('date') ?? todayKey())
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [creating, setCreating] = useState(false)
  const [taskEdit, setTaskEdit] = useState<Task | null>(null)

  useEffect(() => {
    const id = params.get('open')
    if (id) {
      const e = events.find((x) => x.id === id)
      if (e) setEditing(e)
      params.delete('open')
      setParams(params, { replace: true })
    }
  }, [params, setParams, events])

  const days = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor])
  const today = todayKey()
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const dayEvents = eventsOn(events, selected)
  const dayTasks = tasks.filter((t) => t.due === selected)
  const exams = upcomingEvents(events.filter((e) => e.kind === 'pruefung'), 120)

  const shift = (n: number) => {
    const d = new Date(cursor.y, cursor.m + n, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold capitalize">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const d = new Date()
                setCursor({ y: d.getFullYear(), m: d.getMonth() })
                setSelected(today)
              }}
            >
              Heute
            </Button>
            <IconButton label="Vorheriger Monat" onClick={() => shift(-1)}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton label="Nächster Monat" onClick={() => shift(1)}>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-bold uppercase tracking-wider text-faint">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
            <div key={d} className="pb-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((key) => {
            const inMonth = fromDateKey(key).getMonth() === cursor.m
            const evs = eventsOn(events, key)
            const tk = tasks.filter((t) => t.due === key && !t.done).length
            const isSel = key === selected
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                aria-label={fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' })}
                aria-pressed={isSel}
                className={cn(
                  'flex aspect-square min-h-11 flex-col items-center justify-start gap-1 rounded-xl pt-1.5 text-sm transition sm:aspect-[1.1]',
                  !inMonth && 'opacity-35',
                  isSel ? 'bg-accent text-accent-fg' : 'hover:bg-surface-2',
                )}
              >
                <span className={cn('grid size-7 place-items-center rounded-full font-semibold tabular', key === today && !isSel && 'bg-accent-soft text-accent')}>
                  {fromDateKey(key).getDate()}
                </span>
                <span className="flex gap-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="size-1.5 rounded-full" style={{ background: isSel ? 'currentColor' : kindMeta[e.kind].color }} />
                  ))}
                  {tk > 0 && <span className={cn('size-1.5 rounded-full border', isSel ? 'border-current' : 'border-muted')} />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          {(Object.keys(kindMeta) as EventKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: kindMeta[k].color }} />
              {kindMeta[k].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-muted" /> Aufgabe fällig
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-faint">{relativeDay(selected)}</p>
              <h3 className="font-display text-lg font-semibold">{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            </div>
            <Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Termin
            </Button>
          </div>
          {dayEvents.length === 0 && dayTasks.length === 0 ? (
            <EmptyState compact title="Nichts geplant" text="Freier Tag – oder Zeit, etwas einzutragen." />
          ) : (
            <>
              {dayEvents.map((e) => (
                <EventPill key={e.id} e={e} onClick={() => setEditing(e)} />
              ))}
              {dayTasks.length > 0 && (
                <>
                  <p className="mt-3 px-2 text-xs font-bold uppercase tracking-wider text-faint">Aufgaben</p>
                  {dayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onOpen={setTaskEdit} compact />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-2 font-display font-semibold">Anstehende Prüfungen</h3>
          {exams.length === 0 ? (
            <p className="text-sm text-muted">Keine Prüfungen in den nächsten 4 Monaten eingetragen. Lege einen Termin der Art „Prüfung“ an, um einen Countdown zu sehen.</p>
          ) : (
            exams.slice(0, 5).map(({ event, date }) => {
              const left = Math.round((fromDateKey(date).getTime() - fromDateKey(today).getTime()) / 86400000)
              return (
                <button key={event.id + date} onClick={() => setEditing(event)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-danger/10 text-center font-display font-bold leading-none text-danger">
                    <span>
                      {left}
                      <span className="block text-[10px] font-semibold">{left === 1 ? 'Tag' : 'Tage'}</span>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{event.title}</span>
                    <span className="text-xs text-muted">{fmtDate(date, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      <EventEditor open={creating || !!editing} event={editing} date={selected} onClose={() => { setCreating(false); setEditing(null) }} />
      <TaskEditor open={!!taskEdit} task={taskEdit} onClose={() => setTaskEdit(null)} />
    </div>
  )
}

