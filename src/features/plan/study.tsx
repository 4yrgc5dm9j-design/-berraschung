import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pause, Play, Plus, RotateCcw, SkipForward, Trash2, Pencil } from 'lucide-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Modal, ProgressBar, Segmented } from '@/components/ui'
import { actions, useData, useSettings } from '@/data/store'
import type { Deck, Flashcard } from '@/data/types'
import { cn, pickRandom } from '@/lib/utils'
import { addDays, todayKey, startOfWeek } from '@/lib/dates'
import { toast } from '@/data/toasts'

// ================================================================ Lernkarten
const BOX_DAYS = [0, 1, 2, 4, 8, 16] // Leitner-Intervalle je Fach
const deckColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export function FlashcardsView() {
  const decks = useData('decks')
  const cards = useData('cards')
  const [params, setParams] = useSearchParams()
  const deckId = params.get('deck')
  const deck = decks.find((d) => d.id === deckId) ?? null
  const [newDeck, setNewDeck] = useState(false)
  const [name, setName] = useState('')

  if (deck) return <DeckView deck={deck} onBack={() => setParams({}, { replace: false })} />

  const today = todayKey()
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-muted">Lernen mit dem Karteikasten-Prinzip: Gewusste Karten kommen seltener wieder.</p>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNewDeck(true)}>
          Stapel
        </Button>
      </div>
      {decks.length === 0 ? (
        <Card>
          <EmptyState icon="🧠" title="Noch keine Lernkarten" text="Lege einen Stapel an, z. B. „Bankrecht“ oder „Statistik“." action={<Button variant="soft" onClick={() => setNewDeck(true)}>Stapel anlegen</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map((d) => {
            const dc = cards.filter((c) => c.deckId === d.id)
            const due = dc.filter((c) => c.dueDate <= today).length
            const mastered = dc.filter((c) => c.box >= 4).length
            return (
              <button key={d.id} onClick={() => setParams({ deck: d.id })} className="card group overflow-hidden text-left transition hover:-translate-y-0.5">
                <div className="h-2" style={{ background: d.color }} />
                <div className="p-4">
                  <h3 className="font-display text-lg font-semibold">{d.name}</h3>
                  <p className="text-sm text-muted">
                    {dc.length} Karten · <span className={cn(due && 'font-bold text-accent')}>{due} fällig</span>
                  </p>
                  <ProgressBar value={dc.length ? mastered / dc.length : 0} className="mt-3" tone="success" />
                  <p className="mt-1 text-xs text-faint">{dc.length ? Math.round((mastered / dc.length) * 100) : 0} % sicher gelernt</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
      <Modal
        open={newDeck}
        onClose={() => setNewDeck(false)}
        title="Neuer Stapel"
        footer={
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              const d = actions().add('decks', { name: name.trim(), color: pickRandom(deckColors)! })
              setName('')
              setNewDeck(false)
              setParams({ deck: d.id })
            }}
          >
            Anlegen
          </Button>
        }
      >
        <Field label="Name">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Kreditwesengesetz" />
        </Field>
      </Modal>
    </div>
  )
}

function DeckView({ deck, onBack }: { deck: Deck; onBack: () => void }) {
  const cards = useData('cards').filter((c) => c.deckId === deck.id)
  const [mode, setMode] = useState<'list' | 'learn'>('list')
  const [edit, setEdit] = useState<Flashcard | null>(null)
  const [adding, setAdding] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [confirm, setConfirm] = useState(false)
  const today = todayKey()
  const due = cards.filter((c) => c.dueDate <= today)

  useEffect(() => {
    if (edit) {
      setFront(edit.front)
      setBack(edit.back)
    }
  }, [edit])

  const saveCard = () => {
    if (!front.trim() || !back.trim()) return
    if (edit) actions().update('cards', edit.id, { front: front.trim(), back: back.trim() })
    else actions().add('cards', { deckId: deck.id, front: front.trim(), back: back.trim(), box: 1, dueDate: today })
    setFront('')
    setBack('')
    if (edit) {
      setEdit(null)
      setAdding(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton label="Zurück" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <h2 className="mr-auto font-display text-2xl font-semibold">{deck.name}</h2>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'list', label: 'Karten' }, { value: 'learn', label: `Lernen (${due.length})` }]} />
      </div>
      {mode === 'learn' ? (
        <LearnSession cards={due} onDone={() => setMode('list')} />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => { setEdit(null); setFront(''); setBack(''); setAdding(true) }}>
              Karte hinzufügen
            </Button>
            <Button variant="ghost" className="ml-auto text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
              Stapel löschen
            </Button>
          </div>
          {cards.length === 0 ? (
            <Card>
              <EmptyState compact icon="🃏" title="Leerer Stapel" text="Füge Frage und Antwort hinzu." />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((c) => (
                <div key={c.id} className="card flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.front}</p>
                    <p className="mt-1 text-sm text-muted">{c.back}</p>
                    <p className="mt-2 text-xs text-faint">
                      Fach {c.box}/5 · {c.dueDate <= today ? 'fällig' : `wieder am ${new Date(c.dueDate).toLocaleDateString('de-DE')}`}
                    </p>
                  </div>
                  <IconButton label="Bearbeiten" size="sm" onClick={() => { setEdit(c); setAdding(true) }}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label="Löschen" size="sm" onClick={() => actions().remove('cards', c.id, 'Karte gelöscht')}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Modal
        open={adding}
        onClose={() => { setAdding(false); setEdit(null) }}
        title={edit ? 'Karte bearbeiten' : 'Neue Karte'}
        footer={
          <Button variant="primary" onClick={saveCard} disabled={!front.trim() || !back.trim()}>
            {edit ? 'Speichern' : 'Hinzufügen & weiter'}
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Vorderseite (Frage)">
            <textarea className="field min-h-20" value={front} onChange={(e) => setFront(e.target.value)} />
          </Field>
          <Field label="Rückseite (Antwort)">
            <textarea className="field min-h-24" value={back} onChange={(e) => setBack(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Stapel löschen?"
        message={`„${deck.name}“ und alle ${cards.length} Karten werden gelöscht.`}
        onConfirm={() => {
          actions().remove('decks', deck.id, 'Stapel gelöscht')
          onBack()
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}

function LearnSession({ cards, onDone }: { cards: Flashcard[]; onDone: () => void }) {
  const [queue] = useState(() => [...cards].sort(() => Math.random() - 0.5).map((c) => c.id))
  const all = useData('cards')
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState({ ok: 0, bad: 0 })
  const card = all.find((c) => c.id === queue[idx])

  if (queue.length === 0)
    return (
      <Card>
        <EmptyState icon="🎉" title="Alles gelernt für heute" text="Keine fälligen Karten. Komm morgen wieder!" action={<Button onClick={onDone}>Zur Kartenliste</Button>} />
      </Card>
    )
  if (!card)
    return (
      <Card>
        <EmptyState icon="🏁" title="Runde geschafft" text={`${stats.ok} gewusst, ${stats.bad} noch üben.`} action={<Button variant="primary" onClick={onDone}>Fertig</Button>} />
      </Card>
    )

  const answer = (known: boolean) => {
    const box = known ? Math.min(5, card.box + 1) : 1
    actions().update('cards', card.id, { box, dueDate: addDays(todayKey(), known ? BOX_DAYS[box] : 0) })
    setStats((s) => (known ? { ...s, ok: s.ok + 1 } : { ...s, bad: s.bad + 1 }))
    setFlipped(false)
    setIdx(idx + 1)
  }

  return (
    <div className="mx-auto max-w-xl">
      <ProgressBar value={idx / queue.length} className="mb-4" />
      <button onClick={() => setFlipped(!flipped)} className="card flex min-h-[280px] w-full flex-col items-center justify-center p-8 text-center transition active:scale-[0.99]">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-faint">{flipped ? 'Antwort' : 'Frage'} · Fach {card.box}</p>
        <p className="font-display text-2xl font-semibold leading-snug">{flipped ? card.back : card.front}</p>
        {!flipped && <p className="mt-6 text-sm text-muted">Tippen zum Umdrehen</p>}
      </button>
      {flipped && (
        <div className="mt-4 grid animate-rise grid-cols-2 gap-3">
          <Button size="lg" variant="danger" onClick={() => answer(false)}>
            Nochmal üben
          </Button>
          <Button size="lg" variant="primary" onClick={() => answer(true)}>
            Gewusst
          </Button>
        </div>
      )}
    </div>
  )
}

// ================================================================ Fokus-Timer
type Phase = 'work' | 'short' | 'long'
interface TimerState {
  phase: Phase
  round: number
  running: boolean
  endsAt: number | null // Zeitstempel, damit der Timer auch nach Neuladen weiterläuft
  remaining: number // Sekunden, wenn pausiert
  label: string
  set: (p: Partial<TimerState>) => void
}

export const useTimer = create<TimerState>()(
  persist((set) => ({ phase: 'work', round: 1, running: false, endsAt: null, remaining: 25 * 60, label: '', set: (p) => set(p) }), {
    name: 'dailybase-timer',
    partialize: ({ set: _s, ...rest }) => rest,
  }),
)

const phaseLabel: Record<Phase, string> = { work: 'Fokus', short: 'Kurze Pause', long: 'Lange Pause' }

export function useTimerTick() {
  const t = useTimer()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!t.running) return
    const i = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(i)
  }, [t.running])
  const left = t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - now) / 1000)) : t.remaining
  return { ...t, left }
}

export function FocusView() {
  const settings = useSettings()
  const sessions = useData('focusSessions')
  const t = useTimerTick()
  const durations: Record<Phase, number> = { work: settings.focus.work, short: settings.focus.short, long: settings.focus.long }
  const total = durations[t.phase] * 60

  // Phase beendet → protokollieren und nächste Phase vorbereiten
  useEffect(() => {
    if (t.running && t.left === 0) {
      if (t.phase === 'work') {
        actions().add('focusSessions', { startedAt: new Date(Date.now() - total * 1000).toISOString(), minutes: durations.work, label: t.label })
        notify('Fokus-Einheit geschafft! Zeit für eine Pause.')
      } else notify('Pause vorbei – weiter geht’s.')
      const next: Phase = t.phase === 'work' ? (t.round % settings.focus.rounds === 0 ? 'long' : 'short') : 'work'
      t.set({ running: false, endsAt: null, phase: next, round: t.phase === 'work' ? t.round : t.round + 1, remaining: durations[next] * 60 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.left, t.running])

  const start = () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    t.set({ running: true, endsAt: Date.now() + t.left * 1000 })
  }
  const pause = () => t.set({ running: false, endsAt: null, remaining: t.left })
  const reset = (phase: Phase = t.phase) => t.set({ running: false, endsAt: null, phase, remaining: durations[phase] * 60 })

  const mm = String(Math.floor(t.left / 60)).padStart(2, '0')
  const ss = String(t.left % 60).padStart(2, '0')
  const progress = 1 - t.left / total
  const R = 120
  const C = 2 * Math.PI * R

  const today = todayKey()
  const todayMin = sessions.filter((s) => s.startedAt.slice(0, 10) === today).reduce((a, s) => a + s.minutes, 0)
  const weekStart = startOfWeek(today)
  const weekMin = sessions.filter((s) => s.startedAt.slice(0, 10) >= weekStart).reduce((a, s) => a + s.minutes, 0)
  const recent = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 6)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card className="flex flex-col items-center p-6">
        <Segmented value={t.phase} onChange={(p) => reset(p)} options={(['work', 'short', 'long'] as Phase[]).map((p) => ({ value: p, label: phaseLabel[p] }))} />
        <div className="relative my-6 grid size-[280px] place-items-center">
          <svg viewBox="0 0 280 280" className="absolute inset-0 -rotate-90">
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset .3s linear' }}
            />
          </svg>
          <div className="text-center">
            <p className="font-display text-6xl font-bold tabular">
              {mm}:{ss}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {phaseLabel[t.phase]} · Runde {t.round}
            </p>
          </div>
        </div>
        <input
          className="field mb-4 max-w-sm text-center"
          value={t.label}
          onChange={(e) => t.set({ label: e.target.value })}
          placeholder="Woran arbeitest du? (optional)"
          aria-label="Thema der Lerneinheit"
        />
        <div className="flex items-center gap-3">
          <IconButton label="Zurücksetzen" onClick={() => reset()}>
            <RotateCcw className="size-5" />
          </IconButton>
          {t.running ? (
            <Button size="lg" variant="primary" className="min-w-36" icon={<Pause className="size-5" />} onClick={pause}>
              Pause
            </Button>
          ) : (
            <Button size="lg" variant="primary" className="min-w-36" icon={<Play className="size-5" />} onClick={start}>
              {t.left < total ? 'Weiter' : 'Start'}
            </Button>
          )}
          <IconButton
            label="Phase überspringen"
            onClick={() => {
              const next: Phase = t.phase === 'work' ? 'short' : 'work'
              reset(next)
            }}
          >
            <SkipForward className="size-5" />
          </IconButton>
        </div>
        <p className="mt-4 max-w-sm text-center text-xs text-faint">Der Timer läuft auch weiter, wenn du die Seite wechselst oder neu lädst.</p>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">Heute</p>
            <p className="font-display text-3xl font-bold tabular">{todayMin}<span className="text-base text-muted"> min</span></p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">Diese Woche</p>
            <p className="font-display text-3xl font-bold tabular">{(weekMin / 60).toFixed(1).replace('.', ',')}<span className="text-base text-muted"> h</span></p>
          </Card>
        </div>
        <Card className="p-4">
          <h3 className="mb-2 font-display font-semibold">Letzte Einheiten</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Noch keine abgeschlossene Fokus-Einheit.</p>
          ) : (
            recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
                <span className="truncate">{s.label || 'Fokus'}</span>
                <span className="shrink-0 text-muted">
                  {s.minutes} min · {new Date(s.startedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))
          )}
        </Card>
        <Card className="p-4 text-sm text-muted">
          Dauer anpassen: {settings.focus.work}/{settings.focus.short}/{settings.focus.long} Minuten – unter Profil → Fokus-Timer.
        </Card>
      </div>
    </div>
  )
}

function notify(msg: string) {
  toast(msg, 'success')
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Dailybase', { body: msg, icon: '/icons/icon-192.png' })
    navigator.vibrate?.([120, 60, 120])
  } catch {
    /* ignore */
  }
}

// kleine Hilfe fürs Dashboard
export function useDueCardCount() {
  const cards = useData('cards')
  const today = todayKey()
  return useMemo(() => cards.filter((c) => c.dueDate <= today).length, [cards, today])
}
