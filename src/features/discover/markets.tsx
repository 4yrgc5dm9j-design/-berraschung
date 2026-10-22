import { useEffect, useMemo, useState, useLayoutEffect } from 'react'
import { Plus, Trash2, Pencil, Gamepad2, Wallet, Calculator, Eye, Zap, Globe2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, ErrorNote, Field, IconButton, Modal, Segmented, SectionTitle, SourceLine } from '@/components/ui'
import { AreaChart, seriesColor } from '@/components/ui/charts'
import { actions, useData } from '@/data/store'
import type { AssetKind, Portfolio, Transaction, WatchItem } from '@/data/types'
import { cn, fmtEur, fmtMoney, fmtNum, fmtPct, parseNum } from '@/lib/utils'
import { fmtDate, timeAgo, todayKey } from '@/lib/dates'
import { useQuotes } from '@/services/hooks'
import { searchSymbols, type Quote, type SymbolHit } from '@/services/server'
import { toast } from '@/data/toasts'
import { savingsPlan, summarize } from './portfolio'
import { DepotAnalysis } from './DepotAnalysis'
import { InstrumentSheet, MarketBrowser, PickButton } from './instruments-ui'
import { instrument } from '@/data/instruments'

// ---------------------------------------------------------------- Kurs-Hinweis
export function QuoteSourceNote({ error, fetchedAt, loading, reload, errors, source }: { error: string | null; fetchedAt: string | null; loading: boolean; reload: () => void; errors?: string[]; source?: string }) {
  if (error && /Kursquelle|not_configured/i.test(error))
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent-soft p-3 text-sm">
        <Zap className="size-5 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 text-muted">
          <span className="font-semibold text-text">Kurse nicht verfügbar.</span> Kurse für alle bekannten Werte gibt es in der Web-Version automatisch. Mit einem kostenlosen Finnhub-Schlüssel kommen US-Werte live dazu.
        </p>
        <Link to="/profil#kurse" className="inline-flex min-h-10 items-center rounded-xl bg-accent px-3 font-semibold text-accent-fg">
          Einrichten
        </Link>
      </div>
    )
  if (error) return <ErrorNote error={error} onRetry={reload} compact />
  if (!fetchedAt) return null
  const live = !!source && /Finnhub/.test(source)
  const missing = errors?.length ?? 0
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex size-2">
          <span className={cn('absolute inline-flex size-full rounded-full opacity-60', live ? 'animate-ping bg-success' : 'bg-warn')} />
          <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-success' : 'bg-warn')} />
        </span>
        <span className={cn('text-xs font-semibold', live ? 'text-success' : 'text-warn')}>{live ? 'Live' : 'Verzögert (ca. 15–45 Min.)'}</span>
        <SourceLine source={`${source ?? 'Finnhub'}, € via EZB`} fetchedAt={fetchedAt} loading={loading} onReload={reload} />
      </div>
      {missing > 0 && <p className="text-[11px] text-faint">Für {missing} Wert(e) gibt es keinen Kurs – dort hilft der manuelle Kurs (Stift-Symbol).</p>}
    </div>
  )
}

/** Beliebte Werte, die im kostenlosen Finnhub-Plan (US-Börsen) live verfügbar sind. */
export const POPULAR: { symbol: string; name: string; kind: AssetKind }[] = [
  { symbol: 'AAPL', name: 'Apple', kind: 'Aktie' },
  { symbol: 'MSFT', name: 'Microsoft', kind: 'Aktie' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'Aktie' },
  { symbol: 'AMZN', name: 'Amazon', kind: 'Aktie' },
  { symbol: 'GOOGL', name: 'Alphabet', kind: 'Aktie' },
  { symbol: 'TSLA', name: 'Tesla', kind: 'Aktie' },
  { symbol: 'SAP', name: 'SAP (US-Listing)', kind: 'Aktie' },
  { symbol: 'DB', name: 'Deutsche Bank (US-Listing)', kind: 'Aktie' },
  { symbol: 'URTH', name: 'iShares MSCI World ETF (US)', kind: 'ETF' },
  { symbol: 'SPY', name: 'S&P 500 ETF', kind: 'ETF' },
  { symbol: 'QQQ', name: 'Nasdaq-100 ETF', kind: 'ETF' },
]

function Suggestions({ existing }: { existing: string[] }) {
  const list = POPULAR.filter((p) => !existing.includes(p.symbol))
  if (!list.length) return null
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">Schnell hinzufügen</p>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <Chip key={p.symbol} onClick={() => actions().add('watchlist', { symbol: p.symbol, name: p.name, kind: p.kind, note: '' })}>
            <Plus className="size-3.5" /> {p.name}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function QuoteValue({ live, manual, error }: { live?: Quote; manual?: { price: number; updatedAt: string }; error?: string }) {
  if (live)
    return (
      <div className="text-right">
        <p className="font-semibold tabular">{fmtMoney(live.price, live.currency)}</p>
        <div className="flex items-center justify-end gap-1.5">
          {live.currency !== 'EUR' && live.priceEur != null && <span className="text-[11px] text-faint tabular">≈ {fmtEur(live.priceEur)}</span>}
          {live.changePct != null && (
            <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular', live.changePct >= 0 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger')}>{fmtPct(live.changePct)}</span>
          )}
        </div>
      </div>
    )
  if (manual)
    return (
      <div className="text-right">
        <p className="font-semibold tabular">{fmtEur(manual.price)}</p>
        <p className="text-[11px] text-faint">manuell · {timeAgo(manual.updatedAt)}</p>
      </div>
    )
  return (
    <p className="max-w-28 text-right text-[11px] leading-tight text-faint" title={error}>
      {error ? 'kein Live-Kurs' : 'kein Kurs'}
    </p>
  )
}

function usePriceMap(symbols: string[]) {
  const q = useQuotes(symbols)
  return { ...q, quotes: (q.data?.quotes ?? null) as Record<string, Quote> | null }
}

// ---------------------------------------------------------------- Manueller Kurs
export function PriceEditor({ symbol, name, open, onClose }: { symbol: string; name: string; open: boolean; onClose: () => void }) {
  const prices = useData('prices')
  const current = prices.find((p) => p.id === symbol)
  const [v, setV] = useState('')
  useLayoutEffect(() => {
    if (open) setV(current ? String(current.price).replace('.', ',') : '')
  }, [open, current])
  const n = parseNum(v)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Kurs: ${name || symbol}`}
      footer={
        <>
          {current && (
            <Button variant="ghost" className="mr-auto" onClick={() => { actions().remove('prices', symbol, 'Manueller Kurs entfernt'); onClose() }}>
              Kurs entfernen
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!Number.isFinite(n) || n <= 0}
            onClick={() => {
              const t = new Date().toISOString()
              actions().upsert('prices', { id: symbol, price: n, createdAt: current?.createdAt ?? t, updatedAt: t })
              onClose()
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <Field label="Aktueller Kurs in €" hint="Manuell gepflegt – z. B. aus deiner Banking-App. Der Zeitpunkt wird mit angezeigt.">
        <input className="field font-display text-2xl font-semibold" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="0,00" />
      </Field>
      {current && <p className="mt-2 text-xs text-faint">Zuletzt gepflegt {timeAgo(current.updatedAt)}</p>}
    </Modal>
  )
}

// ---------------------------------------------------------------- Watchlist
function WatchEditor({ open, item, onClose }: { open: boolean; item: WatchItem | null; onClose: () => void }) {
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AssetKind>('Aktie')
  const [note, setNote] = useState('')
  const [hits, setHits] = useState<SymbolHit[]>([])
  const [searchErr, setSearchErr] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (open) {
      setSymbol(item?.symbol ?? '')
      setName(item?.name ?? '')
      setKind(item?.kind ?? 'Aktie')
      setNote(item?.note ?? '')
      setHits([])
    }
  }, [open, item])
  const search = async () => {
    if (!name.trim()) return
    try {
      const r = await searchSymbols(name.trim())
      setHits(r.results)
      setSearchErr(r.results.length ? null : 'Nichts gefunden.')
    } catch (e) {
      setSearchErr((e as Error).message)
    }
  }
  const save = () => {
    const s = symbol.trim().toUpperCase()
    if (!s) return
    const v = { symbol: s, name: name.trim() || s, kind, note }
    if (item) actions().update('watchlist', item.id, v)
    else actions().add('watchlist', v)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={item ? 'Wert bearbeiten' : 'Zur Watchlist'} footer={<Button variant="primary" onClick={save} disabled={!symbol.trim()}>Speichern</Button>}>
      <div className="space-y-4">
        <PickButton
          label="Aus über 200 Aktien & ETFs wählen"
          onPick={(i) => {
            setSymbol(i.id)
            setName(i.name)
            setKind(i.type)
          }}
        />
        <Field label="Name" hint="Oder selbst eintragen: Suche nutzt die verbundene Kursquelle.">
          <div className="flex gap-2">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Apple, SAP, MSCI World" />
            <Button variant="secondary" onClick={search}>
              Suchen
            </Button>
          </div>
        </Field>
        {searchErr && <p className="text-xs text-muted">{/not_configured|Kursquelle/.test(searchErr) ? 'Symbolsuche benötigt eine Kursquelle – trage das Kürzel einfach selbst ein.' : searchErr}</p>}
        {hits.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-line">
            {hits.map((h) => (
              <button key={h.symbol} onClick={() => { setSymbol(h.symbol); setName(h.name); setHits([]) }} className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2">
                <span className="truncate">{h.name}</span>
                <span className="font-bold">{h.symbol}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kürzel / ISIN">
            <input className="field uppercase" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" />
          </Field>
          <Field label="Art">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
              {(['Aktie', 'ETF', 'Fonds', 'Krypto', 'Sonstiges'] as AssetKind[]).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notiz">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Warum beobachte ich das?" />
        </Field>
      </div>
    </Modal>
  )
}

export function WatchlistView() {
  const watch = useData('watchlist')
  const prices = useData('prices')
  const q = usePriceMap(watch.map((w) => w.symbol))
  const [edit, setEdit] = useState<WatchItem | null>(null)
  const [open, setOpen] = useState(false)
  const [priceFor, setPriceFor] = useState<WatchItem | null>(null)
  const [confirm, setConfirm] = useState<WatchItem | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle action={<Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => { setEdit(null); setOpen(true) }}>Wert</Button>}>Watchlist</SectionTitle>
      {watch.length === 0 ? (
        <div className="space-y-4">
          <EmptyState compact icon="👀" title="Watchlist ist leer" text="Füge Aktien oder ETFs hinzu, die du beobachten möchtest." />
          <Suggestions existing={[]} />
        </div>
      ) : (
        <>
          <div className="mb-3">
            <QuoteSourceNote error={q.error} fetchedAt={q.fetchedAt} loading={q.loading} reload={q.reload} errors={q.data?.errors} source={q.data?.source} />
          </div>
          <div className="divide-y divide-line">
            {watch.map((w) => {
              const live = q.quotes?.[w.symbol]
              const manual = prices.find((p) => p.id === w.symbol)
              return (
                <div key={w.id} className="flex items-center gap-2 py-2.5 sm:gap-3">
                  <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xs font-bold sm:grid">{w.symbol.slice(0, 4)}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => (instrument(w.symbol) ? setSheet(w.symbol) : (setEdit(w), setOpen(true)))}>
                    <span className="block truncate font-semibold">{w.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {w.symbol} · {w.kind}
                      {w.note && ` · ${w.note}`}
                    </span>
                  </button>
                  <QuoteValue live={live} manual={manual} error={q.data?.errors.find((e) => e.startsWith(`${w.symbol}:`))} />
                  <IconButton label="Kurs manuell pflegen" size="sm" className="size-8 sm:size-9" onClick={() => setPriceFor(w)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label="Entfernen" size="sm" className="size-8 sm:size-9" onClick={() => setConfirm(w)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              )
            })}
          </div>
        </>
      )}
      {watch.length > 0 && watch.length < 8 && (
        <div className="mt-4 border-t border-line pt-4">
          <Suggestions existing={watch.map((w) => w.symbol)} />
        </div>
      )}
      <WatchEditor open={open} item={edit} onClose={() => setOpen(false)} />
      <InstrumentSheet id={sheet} onClose={() => setSheet(null)} />
      {priceFor && <PriceEditor open symbol={priceFor.symbol} name={priceFor.name} onClose={() => setPriceFor(null)} />}
      <ConfirmDialog open={!!confirm} title="Von Watchlist entfernen?" message={confirm?.name} confirmLabel="Entfernen" onConfirm={() => confirm && actions().remove('watchlist', confirm.id, 'Von Watchlist entfernt')} onClose={() => setConfirm(null)} />
    </Card>
  )
}

// ---------------------------------------------------------------- Depot
type TxDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

function TxEditor({ open, tx, portfolio, preset, onClose, cash }: { open: boolean; tx: Transaction | null; portfolio: Portfolio; preset?: Partial<TxDraft>; onClose: () => void; cash: number | null }) {
  const prices = useData('prices')
  const [d, setD] = useState<TxDraft>({ portfolioId: portfolio.id, symbol: '', name: '', type: 'buy', date: todayKey(), qty: 0, price: 0, fees: 0 })
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  useLayoutEffect(() => {
    if (!open) return
    const init = tx ?? { portfolioId: portfolio.id, symbol: '', name: '', type: 'buy' as const, date: todayKey(), qty: 0, price: 0, fees: portfolio.kind === 'virtual' ? 1 : 0, ...preset }
    setD(init)
    setQty(init.qty ? String(init.qty).replace('.', ',') : '')
    const mp = prices.find((p) => p.id === init.symbol)
    setPrice(init.price ? String(init.price).replace('.', ',') : mp ? String(mp.price).replace('.', ',') : '')
    setFees(init.fees ? String(init.fees).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx?.id])
  const pickQuotes = useQuotes(useMemo(() => (d.symbol ? [d.symbol.toUpperCase()] : []), [d.symbol]))
  const nq = parseNum(qty)
  const np = parseNum(price)
  const nf = fees.trim() ? parseNum(fees) : 0
  const total = nq * np + (d.type === 'buy' ? nf : -nf)
  const valid = d.symbol.trim() && nq > 0 && np > 0 && Number.isFinite(nf) && nf >= 0
  const tooExpensive = portfolio.kind === 'virtual' && d.type === 'buy' && !tx && cash != null && total > cash + 1e-6
  const save = () => {
    if (!valid || tooExpensive) return
    const v = { ...d, symbol: d.symbol.trim().toUpperCase(), name: d.name.trim() || d.symbol.trim().toUpperCase(), qty: nq, price: np, fees: nf }
    if (tx) actions().update('transactions', tx.id, v)
    else {
      actions().add('transactions', v)
      toast(d.type === 'buy' ? 'Kauf erfasst' : 'Verkauf erfasst', 'success')
    }
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tx ? 'Transaktion bearbeiten' : 'Neue Transaktion'}
      footer={
        <>
          {tx && (
            <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={() => { actions().remove('transactions', tx.id, 'Transaktion gelöscht'); onClose() }}>
              Löschen
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={!valid || tooExpensive}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented className="w-full" value={d.type} onChange={(v) => setD({ ...d, type: v })} options={[{ value: 'buy', label: 'Kauf' }, { value: 'sell', label: 'Verkauf' }]} />
        <PickButton
          label="Wert aus Liste wählen"
          onPick={(i) => {
            setD((x) => ({ ...x, symbol: i.id, name: i.name }))
            setPrice('')
          }}
        />
        {!price && pickQuotes.data?.quotes[d.symbol.toUpperCase()]?.priceEur != null && (
          <button type="button" className="text-sm font-semibold text-accent" onClick={() => setPrice(String(pickQuotes.data!.quotes[d.symbol.toUpperCase()].priceEur!.toFixed(2)).replace('.', ','))}>
            Aktuellen Kurs übernehmen: {fmtEur(pickQuotes.data.quotes[d.symbol.toUpperCase()].priceEur!)}
          </button>
        )}
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Name">
            <input className="field" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="z. B. iShares Core MSCI World" />
          </Field>
          <Field label="Kürzel / ISIN">
            <input className="field uppercase" value={d.symbol} onChange={(e) => setD({ ...d, symbol: e.target.value })} placeholder="EUNL" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stückzahl">
            <input className="field" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Kurs (€)">
            <input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Gebühren (€)">
            <input className="field" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Datum">
            <input type="date" className="field" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </Field>
        </div>
        {Number.isFinite(total) && total > 0 && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm">
            Gesamt: <span className="font-bold tabular">{fmtEur(total)}</span>
            {portfolio.kind === 'virtual' && cash != null && <span className="text-muted"> · Spielgeld verfügbar: {fmtEur(cash)}</span>}
          </p>
        )}
        {tooExpensive && <p className="text-sm font-semibold text-danger">Nicht genug Spielgeld für diesen Kauf.</p>}
      </div>
    </Modal>
  )
}

export function PortfolioView({ kind, buy }: { kind: 'real' | 'virtual'; buy?: string | null }) {
  const portfolios = useData('portfolios').filter((p) => p.kind === kind)
  const allTx = useData('transactions')
  const prices = useData('prices')
  const [pid, setPid] = useState<string | null>(null)
  const portfolio = portfolios.find((p) => p.id === pid) ?? portfolios[0]
  const symbols = useMemo(() => [...new Set(allTx.filter((t) => t.portfolioId === portfolio?.id).map((t) => t.symbol))], [allTx, portfolio?.id])
  const q = usePriceMap(symbols)
  const [txOpen, setTxOpen] = useState(false)
  const [tx, setTx] = useState<Transaction | null>(null)
  const [preset, setPreset] = useState<Partial<TxDraft> | undefined>()
  const [priceFor, setPriceFor] = useState<{ symbol: string; name: string } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  useEffect(() => {
    const inst = buy ? instrument(buy) : undefined
    if (!inst) return
    setTx(null)
    setPreset({ symbol: inst.id, name: inst.name, type: 'buy' })
    setTxOpen(true)
  }, [buy])

  useEffect(() => {
    if (!portfolio && !actions().data.portfolios.some((p) => p.kind === kind)) actions().add('portfolios', { name: kind === 'real' ? 'Mein Depot' : 'Spieldepot', kind, startCash: kind === 'virtual' ? 100000 : 0 })
  }, [portfolio, kind])

  const s = useMemo(() => (portfolio ? summarize(portfolio, allTx, prices, q.quotes) : null), [portfolio, allTx, prices, q.quotes])
  if (!portfolio || !s) return null
  const txs = allTx.filter((t) => t.portfolioId === portfolio.id).sort((a, b) => b.date.localeCompare(a.date))
  const gain = s.value - s.invested
  const total = s.value + (s.cash ?? 0)

  const openTx = (p?: Partial<TxDraft>) => {
    setTx(null)
    setPreset(p)
    setTxOpen(true)
  }

  return (
    <div className="space-y-4">
      {kind === 'virtual' && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-3 text-sm text-muted">
          <Gamepad2 className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            <span className="font-semibold text-text">Spieldepot mit virtuellem Geld.</span> Übe Strategien ohne Risiko: Startkapital {fmtEur(portfolio.startCash, true)}, Kurse trägst du beim Kauf selbst ein oder nutzt deine gepflegten Kurse.
          </p>
        </div>
      )}
      {portfolios.length > 1 && (
        <div className="scroll-x flex gap-2">
          {portfolios.map((p) => (
            <Chip key={p.id} active={p.id === portfolio.id} onClick={() => setPid(p.id)}>
              {p.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">{kind === 'virtual' ? 'Gesamtwert inkl. Spielgeld' : 'Depotwert'}</p>
          <p className="font-display text-4xl font-bold tracking-tight tabular">{fmtEur(kind === 'virtual' ? total : s.value)}</p>
          <p className={cn('mt-1 text-sm font-semibold tabular', gain >= 0 ? 'text-success' : 'text-danger')}>
            {gain >= 0 ? '+' : ''}
            {fmtEur(gain)} {s.invested > 0 && `(${fmtPct(gain / s.invested)})`} <span className="font-normal text-muted">unrealisiert</span>
          </p>
          {s.unpriced > 0 && <p className="mt-2 text-xs text-warn">{s.unpriced} Position(en) ohne aktuellen Kurs – dort wird der Einstandswert angesetzt.</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Investiert</p>
          <p className="font-display text-2xl font-bold tabular">{fmtEur(s.invested, true)}</p>
          <p className="text-xs text-muted">Gebühren gesamt {fmtEur(s.fees)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">{kind === 'virtual' ? 'Spielgeld' : 'Realisiert'}</p>
          <p className={cn('font-display text-2xl font-bold tabular', kind === 'real' && (s.realized >= 0 ? 'text-success' : 'text-danger'))}>{kind === 'virtual' ? fmtEur(s.cash ?? 0, true) : fmtEur(s.realized, true)}</p>
          {kind === 'virtual' && <p className="text-xs text-muted">Realisiert {fmtEur(s.realized)}</p>}
        </Card>
      </div>

      {symbols.length > 0 && <QuoteSourceNote error={q.error} fetchedAt={q.fetchedAt} loading={q.loading} reload={q.reload} errors={q.data?.errors} source={q.data?.source} />}

      <div>
        <Card className="p-4 sm:p-5">
          <SectionTitle action={<Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => openTx()}>Transaktion</Button>}>Positionen</SectionTitle>
          {s.positions.length === 0 ? (
            <EmptyState compact icon={kind === 'virtual' ? '🎮' : '📈'} title="Noch keine Positionen" text={kind === 'virtual' ? 'Kauf deine erste virtuelle Aktie.' : 'Erfasse deine Käufe manuell – z. B. aus der Abrechnung deiner Bank.'} />
          ) : (
            <div className="divide-y divide-line">
              {s.positions.map((p, i) => (
                <div key={p.symbol} className="flex items-center gap-3 py-2.5">
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: i < 7 ? seriesColor(i) : 'var(--faint)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted tabular">
                      {fmtNum(p.qty)} Stk. · Ø {fmtEur(p.avg)}
                    </p>
                  </div>
                  <button className="text-right" onClick={() => setPriceFor({ symbol: p.symbol, name: p.name })} title="Kurs pflegen">
                    <p className="font-semibold tabular">{fmtEur(p.value ?? p.cost)}</p>
                    {p.gain != null ? (
                      <p className={cn('text-xs font-semibold tabular', p.gain >= 0 ? 'text-success' : 'text-danger')}>
                        {fmtPct(p.gainPct ?? 0)} · {p.priceSource}
                      </p>
                    ) : (
                      <p className="text-xs text-warn">Kurs pflegen</p>
                    )}
                  </button>
                  <div className="flex flex-col">
                    <button className="rounded-md px-1.5 text-xs font-bold text-accent hover:bg-accent-soft" onClick={() => openTx({ symbol: p.symbol, name: p.name, type: 'buy' })}>
                      Kauf
                    </button>
                    <button className="rounded-md px-1.5 text-xs font-bold text-muted hover:bg-surface-2" onClick={() => openTx({ symbol: p.symbol, name: p.name, type: 'sell', qty: p.qty })}>
                      Verkauf
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <DepotAnalysis portfolio={portfolio} transactions={allTx} prices={prices} quotes={q.quotes} />

      <Card className="p-4 sm:p-5">
        <SectionTitle>Transaktionen</SectionTitle>
        {txs.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Transaktionen.</p>
        ) : (
          <div className="divide-y divide-line">
            {txs.map((t) => (
              <button key={t.id} onClick={() => { setTx(t); setPreset(undefined); setTxOpen(true) }} className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:bg-surface-2">
                <Badge tone={t.type === 'buy' ? 'accent' : 'warn'}>{t.type === 'buy' ? 'Kauf' : 'Verkauf'}</Badge>
                <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                <span className="hidden text-sm text-muted sm:inline">{fmtDate(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                <span className="text-sm tabular">
                  {fmtNum(t.qty)} × {fmtEur(t.price)}
                </span>
              </button>
            ))}
          </div>
        )}
        {s.closed.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Geschlossen: {s.closed.map((c) => `${c.name} (${fmtEur(c.realized)})`).join(', ')}
          </p>
        )}
      </Card>
      {kind === 'virtual' && txs.length > 0 && (
        <Button variant="ghost" className="text-danger" onClick={() => setResetOpen(true)}>
          Spieldepot zurücksetzen
        </Button>
      )}

      <TxEditor open={txOpen} tx={tx} portfolio={portfolio} preset={preset} cash={s.cash} onClose={() => setTxOpen(false)} />
      {priceFor && <PriceEditor open symbol={priceFor.symbol} name={priceFor.name} onClose={() => setPriceFor(null)} />}
      <ConfirmDialog
        open={resetOpen}
        title="Spieldepot zurücksetzen?"
        message="Alle virtuellen Transaktionen werden gelöscht, das Spielgeld startet neu."
        confirmLabel="Zurücksetzen"
        onConfirm={() => actions().removeMany('transactions', txs.map((t) => t.id), 'Spieldepot zurückgesetzt')}
        onClose={() => setResetOpen(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Sparplanrechner
export function SavingsCalculator() {
  const [start, setStart] = useState('1000')
  const [monthly, setMonthly] = useState('150')
  const [years, setYears] = useState(20)
  const [rate, setRate] = useState('6')
  const [dyn, setDyn] = useState('0')
  const [infl, setInfl] = useState('2')
  const rows = useMemo(
    () =>
      savingsPlan({
        start: Math.max(0, parseNum(start) || 0),
        monthly: Math.max(0, parseNum(monthly) || 0),
        years,
        ratePct: parseNum(rate) || 0,
        dynamicPct: parseNum(dyn) || 0,
        inflationPct: parseNum(infl) || 0,
      }),
    [start, monthly, years, rate, dyn, infl],
  )
  const last = rows[rows.length - 1]
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="space-y-4 p-4 sm:p-5">
        <h3 className="font-display text-lg font-semibold">Sparplan & Zinseszins</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Startkapital (€)">
            <input className="field" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Monatlich (€)">
            <input className="field" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </Field>
          <Field label="Rendite p. a. (%)">
            <input className="field" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label="Dynamik p. a. (%)" hint="Jährliche Erhöhung der Rate">
            <input className="field" inputMode="decimal" value={dyn} onChange={(e) => setDyn(e.target.value)} />
          </Field>
          <Field label="Inflation p. a. (%)">
            <input className="field" inputMode="decimal" value={infl} onChange={(e) => setInfl(e.target.value)} />
          </Field>
        </div>
        <Field label={`Laufzeit: ${years} Jahre`}>
          <input type="range" min={1} max={50} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </Field>
        <p className="text-xs text-faint">Modellrechnung mit konstanter Rendite, monatlicher Verzinsung und Einzahlung am Monatsende. Steuern und Kosten sind nicht berücksichtigt – keine Anlageberatung.</p>
      </Card>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="col-span-2 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">Endkapital nach {years} Jahren</p>
            <p className="font-display text-4xl font-bold tracking-tight tabular">{fmtEur(last.value, true)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">Eingezahlt</p>
            <p className="font-display text-xl font-bold tabular">{fmtEur(last.deposits, true)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">Erträge</p>
            <p className="font-display text-xl font-bold tabular text-success">{fmtEur(last.gains, true)}</p>
          </Card>
        </div>
        <Card className="p-4 sm:p-5">
          <AreaChart
            points={rows.map((r) => ({ year: r.year, deposits: r.deposits, gains: Math.max(0, r.gains) }))}
            series={[
              { key: 'deposits', label: 'Einzahlungen', color: seriesColor(0) },
              { key: 'gains', label: 'Zinsen & Erträge', color: seriesColor(2) },
            ]}
            xLabel={(p) => (Number(p.year) === 0 ? 'Start' : `Jahr ${p.year}`)}
            format={(v) => fmtEur(v, true)}
          />
          <p className="mt-3 text-sm text-muted">
            Kaufkraft heute (bei {rate || 0} % Rendite und {infl || 0} % Inflation): <span className="font-semibold text-text">{fmtEur(last.real, true)}</span>
          </p>
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-faint">
              <tr>
                <th className="p-3">Jahr</th>
                <th className="p-3 text-right">Eingezahlt</th>
                <th className="p-3 text-right">Erträge</th>
                <th className="p-3 text-right">Kapital</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows
                .filter((r) => r.year > 0 && (r.year % (years > 20 ? 5 : years > 10 ? 2 : 1) === 0 || r.year === years))
                .map((r) => (
                  <tr key={r.year} className="border-t border-line">
                    <td className="p-3">{r.year}</td>
                    <td className="p-3 text-right">{fmtEur(r.deposits, true)}</td>
                    <td className="p-3 text-right">{fmtEur(r.gains, true)}</td>
                    <td className="p-3 text-right font-semibold">{fmtEur(r.value, true)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

export function MarketsView() {
  const [params, setParams] = useSearchParams()
  const buy = params.get('kauf')
  const [tab, setTab] = useState<'watch' | 'maerkte' | 'depot' | 'rechner'>(buy ? 'depot' : 'watch')
  useEffect(() => {
    if (buy) {
      setTab('depot')
      // Parameter nach dem Öffnen entfernen, damit Neuladen nicht erneut einen Kauf öffnet
      const t = setTimeout(() => setParams({}, { replace: true }), 50)
      return () => clearTimeout(t)
    }
  }, [buy, setParams])
  return (
    <div>
      <Segmented
        className="mb-5 w-full sm:w-auto"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'watch', label: 'Watchlist', icon: <Eye className="size-4" /> },
          { value: 'maerkte', label: 'Märkte', icon: <Globe2 className="size-4" /> },
          { value: 'depot', label: 'Depot', icon: <Wallet className="size-4" /> },
          { value: 'rechner', label: 'Rechner', icon: <Calculator className="size-4" /> },
        ]}
      />
      <div key={tab} className="animate-rise">
        {tab === 'depot' && (
          <Link to="/spielen/boerse" className="mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-3 text-sm">
            <Gamepad2 className="size-5 shrink-0 text-accent" />
            <span className="flex-1 text-muted">
              <b className="text-text">Lieber erst üben?</b> Das Börsenspiel mit Spielgeld findest du jetzt unter <b className="text-text">Spielen</b>.
            </span>
            <span className="font-semibold text-accent">Öffnen →</span>
          </Link>
        )}
        {tab === 'watch' && <WatchlistView />}
        {tab === 'maerkte' && <MarketBrowser />}
        {tab === 'depot' && <PortfolioView kind="real" buy={buy} />}
        {tab === 'rechner' && <SavingsCalculator />}
      </div>
    </div>
  )
}
