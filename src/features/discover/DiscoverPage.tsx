import { NavLink, Navigate, useParams } from 'react-router-dom'
import { Newspaper, TrendingUp, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { useSettings } from '@/data/store'
import { cn } from '@/lib/utils'
import { EmptyState, Card } from '@/components/ui'
import { NewsView } from './news'
import { MarketsView } from './markets'
import { SportView } from './sport'

export default function DiscoverPage() {
  const { tab } = useParams()
  const { modules } = useSettings()
  const tabs = [
    { id: 'news', label: 'News', icon: Newspaper, on: modules.news, el: <NewsView /> },
    { id: 'boerse', label: 'Börse', icon: TrendingUp, on: modules.markets, el: <MarketsView /> },
    { id: 'sport', label: 'Sport', icon: Trophy, on: modules.sport, el: <SportView /> },
  ].filter((t) => t.on)
  const current = tabs.find((t) => t.id === tab)
  if (!tabs.length)
    return (
      <div>
        <PageHeader title="Entdecken" />
        <Card>
          <EmptyState title="Alle Module ausgeblendet" text="Aktiviere News, Börse oder Sport unter Profil → Module." />
        </Card>
      </div>
    )
  if (!current) return <Navigate to={`/entdecken/${tabs[0].id}`} replace />
  return (
    <div>
      <PageHeader title="Entdecken" subtitle="Nachrichten, Märkte und dein Verein." />
      <nav className="mb-5 grid grid-cols-3 gap-2 sm:flex" aria-label="Entdecken-Bereiche">
        {tabs.map((t) => (
          <NavLink
            key={t.id}
            to={`/entdecken/${t.id}`}
            className={({ isActive }) =>
              cn(
                'flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-5 font-semibold transition',
                isActive ? 'border-transparent bg-text text-bg' : 'border-line bg-surface text-muted hover:text-text',
              )
            }
          >
            <t.icon className="size-[18px]" />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div key={current.id} className="animate-rise">
        {current.el}
      </div>
    </div>
  )
}
