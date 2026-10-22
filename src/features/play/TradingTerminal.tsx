import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Search, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { Button, Chip, ConfirmDialog, Segmented } from '@/components/ui'
import { useSearchParams } from 'react-router-dom'
import { instrument } from '@/data/instruments'
import { InstrumentPicker } from '@/features/discover/instruments-ui'
import { DepotAnalysis } from '@/features/discover/DepotAnalysis'
import { actions, useData } from '@/data/store'
import { toast } from '@/data/toasts'
import { cn, fmtEur, fmtNum, fmtPct, parseNum } from '@/lib/utils'
import { fmtDate, timeAgo, todayKey } from '@/lib/dates'
import { useQuotes } from '@/services/hooks'
import { type Quote } from '@/services/server'
import { summarize } from '@/features/discover/portfolio'

const FEE = 1 // € pro Order im Spiel
const START_OPTIONS = [10_000, 50_000, 100_000, 1_000_000]
/** Werte im Laufband: DAX-Schwergewichte, US-Tech, beliebte ETFs */
const TAPE = ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'RHM.DE', 'MBG.DE', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'TSLA', 'EUNL.DE', 'VWCE.DE', 'SXR8.DE']

/** Live-Preis in Euro, sonst null */
const eurPrice = (q?: Quote) => (q ? (q.priceEur ?? (q.currency === 'EUR' ? q.price : null)) : null)

function Panel({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-white/8 bg-white/[0.03] p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function TradingTerminal() {
  const portfolios = useData('portfolios')
  const allTx = useData('transactions')
  const prices = useData('prices')
  const portfolio = portfolios.find((p) => p.kind === 'virtual')

  useEffect(() => {
    if (!portfolio && !actions().data.portfolios.some((p) => p.kind === 'virtual')) actions().add('portfolios', { name: 'Spieldepot', kind: 'virtual', startCash: 100_000 })
  }, [portfolio])
  const [params, setParams] = useSearchParams()
  const [picker, setPicker] = useState(false)
  const [startCash, setStartCash] = useState(100_000)

  const txs = useMemo(() => allTx.filter((t) => t.portfolioId === portfolio?.id), [allTx, portfolio?.id])
  const held = useMemo(() => [...new Set(txs.map((t) => t.symbol))], [txs])
  const [symbol, setSymbol] = useState(() => (params.get('wert') ?? 'SAP.DE').toUpperCase())
  const [name, setName] = useState(() => instrument(params.get('wert') ?? 'SAP.DE')?.name ?? params.get('wert') ?? 'SAP')
  useEffect(() => {
    const w = params.get('wert')
    if (w) {
      setSymbol(w.toUpperCase())
      setName(instrument(w)?.name ?? w)
      setParams({}, { replace: true })
    }
  }, [params, setParams])
  const symbols = useMemo(() => [...new Set([...TAPE, ...held, symbol])], [held, symbol])
  const q = useQuotes(symbols)
  const quotes = q.data?.quotes ?? null
  const live = !!quotes && /Finnhub/.test(q.data?.source ?? '')

  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [mode, setMode] = useState<'stueck' | 'betrag'>('betrag')
  const [amount, setAmount] = useState('1000')
  const [manualPrice, setManualPrice] = useState('')
  const [reset, setReset] = useState(false)

  if (!portfolio) return null
  const s = summarize(portfolio, allTx, prices, quotes)
  const total = s.value + (s.cash ?? 0)
  const perf = total / portfolio.startCash - 1

  const livePrice = eurPrice(quotes?.[symbol])
  const price = livePrice ?? parseNum(manualPrice)
  const pos = s.positions.find((p) => p.symbol === symbol)
  const n = parseNum(amount)
  const qty = mode === 'stueck' ? n : price > 0 ? Math.floor(((n - FEE) / price) * 100) / 100 : 0 // Bruchstücke auf 2 Stellen, passend zur Anzeige
  const cost = qty * price + (side === 'buy' ? FEE : -FEE)
  const valid = qty > 0 && price > 0 && (side === 'buy' ? cost <= (s.cash ?? 0) + 1e-6 : qty <= (pos?.qty ?? 0) + 1e-9)

  const choose = (sym: string, nm: string) => {
    setSymbol(sym.toUpperCase())
    setName(nm)
    setManualPrice('')
  }
  const selectedQuote = quotes?.[symbol]

  const execute = () => {
    if (!valid) return
    actions().add('transactions', { portfolioId: portfolio.id, symbol, name, type: side, date: todayKey(), qty, price, fees: FEE })
    toast(`${side === 'buy' ? 'Gekauft' : 'Verkauft'}: ${fmtNum(qty)} × ${name} zu ${fmtEur(price)}`, 'success')
  }

  const tape = TAPE.map((id) => ({ symbol: id, name: instrument(id)?.name ?? id, q: quotes?.[id] }))

  return (
    <div className="space-y-4">
    <div className="overflow-hidden rounded-[28px] bg-[#0a0f1c] text-white shadow-2xl ring-1 ring-white/10">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 bg-gradient-to-r from-[#111a33] to-[#0a0f1c] px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
            Börsenspiel · Spielgeld
            {live ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
              </span>
            ) : quotes ? (
              <span className="text-amber-300">Kurse verzögert</span>
            ) : (
              <span className="text-amber-300">Manuelle Kurse</span>
            )}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular">{fmtEur(total)}</p>
          <p className={cn('font-mono text-sm font-semibold tabular', perf >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {perf >= 0 ? '▲' : '▼'} {fmtPct(perf)} seit Start ({fmtEur(portfolio.startCash, true)})
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 font-mono text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Cash</p>
            <p className="font-semibold tabular">{fmtEur(s.cash ?? 0)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Investiert</p>
            <p className="font-semibold tabular">{fmtEur(s.value)}</p>
          </div>
        </div>
      </div>

      {/* Laufband */}
      <div className="relative overflow-hidden border-b border-white/8 py-2">
        <div className="flex w-max animate-ticker gap-8 whitespace-nowrap px-4 font-mono text-xs">
          {[...tape, ...tape].map((t, i) => (
            <button key={i} onClick={() => choose(t.symbol, t.name)} className="inline-flex items-center gap-2 hover:text-sky-300">
              <span className="font-bold text-white/80">{t.symbol.replace('.DE', '')}</span>
              {t.q ? (
                <>
                  <span className="tabular">{t.q.price.toFixed(2)}</span>
                  <span className={cn('tabular', (t.q.changePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{fmtPct(t.q.changePct ?? 0)}</span>
                </>
              ) : (
                <span className="text-white/30">—</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!quotes && !q.loading && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/8 bg-amber-400/10 px-5 py-2.5 text-sm text-amber-100">
          <Zap className="size-4 shrink-0" />
          <span className="flex-1">Gerade keine Kurse verfügbar – du kannst den Preis selbst eintragen.</span>
          <Link to="/profil#kurse" className="rounded-lg bg-amber-300 px-3 py-1.5 font-semibold text-black">
            Live-Kurse einschalten
          </Link>
        </div>
      )}

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[360px_1fr]">
        {/* Order-Maske */}
        <Panel title="Order">
          <button onClick={() => setPicker(true)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-left text-sm text-white/60 hover:border-sky-400">
            <Search className="size-4" /> Aus über 200 Aktien & ETFs wählen …
          </button>
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <p className="text-sm text-white/60">{name}</p>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-xl font-bold">{symbol}</p>
              {livePrice != null ? (
                <p className="font-mono text-xl font-bold tabular">{fmtEur(livePrice)}</p>
              ) : (
                <input
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="Preis €"
                  aria-label="Preis in Euro"
                  className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right font-mono outline-none focus:border-sky-400"
                />
              )}
            </div>
            {selectedQuote && livePrice != null && (
              <p className="mt-1 text-xs text-white/50">
                {selectedQuote.delayed === false ? 'Live-Kurs' : 'Verzögerter Kurs'}
                {selectedQuote.currency !== 'EUR' && ` · ${selectedQuote.price.toFixed(2)} ${selectedQuote.currency}`}
                {selectedQuote.changePct != null && ` · heute ${fmtPct(selectedQuote.changePct)}`}
              </p>
            )}
            {pos && <p className="mt-1 text-xs text-white/50">Im Bestand: {fmtNum(pos.qty)} Stück</p>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setSide('buy')} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl font-bold', side === 'buy' ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/60')}>
              <TrendingUp className="size-4" /> Kaufen
            </button>
            <button onClick={() => setSide('sell')} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl font-bold', side === 'sell' ? 'bg-rose-500 text-white' : 'bg-white/5 text-white/60')}>
              <TrendingDown className="size-4" /> Verkaufen
            </button>
          </div>
          <div className="mt-3 [&_[role=tablist]]:border-white/10 [&_[role=tablist]]:bg-white/5 [&_[aria-selected=false]]:text-white/50 [&_[aria-selected=true]]:bg-white/15 [&_[aria-selected=true]]:text-white">
            <Segmented className="w-full" size="sm" value={mode} onChange={setMode} options={[{ value: 'betrag', label: 'Betrag in €' }, { value: 'stueck', label: 'Stückzahl' }]} />
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-label={mode === 'betrag' ? 'Betrag in Euro' : 'Stückzahl'}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-lg outline-none focus:border-sky-400"
          />
          {side === 'sell' && pos && (
            <button className="mt-1 text-xs text-sky-300" onClick={() => { setMode('stueck'); setAmount(String(pos.qty)) }}>
              Alles verkaufen
            </button>
          )}
          <div className="mt-3 space-y-1 font-mono text-xs text-white/60">
            <p className="flex justify-between">
              <span>Stück</span>
              <span className="tabular">{qty > 0 ? fmtNum(qty) : '–'}</span>
            </p>
            <p className="flex justify-between">
              <span>Gebühr</span>
              <span className="tabular">{fmtEur(FEE)}</span>
            </p>
            <p className="flex justify-between text-sm font-bold text-white">
              <span>{side === 'buy' ? 'Gesamt' : 'Erlös'}</span>
              <span className="tabular">{qty > 0 && price > 0 ? fmtEur(Math.abs(cost)) : '–'}</span>
            </p>
          </div>
          <button
            onClick={execute}
            disabled={!valid}
            className={cn('mt-3 min-h-12 w-full rounded-xl font-bold transition active:scale-[0.98] disabled:opacity-40', side === 'buy' ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white')}
          >
            {side === 'buy' ? 'Kauforder ausführen' : 'Verkaufsorder ausführen'}
          </button>
          {!valid && qty > 0 && price > 0 && <p className="mt-2 text-xs text-rose-300">{side === 'buy' ? 'Nicht genug Spielgeld.' : 'So viele Stück hast du nicht.'}</p>}
        </Panel>

        <div className="space-y-3">
          <Panel title={`Positionen (${s.positions.length})`}>
            {s.positions.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">Noch keine Positionen. Wähle einen Wert im Laufband oder über die Suche.</p>
            ) : (
              <div className="divide-y divide-white/8">
                {s.positions.map((p) => (
                  <button key={p.symbol} onClick={() => choose(p.symbol, p.name)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="w-14 shrink-0 font-mono text-sm font-bold">{p.symbol}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.name}</span>
                      <span className="font-mono text-xs text-white/50">
                        {fmtNum(p.qty)} × Ø {fmtEur(p.avg)}
                      </span>
                    </span>
                    <span className="text-right font-mono">
                      <span className="block text-sm font-semibold tabular">{fmtEur(p.value ?? p.cost)}</span>
                      {p.gainPct != null ? (
                        <span className={cn('text-xs font-bold tabular', p.gainPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{fmtPct(p.gainPct)}</span>
                      ) : (
                        <span className="text-xs text-white/40">kein Kurs</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Orderbuch" action={q.fetchedAt && live ? <span className="text-[11px] text-white/40">Kurse {timeAgo(q.fetchedAt)}</span> : undefined}>
            {txs.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/50">Noch keine Orders.</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto font-mono text-xs">
                {[...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className={cn('w-12 font-bold', t.type === 'buy' ? 'text-emerald-400' : 'text-rose-400')}>{t.type === 'buy' ? 'KAUF' : 'VERK'}</span>
                    <span className="w-12 font-bold">{t.symbol}</span>
                    <span className="flex-1 text-white/60 tabular">
                      {fmtNum(t.qty)} × {fmtEur(t.price)}
                    </span>
                    <span className="text-white/40">{fmtDate(t.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="text-white/60 hover:bg-white/10 hover:text-white" icon={<RotateCcw className="size-4" />} onClick={() => { setStartCash(portfolio.startCash); setReset(true) }}>
              Neu starten / Startkapital ändern
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={reset}
        title="Spieldepot neu starten?"
        message={
          <div className="space-y-3">
            <p>Alle Spiel-Orders werden gelöscht. Mit wie viel Spielgeld möchtest du starten?</p>
            <div className="flex flex-wrap gap-2">
              {START_OPTIONS.map((v) => (
                <Chip key={v} active={startCash === v} onClick={() => setStartCash(v)}>
                  {fmtEur(v, true)}
                </Chip>
              ))}
            </div>
          </div>
        }
        confirmLabel="Neu starten"
        onConfirm={() => {
          actions().removeMany('transactions', txs.map((t) => t.id), 'Spieldepot neu gestartet')
          actions().update('portfolios', portfolio.id, { startCash })
        }}
        onClose={() => setReset(false)}
      />
      <InstrumentPicker open={picker} onClose={() => setPicker(false)} onPick={(i) => choose(i.id, i.name)} title="Wert für die Order" />
    </div>
    <DepotAnalysis portfolio={portfolio} transactions={allTx} prices={prices} quotes={quotes} />
    </div>
  )
}
