import { NavLink, Navigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { useSettings } from '@/data/store'
import type { ModuleId } from '@/data/types'
import { cn } from '@/lib/utils'
import { TasksView } from './tasks'
import { CalendarView } from './calendar'
import { NotesView } from './notes'
import { FlashcardsView, FocusView } from './study'
import { FinanceView, HabitsView, ShoppingView } from './life'

export const PLAN_TABS: { id: string; label: string; module?: ModuleId; el: () => React.ReactNode }[] = [
  { id: 'aufgaben', label: 'Aufgaben', el: () => <TasksView /> },
  { id: 'kalender', label: 'Kalender', el: () => <CalendarView /> },
  { id: 'notizen', label: 'Notizen', el: () => <NotesView /> },
  { id: 'lernen', label: 'Lernkarten', module: 'flashcards', el: () => <FlashcardsView /> },
  { id: 'fokus', label: 'Fokus', module: 'focus', el: () => <FocusView /> },
  { id: 'gewohnheiten', label: 'Gewohnheiten', module: 'habits', el: () => <HabitsView /> },
  { id: 'einkauf', label: 'Einkauf', module: 'shopping', el: () => <ShoppingView /> },
  { id: 'finanzen', label: 'Finanzen', module: 'finance', el: () => <FinanceView /> },
]

export default function PlanPage() {
  const { tab } = useParams()
  const settings = useSettings()
  const tabs = PLAN_TABS.filter((t) => !t.module || settings.modules[t.module])
  const current = tabs.find((t) => t.id === tab)
  if (!current) return <Navigate to="/planen/aufgaben" replace />
  return (
    <div>
      <PageHeader title="Planen" subtitle="Alltag, Studium und Finanzen im Griff." />
      <div className="sticky top-0 z-20 -mx-4 mb-5 bg-bg/85 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <nav className="scroll-x flex gap-1.5" aria-label="Planen-Bereiche">
          {tabs.map((t) => (
            <NavLink
              key={t.id}
              to={`/planen/${t.id}`}
              className={({ isActive }) =>
                cn('inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition', isActive ? 'bg-accent text-accent-fg shadow-md shadow-accent/25' : 'text-muted hover:bg-surface-2 hover:text-text')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div key={current.id} className="animate-rise">
        {current.el()}
      </div>
    </div>
  )
}
