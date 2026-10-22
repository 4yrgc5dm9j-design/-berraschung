import { NavLink, Navigate, useParams } from 'react-router-dom'
import { Bot, Briefcase, CandlestickChart, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { cn } from '@/lib/utils'
import { TradingTerminal } from './TradingTerminal'
import { Assistant } from './Assistant'
import { CareerView } from './CareerView'
import { FootballView } from './football/FootballView'

const TABS = [
  { id: 'boerse', label: 'Börsenspiel', icon: CandlestickChart, el: () => <TradingTerminal /> },
  { id: 'assistent', label: 'Börsen-Assistent', icon: Bot, el: () => <Assistant /> },
  { id: 'karriere', label: 'Karriere-Simulator', icon: Briefcase, el: () => <CareerView /> },
  { id: 'fussball', label: 'Fußballmanager', icon: Trophy, el: () => <FootballView /> },
]

export default function PlayPage() {
  const { tab } = useParams()
  const current = TABS.find((t) => t.id === tab)
  if (!current) return <Navigate to="/spielen/boerse" replace />
  return (
    <div>
      <PageHeader title="Spielen" subtitle="Ausprobieren ohne Risiko: Börse, Karriere und Fußball." />
      <nav className="scroll-x -mx-1 mb-5 flex gap-2 px-1" aria-label="Spielen-Bereiche">
        {TABS.map((t) => (
          <NavLink
            key={t.id}
            to={`/spielen/${t.id}`}
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition',
                isActive ? 'border-transparent bg-accent text-accent-fg shadow-md shadow-accent/25' : 'border-line bg-surface text-muted hover:text-text',
              )
            }
          >
            <t.icon className="size-4" />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div key={current.id} className="animate-rise">
        {current.el()}
      </div>
    </div>
  )
}
