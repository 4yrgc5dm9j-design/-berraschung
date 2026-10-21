import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, FileText, Layers, Search, ShoppingCart, BookOpen, Newspaper, Link2 } from 'lucide-react'
import { Modal } from '@/components/ui'
import { useApp } from '@/data/store'
import { matches } from '@/lib/utils'
import { fmtDate } from '@/lib/dates'

interface Hit {
  id: string
  group: string
  title: string
  meta?: string
  icon: React.ReactNode
  to: string
}

/** Globale Suche über Aufgaben, Termine, Notizen, Sammlungen, Lernkarten & mehr. */
export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const data = useApp((s) => s.data)
  const navigate = useNavigate()

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return []
    const res: Hit[] = []
    const ic = 'size-4'
    for (const t of data.tasks)
      if (matches(q, t.title, t.notes, t.category))
        res.push({ id: t.id, group: 'Aufgaben', title: t.title, meta: t.done ? 'Erledigt' : t.due ? `Fällig ${fmtDate(t.due)}` : t.category, icon: <CheckCircle2 className={ic} />, to: `/planen/aufgaben?open=${t.id}` })
    for (const e of data.events)
      if (matches(q, e.title, e.location, e.notes))
        res.push({ id: e.id, group: 'Termine', title: e.title, meta: fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' }), icon: <CalendarDays className={ic} />, to: `/planen/kalender?date=${e.date}&open=${e.id}` })
    for (const n of data.notes)
      if (matches(q, n.title, n.body, n.tags.join(' ')))
        res.push({ id: n.id, group: 'Notizen', title: n.title || 'Ohne Titel', meta: n.body.slice(0, 60), icon: <FileText className={ic} />, to: `/planen/notizen?open=${n.id}` })
    for (const c of data.collections)
      if (matches(q, c.name, c.description)) res.push({ id: c.id, group: 'Sammlungen', title: `${c.emoji} ${c.name}`, icon: <Layers className={ic} />, to: `/sammlungen/${c.id}` })
    for (const i of data.items) {
      const c = data.collections.find((x) => x.id === i.collectionId)
      if (matches(q, i.title, i.note, i.url, i.tags.join(' '), i.preview?.title))
        res.push({ id: i.id, group: 'Gespeichert', title: i.title || i.url, meta: c ? `${c.emoji} ${c.name}` : undefined, icon: <Link2 className={ic} />, to: `/sammlungen/${i.collectionId}?open=${i.id}` })
    }
    for (const card of data.cards)
      if (matches(q, card.front, card.back)) {
        const d = data.decks.find((x) => x.id === card.deckId)
        res.push({ id: card.id, group: 'Lernkarten', title: card.front, meta: d?.name, icon: <BookOpen className={ic} />, to: `/planen/lernen?deck=${card.deckId}` })
      }
    for (const s of data.shoppingItems)
      if (matches(q, s.name)) res.push({ id: s.id, group: 'Einkauf', title: s.name, meta: s.done ? 'Erledigt' : 'Offen', icon: <ShoppingCart className={ic} />, to: `/planen/einkauf?list=${s.listId}` })
    for (const a of data.savedArticles)
      if (matches(q, a.title, a.summary, a.source)) res.push({ id: a.id, group: 'Gespeicherte Artikel', title: a.title, meta: a.source, icon: <Newspaper className={ic} />, to: `/entdecken/news?gespeichert=1` })
    return res.slice(0, 60)
  }, [q, data])

  const groups = useMemo(() => {
    const m = new Map<string, Hit[]>()
    for (const h of hits) m.set(h.group, [...(m.get(h.group) ?? []), h])
    return [...m.entries()]
  }, [hits])

  const go = (to: string) => {
    navigate(to)
    setQ('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Suchen" wide>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-faint" />
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) go(hits[0].to)
          }}
          placeholder="Aufgaben, Notizen, Sammlungen, Termine …"
          className="field pl-10 text-base"
          aria-label="Suchbegriff"
        />
      </div>
      <div className="mt-4 min-h-[200px]">
        {q.trim().length < 2 ? (
          <p className="py-10 text-center text-sm text-muted">Mindestens zwei Zeichen eingeben. Gesucht wird nur in deinen eigenen, lokal gespeicherten Daten.</p>
        ) : hits.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nichts gefunden für „{q}“.</p>
        ) : (
          groups.map(([group, list]) => (
            <div key={group} className="mb-4">
              <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-faint">{group}</p>
              {list.map((h) => (
                <button key={h.group + h.id} onClick={() => go(h.to)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{h.title}</span>
                    {h.meta && <span className="block truncate text-xs text-muted">{h.meta}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
