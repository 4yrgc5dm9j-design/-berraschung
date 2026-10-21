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
  const parts: React.ReactNode[] = []
  parts.push(
    <Link key="t" to="/planen/aufgaben" className="hover:text-text">
      <b className="text-text">{dueToday}</b> {dueToday === 1 ? 'Aufgabe' : 'Aufgaben'} fällig
    </Link>,
  )
  parts.push(
    <Link key="e" to="/planen/kalender" className="hover:text-text">
      <b className="text-text">{todayEvents}</b> {todayEvents === 1 ? 'Termin' : 'Termine'} heute
    </Link>,
  )
  if (w.data && weather)
    parts.push(
      <span key="w">
        {weatherInfo(w.data.current.code, w.data.current.isDay).emoji} <b className="text-text">{Math.round(w.data.current.temp)}°</b> in {weather.name}
      </span>,
    )
  if (nextExam) {
    const days = Math.round((new Date(nextExam.date).getTime() - new Date(today).getTime()) / 86400000)
    parts.push(
      <span key="x" className="text-danger">
        Prüfung „{nextExam.event.title}“ {days === 0 ? 'heute' : `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`}
      </span>,
    )
  }
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-muted">{parts}</div>
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
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-6 lg:pt-10">
        <div className="min-w-0 animate-rise">
          <p className="text-sm font-semibold capitalize text-muted">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-[1.05] tracking-tight sm:text-[46px]">
            {greeting(now)}
            {name ? `, ${name}` : ''}
            <span className="text-accent">.</span>
          </h1>
          <div className="mt-3">
            <DaySummary />
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          <Segmented className="min-w-0 flex-1 sm:flex-none sm:shrink-0" value={view} onChange={(v) => actions().setSettings({ activeView: v })} options={VIEWS} />
          <IconButton label="Startseite anpassen" onClick={() => setCustomize(true)} className="border border-line bg-surface">
            <Settings2 className="size-5" />
          </IconButton>
          <IconButton label="Suchen" onClick={openSearch} className="border border-line bg-surface lg:hidden">
            <Search className="size-5" />
          </IconButton>
          <button aria-label="Schnell erfassen" onClick={() => openQuickAdd()} className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg shadow-md shadow-accent/25 active:scale-95 lg:hidden">
            <Plus className="size-5" />
          </button>
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
        <div key={view} className="gap-4 md:columns-2 xl:columns-3">
          {widgets.map((w, i) => (
            <div key={w.id} className="mb-4 min-w-0 animate-rise break-inside-avoid" style={{ animationDelay: `${i * 40}ms` }}>
              {WIDGETS[w.id]({ view })}
            </div>
          ))}
        </div>
      )}
      <Customize open={customize} view={view} onClose={() => setCustomize(false)} />
    </div>
  )
}
