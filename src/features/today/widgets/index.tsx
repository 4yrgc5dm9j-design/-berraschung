import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Flame, Pause, Play, Plus, Shuffle, Pencil, Trash2, Droplets, Wind } from 'lucide-react'
import { Button, EmptyState, ErrorNote, IconButton, Modal, Field, ProgressBar, Skeleton, SourceLine } from '@/components/ui'
import { QuickIcon, guessIcon } from '@/components/ui/LinkIcon'
import { actions, useApp, useData, useSettings } from '@/data/store'
import type { QuickLink, QuickLinkIcon, ViewId, WidgetId } from '@/data/types'
import { cn, fmtEur, fmtMoney, fmtPct } from '@/lib/utils'
import { normalizeUrl } from '@/lib/links'
import { todayKey, addDays, fmtTime } from '@/lib/dates'
import { useNews, useQuotes, useWeather, useClub } from '@/services/hooks'
import { weatherInfo } from '@/services/weather'
import { TaskEditor, TaskRow, sortTasks } from '@/features/plan/tasks'
import { EventEditor, EventPill, upcomingEvents } from '@/features/plan/calendar'
import { streak, toggleHabitDay, monthStats } from '@/features/plan/life'
import { useTimerTick } from '@/features/plan/study'
import { NewsCard, NewsUnavailable } from '@/features/discover/news'
import { MatchHero } from '@/features/discover/sport'
import { RandomPick } from '@/features/collections/CollectionsPage'
import type { Task, CalEvent } from '@/data/types'

export const widgetMeta: Record<WidgetId, { title: string; description: string; wide?: boolean }> = {
  agenda: { title: 'Termine', description: 'Heute und die nächsten Tage' },
  tasks: { title: 'Aufgaben', description: 'Fällig & überfällig' },
  weather: { title: 'Wetter', description: 'Aktuell & Vorhersage' },
  quicklinks: { title: 'Schnellzugriff', description: 'Instagram, Spotify & Co.' },
  match: { title: 'Mein Verein', description: 'Nächstes Spiel' },
  watchlist: { title: 'Watchlist', description: 'Deine Aktien & ETFs' },
  news: { title: 'Nachrichten', description: 'Zu deinen Interessen' },
  habits: { title: 'Gewohnheiten', description: 'Heute abhaken' },
  focus: { title: 'Fokus', description: 'Lern-Timer' },
  idea: { title: 'Zufallsidee', description: 'Aus deinen Sammlungen' },
  budget: { title: 'Budget', description: 'Ausgaben diesen Monat' },
}

export function WidgetShell({ title, to, action, children, className }: { title: string; to?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('card flex min-w-0 flex-col p-4 sm:p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-1">
          {action}
          {to && (
            <Link to={to} aria-label={`${title} öffnen`} className="grid size-9 place-items-center rounded-xl text-faint hover:bg-surface-2 hover:text-text">
              <ArrowUpRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  )
}

const viewCategory: Record<ViewId, string> = { arbeit: 'Arbeit', uni: 'Uni', freizeit: 'Privat' }

// ---------------------------------------------------------------- Aufgaben
export function TasksWidget({ view }: { view: ViewId }) {
  const tasks = useData('tasks')
  const [onlyView, setOnlyView] = useState(true)
  const [edit, setEdit] = useState<Task | null>(null)
  const [create, setCreate] = useState(false)
  const cat = viewCategory[view]
  const horizon = addDays(todayKey(), 2)
  const relevant = tasks.filter((t) => !t.done && (!t.due || t.due <= horizon))
  const inView = relevant.filter((t) => t.category === cat)
  const list = (onlyView && inView.length ? inView : relevant).sort(sortTasks).slice(0, 6)
  const doneToday = tasks.filter((t) => t.done && t.doneAt?.slice(0, 10) === todayKey()).length
  const total = doneToday + tasks.filter((t) => !t.done && t.due && t.due <= todayKey()).length

  return (
    <WidgetShell
      title="Aufgaben"
      to="/planen/aufgaben"
      action={
        <IconButton label="Aufgabe hinzufügen" size="sm" onClick={() => setCreate(true)}>
          <Plus className="size-4" />
        </IconButton>
      }
    >
      {total > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <ProgressBar value={doneToday / total} tone="success" className="flex-1" />
          <span className="text-xs font-semibold text-muted tabular">
            {doneToday}/{total} heute
          </span>
        </div>
      )}
      {inView.length > 0 && inView.length !== relevant.length && (
        <div className="mb-2 flex gap-1 text-xs">
          <button onClick={() => setOnlyView(true)} className={cn('rounded-lg px-2 py-1 font-semibold', onlyView ? 'bg-accent-soft text-accent' : 'text-muted')}>
            {cat}
          </button>
          <button onClick={() => setOnlyView(false)} className={cn('rounded-lg px-2 py-1 font-semibold', !onlyView ? 'bg-accent-soft text-accent' : 'text-muted')}>
            Alle
          </button>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState compact icon="✨" title="Nichts Dringendes" text="Keine fälligen Aufgaben in den nächsten Tagen." />
      ) : (
        <div className="-mx-2">
          {list.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={setEdit} compact />
          ))}
        </div>
      )}
      <TaskEditor open={create || !!edit} task={edit} initial={create ? { category: cat } : undefined} onClose={() => { setCreate(false); setEdit(null) }} />
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Termine
export function AgendaWidget() {
  const events = useData('events')
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const [create, setCreate] = useState(false)
  const upcoming = upcomingEvents(events, 7).filter(({ event, date }) => date !== todayKey() || !event.end || event.end >= new Date().toTimeString().slice(0, 5))
  return (
    <WidgetShell
      title="Termine"
      to="/planen/kalender"
      action={
        <IconButton label="Termin hinzufügen" size="sm" onClick={() => setCreate(true)}>
          <Plus className="size-4" />
        </IconButton>
      }
    >
      {upcoming.length === 0 ? (
        <EmptyState compact icon="📅" title="Keine Termine" text="Die nächsten 7 Tage sind frei." />
      ) : (
        <div className="-mx-2">
          {upcoming.slice(0, 5).map(({ event, date }) => (
            <EventPill key={event.id + date} e={event} date={date} onClick={() => setEdit(event)} />
          ))}
        </div>
      )}
      <EventEditor open={create || !!edit} event={edit} onClose={() => { setCreate(false); setEdit(null) }} />
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Wetter
export function WeatherWidget() {
  const { weather: loc } = useSettings()
  const w = useWeather()
  if (!loc)
    return (
      <WidgetShell title="Wetter">
        <EmptyState compact icon="🌤️" title="Kein Ort gewählt" action={<Link to="/profil" className="font-semibold text-accent">Ort festlegen</Link>} />
      </WidgetShell>
    )
  const d = w.data
  const info = d ? weatherInfo(d.current.code, d.current.isDay) : null
  return (
    <WidgetShell title={`Wetter · ${loc.name}`} to="/profil">
      {!d && w.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !d && w.error ? (
        <ErrorNote error={w.error} onRetry={w.reload} compact />
      ) : d && info ? (
        <>
          <div className="flex items-center gap-4">
            <span className="text-5xl leading-none" aria-hidden>
              {info.emoji}
            </span>
            <div>
              <p className="font-display text-5xl font-bold tracking-tight tabular">{Math.round(d.current.temp)}°</p>
            </div>
            <div className="ml-auto text-right text-sm">
              <p className="font-semibold">{info.label}</p>
              <p className="text-muted">Gefühlt {Math.round(d.current.feels)}°</p>
              <p className="text-muted">
                H {Math.round(d.daily[0].max)}° · T {Math.round(d.daily[0].min)}°
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Wind className="size-3.5" /> {Math.round(d.current.wind)} km/h
            </span>
            <span className="inline-flex items-center gap-1">
              <Droplets className="size-3.5" /> Regen bis {d.daily[0].pop} %
            </span>
          </div>
          <div className="scroll-x -mx-1 mt-3 flex gap-1 px-1">
            {d.hourly.slice(0, 10).map((h) => (
              <div key={h.time} className="flex min-w-12 flex-col items-center gap-1 rounded-xl bg-surface-2 py-2 text-xs">
                <span className="text-muted">{fmtTime(h.time)}</span>
                <span className="text-lg leading-none">{weatherInfo(h.code).emoji}</span>
                <span className="font-semibold tabular">{Math.round(h.temp)}°</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs sm:grid-cols-6">
            {d.daily.slice(1, 7).map((day, i) => (
              <div key={day.date} className={cn(i >= 4 && 'hidden sm:block')}>
                <p className="text-muted">{new Date(day.date).toLocaleDateString('de-DE', { weekday: 'short' })}</p>
                <p className="text-base">{weatherInfo(day.code).emoji}</p>
                <p className="font-semibold tabular">
                  {Math.round(day.max)}° <span className="text-faint">{Math.round(day.min)}°</span>
                </p>
              </div>
            ))}
          </div>
          <SourceLine className="mt-3" source="Open-Meteo" href="https://open-meteo.com" fetchedAt={w.fetchedAt} stale={w.stale} loading={w.loading} onReload={w.reload} />
        </>
      ) : null}
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Schnellzugriffe
export function QuickLinkEditor({ open, link, onClose }: { open: boolean; link: QuickLink | null; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [icon, setIcon] = useState<QuickLinkIcon | 'auto'>('auto')
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setLabel(link?.label ?? '')
      setUrl(link?.url ?? '')
      setIcon(link?.icon ?? 'auto')
    }
  }
  const norm = normalizeUrl(url)
  const finalIcon = icon === 'auto' ? guessIcon(url) : icon
  const save = () => {
    if (!norm || !label.trim()) return
    if (link) actions().update('links', link.id, { label: label.trim(), url: norm, icon: finalIcon })
    else actions().add('links', { label: label.trim(), url: norm, icon: finalIcon })
    onClose()
  }
  const icons: QuickLinkIcon[] = ['instagram', 'spotify', 'youtube', 'mail', 'bank', 'uni', 'news', 'maps', 'chat', 'web']
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={link ? 'Schnellzugriff bearbeiten' : 'Neuer Schnellzugriff'}
      footer={
        <>
          {link && (
            <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={() => { actions().remove('links', link.id, 'Schnellzugriff entfernt'); onClose() }}>
              Entfernen
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={!norm || !label.trim()}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Moodle, Online-Banking" />
        </Field>
        <Field label="Adresse" hint={url && !norm ? <span className="text-danger">Bitte eine gültige Web-Adresse eingeben.</span> : undefined}>
          <input className="field" value={url} inputMode="url" onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-muted">Symbol</span>
          <div className="flex flex-wrap gap-2">
            {icons.map((i) => (
              <button key={i} onClick={() => setIcon(i)} aria-label={i} className={cn('rounded-2xl p-0.5 ring-2', finalIcon === i ? 'ring-accent' : 'ring-transparent')}>
                <QuickIcon icon={i} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function QuickLinksWidget() {
  const links = useData('links')
  const [edit, setEdit] = useState<QuickLink | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <WidgetShell
      title="Schnellzugriff"
      action={
        <IconButton label={editing ? 'Fertig' : 'Bearbeiten'} size="sm" active={editing} onClick={() => setEditing(!editing)}>
          <Pencil className="size-4" />
        </IconButton>
      }
    >
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
        {links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (editing) {
                e.preventDefault()
                setEdit(l)
                setOpen(true)
              }
            }}
            className={cn('flex flex-col items-center gap-1.5 rounded-2xl py-2 transition hover:bg-surface-2 active:scale-95', editing && 'animate-pulse')}
          >
            <QuickIcon icon={l.icon} />
            <span className="w-full truncate px-1 text-center text-xs font-semibold">{l.label}</span>
          </a>
        ))}
        <button onClick={() => { setEdit(null); setOpen(true) }} className="flex flex-col items-center gap-1.5 rounded-2xl py-2 text-muted hover:bg-surface-2">
          <span className="grid size-12 place-items-center rounded-2xl border-2 border-dashed border-line-strong">
            <Plus className="size-5" />
          </span>
          <span className="text-xs font-semibold">Neu</span>
        </button>
      </div>
      {editing && <p className="mt-2 text-xs text-muted">Tippe auf einen Link, um ihn zu bearbeiten.</p>}
      <QuickLinkEditor open={open} link={edit} onClose={() => setOpen(false)} />
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Verein
export function MatchWidget() {
  const { clubs } = useSettings()
  const club = clubs[0]
  const { derived, matches, resolving, notFound } = useClub(club)
  return (
    <WidgetShell title={club ? club.shortName || club.name : 'Mein Verein'} to="/entdecken/sport">
      {!club ? (
        <EmptyState compact icon="⚽" title="Kein Verein gewählt" action={<Link className="font-semibold text-accent" to="/entdecken/sport">Verein wählen</Link>} />
      ) : notFound ? (
        <p className="text-sm text-muted">„{club.name}“ wurde in den Ligen nicht gefunden.</p>
      ) : matches.error && !matches.data ? (
        <ErrorNote error={matches.error} onRetry={matches.reload} compact />
      ) : resolving || !derived || !club.teamId ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          {derived.live ?? derived.next ? <MatchHero m={(derived.live ?? derived.next)!} teamId={club.teamId} /> : <p className="text-sm text-muted">Kein weiteres Spiel geplant.</p>}
          {derived.last && !derived.live && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              Zuletzt: {derived.last.team1.shortName} {derived.last.matchResults.find((r) => r.resultTypeID === 2)?.pointsTeam1 ?? '–'}:
              {derived.last.matchResults.find((r) => r.resultTypeID === 2)?.pointsTeam2 ?? '–'} {derived.last.team2.shortName}
            </p>
          )}
          <SourceLine className="mt-2" source="OpenLigaDB" href="https://www.openligadb.de" fetchedAt={matches.fetchedAt} stale={matches.stale} />
        </>
      )}
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Watchlist
export function WatchlistWidget() {
  const watch = useData('watchlist')
  const prices = useData('prices')
  const symbols = useMemo(() => watch.map((w) => w.symbol), [watch])
  const q = useQuotes(symbols)
  const notConfigured = q.error && /Kursquelle|FINNHUB/i.test(q.error)
  return (
    <WidgetShell title="Watchlist" to="/entdecken/boerse">
      {watch.length === 0 ? (
        <EmptyState compact icon="📈" title="Noch leer" action={<Link className="font-semibold text-accent" to="/entdecken/boerse">Werte hinzufügen</Link>} />
      ) : (
        <>
          <div className="divide-y divide-line">
            {watch.slice(0, 6).map((w) => {
              const live = q.data?.quotes[w.symbol]
              const m = prices.find((p) => p.id === w.symbol)
              return (
                <div key={w.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{w.name}</p>
                    <p className="text-xs text-muted">{w.symbol}</p>
                  </div>
                  {live ? (
                    <div className="text-right">
                      <p className="font-semibold tabular">{fmtMoney(live.price, live.currency)}</p>
                      {live.changePct != null && <p className={cn('text-xs font-bold tabular', live.changePct >= 0 ? 'text-success' : 'text-danger')}>{fmtPct(live.changePct)}</p>}
                    </div>
                  ) : m ? (
                    <div className="text-right">
                      <p className="font-semibold tabular">{fmtEur(m.price)}</p>
                      <p className="text-[11px] text-faint">manuell</p>
                    </div>
                  ) : (
                    <span className="text-xs text-faint">–</span>
                  )}
                </div>
              )
            })}
          </div>
          {notConfigured ? (
            <p className="mt-2 text-[11px] text-faint">Keine Live-Kursquelle verbunden – Kurse manuell gepflegt.</p>
          ) : q.error ? (
            <p className="mt-2 text-[11px] text-warn">{q.error}</p>
          ) : (
            q.fetchedAt && <SourceLine className="mt-2" source="Finnhub" fetchedAt={q.fetchedAt} stale={q.stale} />
          )}
        </>
      )}
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- News
export function NewsWidget() {
  const interests = useApp((s) => s.settings.interests)
  const saved = useData('savedArticles')
  const news = useNews(interests)
  const savedLinks = new Set(saved.map((s) => s.link))
  return (
    <WidgetShell title="Nachrichten" to="/entdecken/news">
      {interests.length === 0 ? (
        <EmptyState compact title="Keine Interessen gewählt" action={<Link to="/profil" className="font-semibold text-accent">Interessen wählen</Link>} />
      ) : !news.data && news.loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !news.data && news.error ? (
        <NewsUnavailable error={news.error} onRetry={news.reload} />
      ) : news.data ? (
        <>
          <div className="divide-y divide-line">
            {news.data.items.slice(0, 5).map((i) => (
              <NewsCard key={i.id} item={i} saved={savedLinks.has(i.link)} compact />
            ))}
          </div>
          <SourceLine className="mt-2" source="öffentliche RSS-Feeds" fetchedAt={news.fetchedAt} stale={news.stale} loading={news.loading} onReload={news.reload} />
        </>
      ) : null}
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Gewohnheiten
export function HabitsWidget() {
  const habits = useData('habits').filter((h) => !h.archived)
  const today = todayKey()
  const done = habits.filter((h) => h.days.includes(today)).length
  return (
    <WidgetShell title="Gewohnheiten" to="/planen/gewohnheiten" action={habits.length > 0 && <span className="text-xs font-semibold text-muted tabular">{done}/{habits.length}</span>}>
      {habits.length === 0 ? (
        <EmptyState compact icon="🌱" title="Keine Gewohnheiten" action={<Link to="/planen/gewohnheiten" className="font-semibold text-accent">Anlegen</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {habits.slice(0, 6).map((h) => {
            const on = h.days.includes(today)
            const s = streak(h)
            return (
              <button
                key={h.id}
                onClick={() => toggleHabitDay(h)}
                aria-pressed={on}
                className={cn('flex min-h-14 items-center gap-2 rounded-2xl border p-2.5 text-left transition active:scale-[0.97]', on ? 'border-transparent bg-success/12' : 'border-line hover:bg-surface-2')}
              >
                <span className="text-xl">{h.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{h.name}</span>
                  <span className={cn('inline-flex items-center gap-0.5 text-xs', s ? 'text-warn' : 'text-faint')}>
                    <Flame className="size-3" />
                    {s}
                  </span>
                </span>
                <span className={cn('grid size-6 place-items-center rounded-full', on ? 'animate-pop bg-success text-white' : 'border-2 border-line-strong')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
              </button>
            )
          })}
        </div>
      )}
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Fokus
export function FocusWidget() {
  const t = useTimerTick()
  const settings = useSettings()
  const sessions = useData('focusSessions')
  const todayMin = sessions.filter((s) => s.startedAt.slice(0, 10) === todayKey()).reduce((a, s) => a + s.minutes, 0)
  const mm = String(Math.floor(t.left / 60)).padStart(2, '0')
  const ss = String(t.left % 60).padStart(2, '0')
  const total = (t.phase === 'work' ? settings.focus.work : t.phase === 'short' ? settings.focus.short : settings.focus.long) * 60
  return (
    <WidgetShell title="Fokus" to="/planen/fokus">
      <div className="flex items-center gap-4">
        <div>
          <p className="font-display text-4xl font-bold tabular">
            {mm}:{ss}
          </p>
          <p className="text-xs text-muted">
            {t.phase === 'work' ? 'Fokus' : 'Pause'} · heute {todayMin} min
          </p>
        </div>
        <div className="ml-auto">
          {t.running ? (
            <Button variant="secondary" icon={<Pause className="size-4" />} onClick={() => t.set({ running: false, endsAt: null, remaining: t.left })}>
              Pause
            </Button>
          ) : (
            <Button variant="primary" icon={<Play className="size-4" />} onClick={() => t.set({ running: true, endsAt: Date.now() + t.left * 1000 })}>
              {t.left < total ? 'Weiter' : 'Start'}
            </Button>
          )}
        </div>
      </div>
      <ProgressBar value={1 - t.left / total} className="mt-3" />
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Zufallsidee
export function IdeaWidget() {
  const collections = useData('collections')
  const items = useData('items')
  const withItems = collections.filter((c) => items.some((i) => i.collectionId === c.id))
  const [cid, setCid] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const col = withItems.find((c) => c.id === cid) ?? withItems[0]
  return (
    <WidgetShell title="Zufallsidee" to="/sammlungen">
      {withItems.length === 0 ? (
        <EmptyState compact icon="🎲" title="Sammlungen sind leer" text="Speichere Rezepte, Ausflüge oder Restaurants – dann schlägt Dailybase dir etwas vor." action={<Link to="/sammlungen" className="font-semibold text-accent">Zu den Sammlungen</Link>} />
      ) : (
        <>
          <div className="scroll-x -mx-1 mb-3 flex gap-1.5 px-1">
            {withItems.map((c) => (
              <button key={c.id} onClick={() => setCid(c.id)} className={cn('min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold', c.id === col?.id ? 'bg-text text-bg' : 'bg-surface-2 text-muted')}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
          <Button variant="soft" className="w-full" size="lg" icon={<Shuffle className="size-4" />} onClick={() => setOpen(true)}>
            {col?.randomLabel || 'Zufällige Idee'}
          </Button>
          <p className="mt-2 text-center text-xs text-faint">{items.filter((i) => i.collectionId === col?.id).length} Ideen in dieser Sammlung</p>
          {col && <RandomPick open={open} collection={col} items={items.filter((i) => i.collectionId === col.id)} onClose={() => setOpen(false)} />}
        </>
      )}
    </WidgetShell>
  )
}

// ---------------------------------------------------------------- Budget
export function BudgetWidget() {
  const expenses = useData('expenses')
  const budget = useApp((s) => s.settings.monthlyBudget)
  const s = monthStats(expenses, todayKey().slice(0, 7))
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const left = budget - s.spent
  const perDay = left / Math.max(1, daysInMonth - new Date().getDate() + 1)
  return (
    <WidgetShell title="Budget" to="/planen/finanzen">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-3xl font-bold tabular">{fmtEur(s.spent, true)}</p>
          <p className="text-xs text-muted">ausgegeben im {new Date().toLocaleDateString('de-DE', { month: 'long' })}</p>
        </div>
        {budget > 0 && (
          <div className="text-right text-sm">
            <p className={cn('font-semibold tabular', left < 0 ? 'text-danger' : '')}>{fmtEur(left, true)} übrig</p>
            {left > 0 && <p className="text-xs text-muted">≈ {fmtEur(perDay, true)} pro Tag</p>}
          </div>
        )}
      </div>
      {budget > 0 && <ProgressBar className="mt-3" value={s.spent / budget} tone={s.spent > budget ? 'danger' : s.spent > budget * 0.8 ? 'warn' : 'success'} />}
      <Button variant="ghost" size="sm" className="mt-3 w-full" icon={<Plus className="size-4" />} onClick={() => window.dispatchEvent(new CustomEvent('db:quickadd', { detail: 'expense' }))}>
        Ausgabe erfassen
      </Button>
    </WidgetShell>
  )
}

export const WIDGETS: Record<WidgetId, (p: { view: ViewId }) => ReactNode> = {
  tasks: ({ view }) => <TasksWidget view={view} />,
  agenda: () => <AgendaWidget />,
  weather: () => <WeatherWidget />,
  quicklinks: () => <QuickLinksWidget />,
  match: () => <MatchWidget />,
  watchlist: () => <WatchlistWidget />,
  news: () => <NewsWidget />,
  habits: () => <HabitsWidget />,
  focus: () => <FocusWidget />,
  idea: () => <IdeaWidget />,
  budget: () => <BudgetWidget />,
}

