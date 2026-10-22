import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarCheck, Compass, Gamepad2, House, Layers, Plus, Search, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/data/store'
import { Toaster } from '@/components/ui/Toaster'
import { CommandSearch } from './CommandSearch'
import { QuickAdd } from './QuickAdd'
import { Logo } from './Logo'

export const NAV: { to: string; label: string; short?: string; icon: typeof House; end?: boolean }[] = [
  { to: '/', label: 'Heute', icon: House, end: true },
  { to: '/entdecken', label: 'Entdecken', icon: Compass },
  { to: '/sammlungen', label: 'Sammlungen', short: 'Sammlung', icon: Layers },
  { to: '/planen', label: 'Planen', icon: CalendarCheck },
  { to: '/spielen', label: 'Spielen', icon: Gamepad2 },
  { to: '/profil', label: 'Profil', icon: UserRound },
]

/** Globale Ereignisse, damit Seiten Suche & Schnellerfassung öffnen können. */
export const openSearch = () => window.dispatchEvent(new Event('db:search'))
export const openQuickAdd = (kind?: string) => window.dispatchEvent(new CustomEvent('db:quickadd', { detail: kind }))

export function AppShell() {
  const settings = useSettings()
  const [searchOpen, setSearchOpen] = useState(false)
  const [quick, setQuick] = useState<{ open: boolean; kind?: string }>({ open: false })
  const location = useLocation()

  useEffect(() => {
    const onSearch = () => setSearchOpen(true)
    const onQuick = (e: Event) => setQuick({ open: true, kind: (e as CustomEvent).detail })
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('db:search', onSearch)
    window.addEventListener('db:quickadd', onQuick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('db:search', onSearch)
      window.removeEventListener('db:quickadd', onQuick)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  // Theme & Akzent anwenden
  useEffect(() => {
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.dataset.accent = settings.accent
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0b0e16' : '#f5f7fc'))
    }
    apply()
    try {
      localStorage.setItem('dailybase-theme', settings.theme)
      localStorage.setItem('dailybase-accent', settings.accent)
    } catch {
      /* ignore */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme, settings.accent])

  return (
    <div className="min-h-dvh overflow-x-clip lg:pl-[260px]">
      <Sidebar onSearch={() => setSearchOpen(true)} onAdd={() => setQuick({ open: true })} />
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-[calc(118px+env(safe-area-inset-bottom))] pt-safe sm:px-6 lg:px-10 lg:pb-16">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster />
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickAdd open={quick.open} initialKind={quick.kind} onClose={() => setQuick({ open: false })} />
    </div>
  )
}

function Sidebar({ onSearch, onAdd }: { onSearch: () => void; onAdd: () => void }) {
  return (
    <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-[248px] flex-col rounded-[28px] px-4 py-6 shadow-[var(--shadow)] lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <button
        onClick={onSearch}
        className="mt-7 flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 text-sm text-faint transition hover:text-muted"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Suchen …</span>
        <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd>
      </button>
      <nav className="mt-5 flex flex-col gap-1" aria-label="Hauptnavigation">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                'group flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition',
                isActive ? 'bg-accent text-accent-fg shadow-md shadow-accent/25' : 'text-muted hover:bg-surface-2 hover:text-text',
              )
            }
          >
            <n.icon className="size-5" strokeWidth={2.1} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto">
        <button
          onClick={onAdd}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-accent-fg shadow-lg shadow-accent/20 transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="size-5" />
          Schnell erfassen
        </button>
        <p className="mt-4 px-2 text-xs text-faint">Deine Daten bleiben lokal auf diesem Gerät.</p>
      </div>
    </aside>
  )
}

function BottomNav() {
  // Schwebende Leiste im Stil aktueller iOS-Apps
  return (
    <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="glass mx-auto grid max-w-lg grid-cols-6 rounded-[26px] p-1 shadow-[0_10px_40px_-10px_rgba(16,24,40,0.28)] ring-1 ring-line">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn('flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10px] font-semibold tracking-tight transition', isActive ? 'bg-accent-soft text-accent' : 'text-faint active:bg-surface-2')
            }
          >
            {({ isActive }) => (
              <>
                <n.icon className="size-[21px]" strokeWidth={isActive ? 2.4 : 2} />
                <span className="max-w-full truncate px-0.5">{n.short ?? n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Seitenkopf mit Titel und Aktionen; mobil mit Suche & Schnellerfassung. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-5 pt-6 lg:pt-10">
      <div className="min-w-0 animate-rise">
        {eyebrow && <div className="mb-1 text-sm font-semibold text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-tight sm:text-[40px]">{title}</h1>
        {subtitle && <div className="mt-2 text-muted">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <button aria-label="Suchen" onClick={openSearch} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-2 lg:hidden">
          <Search className="size-5" />
        </button>
        <button
          aria-label="Schnell erfassen"
          onClick={() => openQuickAdd()}
          className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg shadow-md shadow-accent/25 active:scale-95 lg:hidden"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </header>
  )
}
