import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bookmark, BookmarkCheck, ExternalLink, Search, Sparkles, ServerOff } from 'lucide-react'
import { Badge, Card, Chip, EmptyState, ErrorNote, Skeleton, SourceLine } from '@/components/ui'
import { actions, useApp, useData } from '@/data/store'
import type { NewsTopic } from '@/data/types'
import { cn, matches } from '@/lib/utils'
import { timeAgo } from '@/lib/dates'
import { useNews } from '@/services/hooks'
import { STATIC_HOSTING, type NewsItem } from '@/services/server'

export const TOPICS: { id: NewsTopic; label: string; emoji: string }[] = [
  { id: 'wirtschaft', label: 'Wirtschaft', emoji: '💼' },
  { id: 'finanzen', label: 'Börse & Finanzen', emoji: '📈' },
  { id: 'technologie', label: 'Technologie', emoji: '💻' },
  { id: 'politik', label: 'Politik', emoji: '🏛️' },
  { id: 'sport', label: 'Sport', emoji: '⚽' },
  { id: 'wissen', label: 'Wissen', emoji: '🔬' },
]
export const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id

export function toggleSaved(a: NewsItem | { id: string; title: string; link: string; source: string; publishedAt: string | null; topic: string; summary: string }) {
  const saved = actions().data.savedArticles
  const existing = saved.find((s) => s.link === a.link)
  if (existing) actions().remove('savedArticles', existing.id, 'Artikel entfernt')
  else actions().add('savedArticles', { title: a.title, link: a.link, source: a.source, publishedAt: a.publishedAt, topic: a.topic, summary: a.summary })
}

export function NewsCard({ item, saved, compact }: { item: NewsItem; saved: boolean; compact?: boolean }) {
  return (
    <article className={cn('group flex gap-3', compact ? 'py-2.5' : 'card p-4')}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="font-bold text-text">{item.source}</span>
          <span>{item.publishedAt ? timeAgo(item.publishedAt) : 'ohne Datum'}</span>
          {!compact && <span className="text-faint">· {topicLabel(item.topic)}</span>}
        </div>
        <a href={item.link} target="_blank" rel="noreferrer" className="block">
          <h3 className={cn('font-semibold leading-snug group-hover:text-accent', compact ? 'line-clamp-2 text-[15px]' : 'text-[17px]')}>{item.title}</h3>
          {!compact && item.summary && <p className="mt-1 line-clamp-3 text-sm text-muted">{item.summary}</p>}
        </a>
        {!compact && (
          <div className="mt-3 flex items-center gap-1">
            <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-soft">
              Zum Artikel <ExternalLink className="size-3.5" />
            </a>
            <button onClick={() => toggleSaved(item)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-2">
              {saved ? <BookmarkCheck className="size-4 text-accent" /> : <Bookmark className="size-4" />}
              {saved ? 'Gespeichert' : 'Später lesen'}
            </button>
            <button disabled className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-faint" title="KI-Zusammenfassungen sind geplant">
              <Sparkles className="size-4" /> KI-Zusammenfassung <Badge tone="planned">Geplant</Badge>
            </button>
          </div>
        )}
      </div>
      {item.image && !compact && <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden size-28 shrink-0 rounded-xl object-cover sm:block" />}
      {compact && (
        <button onClick={() => toggleSaved(item)} aria-label={saved ? 'Gespeichert' : 'Später lesen'} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2">
          {saved ? <BookmarkCheck className="size-4 text-accent" /> : <Bookmark className="size-4" />}
        </button>
      )}
    </article>
  )
}

export function NewsUnavailable({ error, onRetry }: { error: string; onRetry: () => void }) {
  if (/Server/i.test(error))
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <ServerOff className="mt-0.5 size-4 shrink-0 text-muted" />
        <div>
          <p className="font-semibold">{STATIC_HOSTING ? 'News gerade nicht verfügbar' : 'News brauchen den Dailybase-Server'}</p>
          <p className="text-muted">
            {STATIC_HOSTING
              ? 'Die Nachrichtendatei der Web-Version ist gerade nicht erreichbar. Sie wird alle 30 Minuten automatisch erneuert.'
              : 'Die Feeds werden über den eigenen Server geladen (Browser dürfen sie nicht direkt abrufen). Starte die App mit „npm run dev“ bzw. „npm start“.'}
          </p>
        </div>
      </div>
    )
  return <ErrorNote error={error} onRetry={onRetry} />
}

export function NewsView() {
  const interests = useApp((s) => s.settings.interests)
  const savedList = useData('savedArticles')
  const [params, setParams] = useSearchParams()
  const showSaved = params.get('gespeichert') === '1'
  const [topic, setTopic] = useState<NewsTopic | 'alle'>('alle')
  const [q, setQ] = useState('')
  const [source, setSource] = useState<string | null>(null)
  const topics = interests.length ? interests : (['wirtschaft'] as NewsTopic[])
  const news = useNews(topics)

  const items = useMemo(() => {
    const all = news.data?.items ?? []
    return all
      .filter((i) => (topic === 'alle' ? true : i.topic === topic))
      .filter((i) => (source ? i.source === source : true))
      .filter((i) => matches(q, i.title, i.summary))
  }, [news.data, topic, source, q])
  const sources = useMemo(() => [...new Set((news.data?.items ?? []).map((i) => i.source))], [news.data])
  const savedLinks = new Set(savedList.map((s) => s.link))

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artikel durchsuchen" aria-label="Artikel durchsuchen" />
        </div>
        <div className="flex gap-2">
          <Chip active={!showSaved} onClick={() => setParams({})}>
            Aktuell
          </Chip>
          <Chip active={showSaved} onClick={() => setParams({ gespeichert: '1' })}>
            <Bookmark className="size-3.5" /> Gespeichert ({savedList.length})
          </Chip>
        </div>
      </div>

      {showSaved ? (
        savedList.length === 0 ? (
          <Card>
            <EmptyState icon="🔖" title="Nichts gespeichert" text="Tippe bei einem Artikel auf „Später lesen“." />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {[...savedList]
              .filter((s) => matches(q, s.title, s.summary))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((s) => (
                <NewsCard key={s.id} item={{ ...s, id: s.link, image: null }} saved />
              ))}
          </div>
        )
      ) : (
        <>
          <div className="scroll-x -mx-1 mb-2 flex gap-2 px-1">
            <Chip active={topic === 'alle'} onClick={() => setTopic('alle')}>
              Alle Interessen
            </Chip>
            {TOPICS.filter((t) => topics.includes(t.id)).map((t) => (
              <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(t.id)}>
                {t.emoji} {t.label}
              </Chip>
            ))}
          </div>
          {sources.length > 1 && (
            <div className="scroll-x -mx-1 mb-4 flex gap-2 px-1">
              {sources.map((s) => (
                <button key={s} onClick={() => setSource(source === s ? null : s)} className={cn('min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-bold', source === s ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2')}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {news.error && <div className="mb-4">{news.data ? <SourceLine source="öffentliche RSS-Feeds" fetchedAt={news.data.fetchedAt} stale onReload={news.reload} /> : <NewsUnavailable error={news.error} onRetry={news.reload} />}</div>}
          {!news.data && news.loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="space-y-2 p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </Card>
              ))}
            </div>
          ) : news.data ? (
            <>
              {!news.error && (
                <SourceLine
                  className="mb-3"
                  source={`öffentliche RSS-Feeds (${sources.join(', ')})`}
                  fetchedAt={news.data.fetchedAt}
                  loading={news.loading}
                  onReload={news.reload}
                />
              )}
              {news.data.errors.length > 0 && <p className="mb-3 text-xs text-warn">Nicht erreichbar: {[...new Set(news.data.errors.map((e) => e.source))].join(', ')}</p>}
              {items.length === 0 ? (
                <Card>
                  <EmptyState compact title="Keine Artikel" text="Filter ändern oder Suchbegriff anpassen." />
                </Card>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {items.slice(0, 60).map((i) => (
                    <NewsCard key={i.id} item={i} saved={savedLinks.has(i.link)} />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
