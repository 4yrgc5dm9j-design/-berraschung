import { useMemo, useState } from 'react'
import { Eye, Gamepad2, Plus, Search, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Chip, EmptyState, Modal, Segmented, Skeleton, SourceLine } from '@/components/ui'
import { AreaChart } from '@/components/ui/charts'
import { INDEX_FILTERS, INSTRUMENTS, COUNTRY_LABEL, instrument, searchInstruments, type IndexFilter, type Instrument } from '@/data/instruments'
import { actions, useData } from '@/data/store'
import { toast } from '@/data/toasts'
import { cn, fmtEur, fmtMoney, fmtPct } from '@/lib/utils'
import { fmtDate } from '@/lib/dates'
import { useQuotes } from '@/services/hooks'
import { useRemote } from '@/services/remote'
import { STATIC_HOSTING, staticData, type Quote } from '@/services/server'

// ---------------------------------------------------------------- Kursverläufe
export interface HistoryFile {
  fetchedAt: string
  series: Record<string, [string, number][]>
}

/** Ein Jahr Tagesschlusskurse aller bekannten Werte (Web-Version, von der GitHub Action geladen) */
export function useHistory() {
  return useRemote<HistoryFile | null>(STATIC_HOSTING ? 'history' : null, () => staticData<HistoryFile>('history.json', 30000), 6 * 3600e3)
}

/** Kurse aller bekannten Werte (für Listen) */
export function useAllQuotes() {
  return useQuotes(useMemo(() => INSTRUMENTS.map((i) => i.id), []))
}

export function QuoteCell({ q, compact }: { q?: Quote; compact?: boolean }) {
  if (!q) return <span className="text-xs text-faint">–</span>
  return (
    <span className="text-right">
      <span className={cn('block font-semibold tabular', compact && 'text-sm')}>{q.currency === 'EUR' ? fmtEur(q.price) : fmtMoney(q.price, q.currency)}</span>
      {q.changePct != null && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular', q.changePct >= 0 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger')}>{fmtPct(q.changePct)}</span>}
    </span>
  )
}

// ---------------------------------------------------------------- Auswahl
export function InstrumentPicker({ open, onClose, onPick, title = 'Wert auswählen' }: { open: boolean; onClose: () => void; onPick: (i: Instrument) => void; title?: string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<IndexFilter>('Alle')
  const quotes = useAllQuotes()
  const list = useMemo(() => searchInstruments(q, filter), [q, filter])
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input data-autofocus className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Kürzel oder Branche – z. B. SAP, Allianz, MSCI World" aria-label="Wert suchen" />
      </div>
      <div className="scroll-x -mx-1 my-3 flex gap-2 px-1">
        {INDEX_FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
      <div className="divide-y divide-line">
        {list.slice(0, 120).map((i) => (
          <button
            key={i.id}
            onClick={() => {
              onPick(i)
              onClose()
            }}
            className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left hover:bg-surface-2"
          >
            <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-bold">{i.id.replace('.DE', '')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{i.name}</span>
              <span className="text-xs text-muted">
                {i.type} · {i.sector} · {i.index}
              </span>
            </span>
            <QuoteCell q={quotes.data?.quotes[i.id]} compact />
          </button>
        ))}
        {list.length === 0 && <EmptyState compact title="Nichts gefunden" text="Anderen Namen oder Filter probieren." />}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Detailansicht
export function InstrumentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const inst = id ? instrument(id) : undefined
  const quotes = useQuotes(useMemo(() => (id ? [id] : []), [id]))
  const history = useHistory()
  const watch = useData('watchlist')
  const navigate = useNavigate()
  const [range, setRange] = useState<'1M' | '6M' | '1J'>('6M')
  if (!id || !inst) return null
  const q = quotes.data?.quotes[id]
  const series = history.data?.series[id] ?? []
  const days = range === '1M' ? 23 : range === '6M' ? 128 : 260
  const pts = series.slice(-days).map(([d, c]) => ({ date: d, close: c }))
  const perf = pts.length > 1 ? pts[pts.length - 1].close / pts[0].close - 1 : null
  const onWatch = watch.some((w) => w.symbol === id)
  return (
    <Modal open onClose={onClose} title={inst.name} wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {inst.id} · {inst.type} · {inst.sector} · {COUNTRY_LABEL[inst.country] ?? inst.country}
          </p>
          {q ? (
            <>
              <p className="font-display text-3xl font-bold tabular">{q.currency === 'EUR' ? fmtEur(q.price) : fmtMoney(q.price, q.currency)}</p>
              <p className="text-sm text-muted">
                {q.changePct != null && <span className={cn('font-bold', q.changePct >= 0 ? 'text-success' : 'text-danger')}>{fmtPct(q.changePct)} heute</span>}
                {q.currency !== 'EUR' && q.priceEur != null && ` · ≈ ${fmtEur(q.priceEur)}`}
              </p>
            </>
          ) : (
            <p className="text-muted">Kein Kurs verfügbar</p>
          )}
        </div>
        <Segmented size="sm" value={range} onChange={setRange} options={[{ value: '1M', label: '1M' }, { value: '6M', label: '6M' }, { value: '1J', label: '1J' }]} />
      </div>
      <div className="mt-4">
        {history.loading && !history.data ? (
          <Skeleton className="h-52 w-full" />
        ) : pts.length > 1 ? (
          <>
            <AreaChart points={pts} series={[{ key: 'close', label: `Schlusskurs (${inst.currency})`, color: perf != null && perf < 0 ? 'var(--danger)' : 'var(--success)' }]} stacked={false} height={200} xLabel={(p) => fmtDate(String(p.date), { day: 'numeric', month: 'short', year: '2-digit' })} format={(v) => (inst.currency === 'EUR' ? fmtEur(v) : fmtMoney(v, inst.currency))} />
            {perf != null && (
              <p className="mt-2 text-sm">
                Entwicklung {range}: <b className={perf >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(perf)}</b>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Kein Kursverlauf verfügbar.</p>
        )}
      </div>
      {q && <SourceLine className="mt-2" source={q.delayed === false ? 'Finnhub (live)' : 'Stooq (verzögert)'} fetchedAt={quotes.data?.fetchedAt} />}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="soft"
          icon={<Eye className="size-4" />}
          disabled={onWatch}
          onClick={() => {
            actions().add('watchlist', { symbol: inst.id, name: inst.name, kind: inst.type, note: '' })
            toast('Zur Watchlist hinzugefügt', 'success')
          }}
        >
          {onWatch ? 'Auf der Watchlist' : 'Zur Watchlist'}
        </Button>
        <Button
          variant="primary"
          icon={<Gamepad2 className="size-4" />}
          onClick={() => {
            onClose()
            navigate(`/spielen/boerse?wert=${encodeURIComponent(inst.id)}`)
          }}
        >
          Im Börsenspiel handeln
        </Button>
        <Button
          icon={<ShoppingCart className="size-4" />}
          onClick={() => {
            onClose()
            navigate(`/entdecken/boerse?kauf=${encodeURIComponent(inst.id)}`)
          }}
        >
          Kauf im Depot erfassen
        </Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Märkte
type Sort = 'name' | 'gewinner' | 'verlierer'

export function MarketBrowser() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<IndexFilter>('DAX')
  const [sort, setSort] = useState<Sort>('gewinner')
  const [open, setOpen] = useState<string | null>(null)
  const quotes = useAllQuotes()
  const list = useMemo(() => {
    const l = searchInstruments(q, filter)
    const ch = (i: Instrument) => quotes.data?.quotes[i.id]?.changePct ?? null
    if (sort === 'name') return [...l].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    // Werte ohne Kurs immer ans Ende
    if (sort === 'gewinner') return [...l].sort((a, b) => (ch(b) ?? -Infinity) - (ch(a) ?? -Infinity))
    return [...l].sort((a, b) => (ch(a) ?? Infinity) - (ch(b) ?? Infinity))
  }, [q, filter, sort, quotes.data])
  const delayed = quotes.data && !/Finnhub \(live\)$/.test(quotes.data.source)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${INSTRUMENTS.length} Aktien & ETFs durchsuchen`} aria-label="Märkte durchsuchen" />
        </div>
        <select className="field sm:w-48" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortierung">
          <option value="gewinner">Größte Gewinner</option>
          <option value="verlierer">Größte Verlierer</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <div className="scroll-x -mx-1 flex gap-2 px-1">
        {INDEX_FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
      {quotes.error && !quotes.data ? (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">Kurse sind gerade nicht verfügbar ({quotes.error}).</p>
      ) : (
        quotes.data && (
          <div className="flex flex-wrap items-center gap-2">
            {delayed ? <Badge tone="warn">verzögert</Badge> : <Badge tone="success">live</Badge>}
            <SourceLine source={quotes.data.source} fetchedAt={quotes.data.fetchedAt} loading={quotes.loading} onReload={quotes.reload} />
          </div>
        )
      )}
      <div className="card divide-y divide-line px-3 sm:px-4">
        {list.map((i) => (
          <button key={i.id} onClick={() => setOpen(i.id)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
            <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-bold">{i.id.replace('.DE', '')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{i.name}</span>
              <span className="block truncate text-xs text-muted">
                {i.type} · {i.sector}
              </span>
            </span>
            {quotes.loading && !quotes.data ? <Skeleton className="h-8 w-20" /> : <QuoteCell q={quotes.data?.quotes[i.id]} />}
          </button>
        ))}
        {list.length === 0 && <EmptyState compact title="Nichts gefunden" />}
      </div>
      <InstrumentSheet id={open} onClose={() => setOpen(null)} />
    </div>
  )
}

/** Kleiner Knopf „Aus Liste wählen“ */
export function PickButton({ onPick, label = 'Aus Liste wählen' }: { onPick: (i: Instrument) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="soft" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <InstrumentPicker open={open} onClose={() => setOpen(false)} onPick={onPick} />
    </>
  )
}
