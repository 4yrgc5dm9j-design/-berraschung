import { useMemo, useState } from 'react'
import { BriefcaseBusiness, ChevronDown, ChevronUp, GraduationCap, PartyPopper, Settings2, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, IconButton, Modal, Segmented } from '@/components/ui'
import { openSearch, openQuickAdd } from '@/components/layout/AppShell'
import { actions, useApp, useData, useSettings } from '@/data/store'
import { defaultDashboard } from '@/data/defaults'
import type { ModuleId, ViewId, WidgetId } from '@/data/types'
import { cn, moveInArray } from '@/lib/utils'
import { greeting, todayKey } from '@/lib/dates'
import { upcomingEvents } from '@/features/plan/calendar'
import { useWeather } from '@/services/hooks'
import { weatherInfo } from '@/services/weather'
import { WIDGETS, widgetMeta } from './widgets'
import { Search, Plus } from 'lucide-react'

export const VIEWS: { value: ViewId; label: string; icon: React.ReactNode }[] = [
  { value: 'arbeit', label: 'Arbeit', icon: <BriefcaseBusiness className="size-4" /> },
  { value: 'uni', label: 'Uni', icon: <GraduationCap className="size-4" /> },
  { value: 'freizeit', label: 'Freizeit', icon: <PartyPopper className="size-4" /> },
]

/** Widgets, die zu einem abschaltbaren Modul gehören */
export const widgetModule: Partial<Record<WidgetId, ModuleId>> = {
  news: 'news',
  watchlist: 'markets',
  match: 'sport',
  habits: 'habits',
  focus: 'focus',
  budget: 'finance',
}

function DaySummary() {
  const tasks = useData('tasks')
  const events = useData('events')
  const w = useWeather()
  const { weather } = useSettings()
  const today = todayKey()
  const dueToday = tasks.filter((t) => !t.done && t.due && t.due <= today).length
  const todayEvents = upcomingEvents(events, 0).length
  const nextExam = upcomingEvents(events.filter((e) => e.kind === 'pruefung'), 30)[0]
  const tile = 'flex min-w-0 flex-col rounded-2xl bg-white/16 px-3 py-2.5 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/24 active:scale-[0.98]'
  const info = w.data ? weatherInfo(w.data.current.code, w.data.current.isDay) : null
  const examDays = nextExam ? Math.round((new Date(nextExam.date).getTime() - new Date(today).getTime()) / 86400000) : 0
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Link to="/planen/aufgaben" className={tile} title="Heute fällige und überfällige Aufgaben">
          <span className="font-display text-2xl font-bold leading-none tabular">{dueToday}</span>
          <span className="mt-1 truncate text-xs font-semibold text-white/80">{dueToday === 1 ? 'Aufgabe' : 'Aufgaben'}</span>
        </Link>
        <Link to="/planen/kalender" className={tile} title="Termine heute">
          <span className="font-display text-2xl font-bold leading-none tabular">{todayEvents}</span>
          <span className="mt-1 truncate text-xs font-semibold text-white/80">{todayEvents === 1 ? 'Termin' : 'Termine'}</span>
        </Link>
        <Link to="/profil" className={tile}>
          <span className="font-display text-2xl font-bold leading-none tabular">
            {w.data ? `${Math.round(w.data.current.temp)}°` : '–'} <span className="text-lg">{info?.emoji}</span>
          </span>
          <span className="mt-1 truncate text-xs font-semibold text-white/80">{weather?.name ?? 'Wetter'}</span>
        </Link>
      </div>
      {nextExam && (
        <Link to="/planen/kalender" className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[var(--accent-strong)] shadow-sm">
          🎓 <span className="min-w-0 flex-1 truncate">Prüfung „{nextExam.event.title}“</span>
          <span className="shrink-0">{examDays === 0 ? 'heute' : `in ${examDays} ${examDays === 1 ? 'Tag' : 'Tagen'}`}</span>
        </Link>
      )}
    </div>
  )
}

function Customize({ open, view, onClose }: { open: boolean; view: ViewId; onClose: () => void }) {
  const settings = useSettings()
  const list = settings.dashboard[view]
  const setList = (next: typeof list) => actions().setSettings({ dashboard: { ...settings.dashboard, [view]: next } })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Startseite „${VIEWS.find((v) => v.value === view)?.label}“ anpassen`}
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => setList(defaultDashboard()[view])}>
            Standard
          </Button>
          <Button variant="primary" onClick={onClose}>
            Fertig
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">Widgets ein- oder ausblenden und mit den Pfeilen sortieren. Jede Ansicht hat ihre eigene Anordnung.</p>
      <div className="space-y-1.5">
        {list.map((w, i) => {
          const mod = widgetModule[w.id]
          const disabled = mod ? !settings.modules[mod] : false
          return (
            <div key={w.id} className={cn('flex items-center gap-2 rounded-2xl border border-line p-2 pl-3', !w.visible && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{widgetMeta[w.id].title}</p>
                <p className="truncate text-xs text-muted">{disabled ? 'Modul ist ausgeblendet (Profil → Module)' : widgetMeta[w.id].description}</p>
              </div>
              <IconButton label="Nach oben" size="sm" disabled={i === 0} onClick={() => setList(moveInArray(list, i, i - 1))}>
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton label="Nach unten" size="sm" disabled={i === list.length - 1} onClick={() => setList(moveInArray(list, i, i + 1))}>
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label={w.visible ? 'Ausblenden' : 'Einblenden'}
                size="sm"
                active={w.visible}
                onClick={() => setList(list.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)))}
              >
                {w.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </IconButton>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// Widgets liegen in einem Raster: nebeneinander, pro Reihe oben bündig und gleich hoch;
// was nicht mehr passt, rutscht in die nächste Reihe (keine Zeitungsspalten mit Lücken).
export default function TodayPage() {
  const settings = useSettings()
  const name = useApp((s) => s.settings.name)
  const [customize, setCustomize] = useState(false)
  const view = settings.activeView
  const widgets = useMemo(
    () => settings.dashboard[view].filter((w) => w.visible && (!widgetModule[w.id] || settings.modules[widgetModule[w.id]!])),
    [settings.dashboard, settings.modules, view],
  )
  const now = new Date()

  return (
    <div>
      <header className="pb-5 pt-4 lg:pt-8">
        <section className="hero-gradient relative animate-rise overflow-hidden rounded-[30px] p-5 text-white shadow-[0_20px_50px_-20px_var(--accent)] sm:p-7">
          {/* dezente Lichtkreise */}
          <span className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/12 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-white/8 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize text-white/80">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <h1 className="mt-1 font-display text-[30px] font-bold leading-[1.05] tracking-tight sm:text-[44px]">
                {greeting(now)}
                {name ? `, ${name}` : ''} 👋
              </h1>
            </div>
            <div className="flex shrink-0 gap-1.5 self-start lg:hidden">
              <button aria-label="Suchen" onClick={openSearch} className="grid size-10 place-items-center rounded-full bg-white/18 ring-1 ring-white/20 backdrop-blur-md active:scale-95">
                <Search className="size-[18px]" />
              </button>
              <button aria-label="Schnell erfassen" onClick={() => openQuickAdd()} className="grid size-10 place-items-center rounded-full bg-white text-[var(--accent-strong)] shadow-lg active:scale-95">
                <Plus className="size-5" strokeWidth={2.6} />
              </button>
            </div>
          </div>
          <div className="relative mt-5 sm:max-w-xl">
            <DaySummary />
          </div>
        </section>
        <div className="mt-4 flex items-center gap-2">
          <Segmented className="min-w-0 flex-1 sm:flex-none sm:shrink-0" value={view} onChange={(v) => actions().setSettings({ activeView: v })} options={VIEWS} />
          <IconButton label="Startseite anpassen" onClick={() => setCustomize(true)} className="ml-auto size-12 rounded-2xl border border-line bg-surface shadow-sm">
            <Settings2 className="size-5" />
          </IconButton>
        </div>
      </header>

      {widgets.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-display text-lg font-semibold">Diese Ansicht ist leer</p>
          <p className="mt-1 text-muted">Blende Widgets ein, um deine Startseite zu gestalten.</p>
          <Button variant="primary" className="mt-4" onClick={() => setCustomize(true)}>
            Widgets wählen
          </Button>
        </div>
      ) : (
        <div key={view} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w, i) => (
            <div key={w.id} className="flex min-w-0 animate-rise flex-col [&>section]:flex-1" style={{ animationDelay: `${i * 40}ms` }}>
              {WIDGETS[w.id]({ view })}
            </div>
          ))}
        </div>
      )}
      <Customize open={customize} view={view} onClose={() => setCustomize(false)} />
    </div>
  )
}
