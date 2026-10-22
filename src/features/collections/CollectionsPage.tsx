import { useEffect, useMemo, useState, useLayoutEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Heart, Pencil, Plus, Search, Shuffle, Star, Users, Check, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, Field, IconButton, Modal, PlannedBadge, Stars } from '@/components/ui'
import { SourceIcon, sourceColor } from '@/components/ui/LinkIcon'
import { PageHeader } from '@/components/layout/AppShell'
import { actions, useData } from '@/data/store'
import type { Collection, CollectionItem, LinkSource } from '@/data/types'
import { cn, matches, pickRandom } from '@/lib/utils'
import { hostOf, sourceLabel } from '@/lib/links'
import { timeAgo } from '@/lib/dates'
import { ItemEditor } from './ItemEditor'
import { InstagramInfo } from './InstagramInfo'

const palette = ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#64748b']
const emojis = ['🍝', '🍽️', '✈️', '🚲', '🎁', '🎬', '📚', '👕', '🛍️', '🎧', '🏋️', '🏡', '🎨', '💡', '📍', '🍷', '☕', '🎮', '📸', '🧠']

export function openItem(item: CollectionItem) {
  if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer')
}

export function ItemCard({ item, onEdit, showCollection }: { item: CollectionItem; onEdit: () => void; showCollection?: Collection }) {
  const img = item.image ?? item.preview?.image
  return (
    <article className="card group relative flex flex-col overflow-hidden">
      <button onClick={onEdit} className="text-left" aria-label={`${item.title} bearbeiten`}>
        {img ? (
          <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
            <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          </div>
        ) : item.kind === 'link' ? (
          <div className="relative grid aspect-[4/3] place-items-center overflow-hidden" style={{ background: `color-mix(in oklab, ${sourceColor[item.source]} 14%, var(--surface-2))` }}>
            <SourceIcon source={item.source} className="size-10 opacity-80" />
            <span className="absolute bottom-3 left-3 right-3 truncate text-center text-xs font-semibold text-muted">{hostOf(item.url)}</span>
          </div>
        ) : null}
        <div className="p-3.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
            {item.kind === 'link' && (
              <span className="inline-flex items-center gap-1" style={{ color: item.source === 'web' ? undefined : sourceColor[item.source] }}>
                <SourceIcon source={item.source} className="size-3.5" /> {sourceLabel[item.source]}
              </span>
            )}
            {item.kind === 'note' && <span>Notiz</span>}
            {item.kind === 'image' && <span>Bild</span>}
            {showCollection && (
              <span className="truncate">
                · {showCollection.emoji} {showCollection.name}
              </span>
            )}
          </div>
          <h3 className={cn('line-clamp-2 font-semibold leading-snug', item.done && 'text-muted')}>{item.title || 'Ohne Titel'}</h3>
          {item.note && <p className="mt-1 line-clamp-3 text-sm text-muted">{item.note}</p>}
          {(item.rating > 0 || item.tags.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.rating > 0 && <Stars value={item.rating} size="sm" />}
              {item.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
      <div className="mt-auto flex items-center gap-1 border-t border-line px-2 py-1.5">
        <IconButton label={item.favorite ? 'Kein Favorit mehr' : 'Als Favorit markieren'} size="sm" active={item.favorite} onClick={() => actions().update('items', item.id, { favorite: !item.favorite })}>
          <Heart className={cn('size-4', item.favorite && 'fill-current')} />
        </IconButton>
        <IconButton label={item.done ? 'Als offen markieren' : 'Als ausprobiert markieren'} size="sm" active={item.done} onClick={() => actions().update('items', item.id, { done: !item.done })}>
          <Check className="size-4" />
        </IconButton>
        <span className="ml-1 truncate text-xs text-faint">{timeAgo(item.createdAt)}</span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-soft">
            {item.source === 'instagram' ? 'In Instagram öffnen' : 'Öffnen'}
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </article>
  )
}

export function CollectionEditor({ open, collection, onClose }: { open: boolean; collection?: Collection | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💡')
  const [color, setColor] = useState(palette[0])
  const [description, setDescription] = useState('')
  const [randomLabel, setRandomLabel] = useState('')
  const [confirm, setConfirm] = useState(false)
  const navigate = useNavigate()
  const count = useData('items').filter((i) => i.collectionId === collection?.id).length

  useLayoutEffect(() => {
    if (!open) return
    setName(collection?.name ?? '')
    setEmoji(collection?.emoji ?? '💡')
    setColor(collection?.color ?? pickRandom(palette)!)
    setDescription(collection?.description ?? '')
    setRandomLabel(collection?.randomLabel ?? '')
  }, [open, collection])

  const save = () => {
    if (!name.trim()) return
    const v = { name: name.trim(), emoji, color, description, randomLabel: randomLabel.trim() || 'Zufällige Idee' }
    if (collection) actions().update('collections', collection.id, v)
    else {
      const c = actions().add('collections', { ...v, shared: false })
      navigate(`/sammlungen/${c.id}`)
    }
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={collection ? 'Sammlung bearbeiten' : 'Neue Sammlung'}
        footer={
          <>
            {collection && (
              <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                Löschen
              </Button>
            )}
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Outfits, Podcasts, Bars" />
          </Field>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Symbol</span>
            <div className="flex flex-wrap gap-1.5">
              {emojis.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={cn('grid size-11 place-items-center rounded-xl text-xl', emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Farbe</span>
            <div className="flex flex-wrap gap-2">
              {palette.map((c) => (
                <button key={c} aria-label={`Farbe ${c}`} onClick={() => setColor(c)} className={cn('size-9 rounded-full border-2', color === c ? 'border-text' : 'border-transparent')} style={{ background: c }} />
              ))}
            </div>
          </div>
          <Field label="Beschreibung">
            <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
          </Field>
          <Field label="Frage für den Zufallsgenerator" hint="z. B. „Was kochen wir heute?“">
            <input className="field" value={randomLabel} onChange={(e) => setRandomLabel(e.target.value)} placeholder="Zufällige Idee" />
          </Field>
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-line-strong p-3 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <Users className="size-4" /> Mit Freunden teilen
            </span>
            <PlannedBadge label="Kommt mit Konten" />
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Sammlung löschen?"
        message={`„${collection?.name}“ und ${count} Einträge werden gelöscht. Direkt danach kannst du das rückgängig machen.`}
        onConfirm={() => {
          if (collection) actions().remove('collections', collection.id, 'Sammlung gelöscht')
          onClose()
          navigate('/sammlungen')
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

export function RandomPick({ collection, items, open, onClose }: { collection: Collection; items: CollectionItem[]; open: boolean; onClose: () => void }) {
  const [pick, setPick] = useState<CollectionItem | null>(null)
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const pool = onlyOpen ? items.filter((i) => !i.done) : items

  const roll = () => {
    if (!pool.length) return setPick(null)
    setSpinning(true)
    let n = 0
    const iv = setInterval(() => {
      setPick(pickRandom(pool)!)
      if (++n > 8) {
        clearInterval(iv)
        setSpinning(false)
      }
    }, 70)
  }
  useEffect(() => {
    if (open) roll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onlyOpen])

  return (
    <Modal open={open} onClose={onClose} title={collection.randomLabel || 'Zufällige Idee'}>
      {pool.length === 0 ? (
        <EmptyState compact icon="🎲" title="Nichts zum Auswählen" text="Füge erst ein paar Einträge hinzu." />
      ) : (
        pick && (
          <div className="text-center">
            <div className={cn('card mx-auto max-w-sm overflow-hidden text-left transition', spinning ? 'scale-95 opacity-70' : 'animate-pop')}>
              {(pick.image || pick.preview?.image) && <img src={pick.image ?? pick.preview?.image} alt="" className="aspect-video w-full object-cover" referrerPolicy="no-referrer" />}
              <div className="p-4">
                <p className="font-display text-xl font-semibold">{pick.title}</p>
                {pick.note && <p className="mt-1 text-sm text-muted">{pick.note}</p>}
              </div>
            </div>
            <label className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Nur noch nicht Ausprobiertes
            </label>
            <div className="mt-4 flex justify-center gap-2">
              <Button icon={<Shuffle className="size-4" />} onClick={roll}>
                Nochmal
              </Button>
              {pick.url && (
                <Button variant="primary" icon={<ExternalLink className="size-4" />} onClick={() => openItem(pick)}>
                  Öffnen
                </Button>
              )}
            </div>
          </div>
        )
      )}
    </Modal>
  )
}

type SortKey = 'neu' | 'bewertung' | 'titel'

function CollectionDetail({ collection }: { collection: Collection }) {
  const all = useData('items')
  const items = all.filter((i) => i.collectionId === collection.id)
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [source, setSource] = useState<LinkSource | null>(null)
  const [sort, setSort] = useState<SortKey>('neu')
  const [editing, setEditing] = useState<CollectionItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [editCol, setEditCol] = useState(false)
  const [random, setRandom] = useState(false)

  useEffect(() => {
    const id = params.get('open')
    if (id) {
      const it = all.find((x) => x.id === id)
      if (it) setEditing(it)
      params.delete('open')
      setParams(params, { replace: true })
    }
  }, [params, setParams, all])

  const tags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items])
  const sources = useMemo(() => [...new Set(items.filter((i) => i.kind === 'link').map((i) => i.source))], [items])
  const list = useMemo(() => {
    const l = items
      .filter((i) => matches(q, i.title, i.note, i.url, i.tags.join(' '), i.preview?.title))
      .filter((i) => (tag ? i.tags.includes(tag) : true))
      .filter((i) => (favOnly ? i.favorite : true))
      .filter((i) => (source ? i.source === source && i.kind === 'link' : true))
    if (sort === 'neu') l.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === 'bewertung') l.sort((a, b) => b.rating - a.rating)
    if (sort === 'titel') l.sort((a, b) => a.title.localeCompare(b.title, 'de'))
    return l
  }, [items, q, tag, favOnly, source, sort])

  return (
    <div>
      <div className="flex items-center gap-2 pt-5 lg:pt-8">
        <Link to="/sammlungen" className="inline-flex min-h-10 items-center gap-1 rounded-xl pr-3 text-sm font-semibold text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Sammlungen
        </Link>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-2">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-3xl text-3xl" style={{ background: `color-mix(in oklab, ${collection.color} 22%, transparent)` }}>
            {collection.emoji}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{collection.name}</h1>
            <p className="text-muted">
              {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}
              {collection.description && ` · ${collection.description}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton label="Sammlung bearbeiten" onClick={() => setEditCol(true)}>
            <Pencil className="size-5" />
          </IconButton>
          <Button icon={<Shuffle className="size-4" />} onClick={() => setRandom(true)} disabled={!items.length} aria-label={collection.randomLabel || 'Zufällige Idee'}>
            <span className="hidden sm:inline">{collection.randomLabel || 'Zufall'}</span>
          </Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Hinzufügen
          </Button>
        </div>
      </header>

      {items.length > 0 && (
        <div className="mb-5 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`In ${collection.name} suchen`} aria-label="Suchen" />
            </div>
            <select className="field w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sortierung">
              <option value="neu">Neueste</option>
              <option value="bewertung">Beste Bewertung</option>
              <option value="titel">A–Z</option>
            </select>
          </div>
          <div className="scroll-x -mx-1 flex gap-2 px-1">
            <Chip active={favOnly} onClick={() => setFavOnly(!favOnly)}>
              <Star className="size-3.5" /> Favoriten
            </Chip>
            {sources.length > 1 &&
              sources.map((s) => (
                <Chip key={s} active={source === s} onClick={() => setSource(source === s ? null : s)}>
                  <SourceIcon source={s} className="size-3.5" /> {sourceLabel[s]}
                </Chip>
              ))}
            {tags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                #{t}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={collection.emoji}
            title="Noch leer"
            text="Füge Links (z. B. Instagram-Reels oder YouTube), Notizen oder Fotos hinzu."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Ersten Eintrag speichern
              </Button>
            }
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState compact title="Keine Treffer" text="Filter zurücksetzen oder anderen Suchbegriff probieren." />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {list.map((i) => (
            <ItemCard key={i.id} item={i} onEdit={() => setEditing(i)} />
          ))}
        </div>
      )}

      <ItemEditor open={adding || !!editing} item={editing} collectionId={collection.id} onClose={() => { setAdding(false); setEditing(null) }} />
      <CollectionEditor open={editCol} collection={collection} onClose={() => setEditCol(false)} />
      <RandomPick open={random} collection={collection} items={items} onClose={() => setRandom(false)} />
    </div>
  )
}

export default function CollectionsPage() {
  const { id } = useParams()
  const collections = useData('collections')
  const items = useData('items')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CollectionItem | null>(null)

  const current = collections.find((c) => c.id === id)
  if (id && current) return <CollectionDetail key={current.id} collection={current} />
  if (id && !current)
    return (
      <Card className="mt-10">
        <EmptyState title="Sammlung nicht gefunden" text="Vielleicht wurde sie gelöscht." action={<Link to="/sammlungen" className="font-semibold text-accent">Zur Übersicht</Link>} />
      </Card>
    )

  const favorites = items.filter((i) => i.favorite)
  const results = q.trim().length >= 2 ? items.filter((i) => matches(q, i.title, i.note, i.url, i.tags.join(' '), i.preview?.title)) : null
  const recent = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)

  return (
    <div>
      <PageHeader
        title="Sammlungen"
        subtitle="Dein persönlicher Speicher für Links, Ideen und Fundstücke."
        actions={
          <Button variant="secondary" className="hidden sm:inline-flex" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Link speichern
          </Button>
        }
      />
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Alle Sammlungen durchsuchen" aria-label="Alle Sammlungen durchsuchen" />
      </div>

      {results ? (
        results.length === 0 ? (
          <Card>
            <EmptyState compact title="Keine Treffer" />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {results.map((i) => (
              <ItemCard key={i.id} item={i} onEdit={() => setEditing(i)} showCollection={collections.find((c) => c.id === i.collectionId)} />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {collections.map((c, idx) => {
              const ci = items.filter((i) => i.collectionId === c.id)
              const thumbs = ci.map((i) => i.image ?? i.preview?.image).filter(Boolean).slice(0, 3) as string[]
              return (
                <Link
                  key={c.id}
                  to={`/sammlungen/${c.id}`}
                  className="card group relative flex min-h-36 animate-rise flex-col overflow-hidden p-4 transition hover:-translate-y-0.5"
                  style={{ animationDelay: `${idx * 30}ms`, background: `linear-gradient(160deg, color-mix(in oklab, ${c.color} 16%, var(--surface)) 0%, var(--surface) 70%)` }}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{c.emoji}</span>
                    {thumbs.length > 0 && (
                      <div className="flex -space-x-3">
                        {thumbs.map((t, i) => (
                          <img key={i} src={t} alt="" referrerPolicy="no-referrer" className="size-9 rounded-xl border-2 border-surface object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-auto pt-4 font-display text-lg font-semibold leading-tight">{c.name}</h3>
                  <p className="text-sm text-muted">
                    {ci.length} {ci.length === 1 ? 'Eintrag' : 'Einträge'}
                  </p>
                </Link>
              )
            })}
            <button onClick={() => setCreating(true)} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-strong text-muted transition hover:border-accent hover:text-accent">
              <Plus className="size-6" />
              <span className="font-semibold">Neue Sammlung</span>
            </button>
          </div>

          {favorites.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-semibold">Favoriten</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {favorites.slice(0, 8).map((i) => (
                  <ItemCard key={i.id} item={i} onEdit={() => setEditing(i)} showCollection={collections.find((c) => c.id === i.collectionId)} />
                ))}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-semibold">Zuletzt gespeichert</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {recent.map((i) => (
                  <ItemCard key={i.id} item={i} onEdit={() => setEditing(i)} showCollection={collections.find((c) => c.id === i.collectionId)} />
                ))}
              </div>
            </section>
          )}
          <InstagramInfo />
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Badge tone="planned">Geplant</Badge> Gemeinsame Sammlungen mit Freunden (benötigt Benutzerkonten).
          </div>
        </>
      )}

      <CollectionEditor open={creating} onClose={() => setCreating(false)} />
      <ItemEditor open={adding || !!editing} item={editing} onClose={() => { setAdding(false); setEditing(null) }} />
    </div>
  )
}
