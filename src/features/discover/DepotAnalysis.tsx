import { useMemo, useState } from 'react'
import { Card, Segmented, SectionTitle, Skeleton } from '@/components/ui'
import { AreaChart, Donut, seriesColor } from '@/components/ui/charts'
import { COUNTRY_LABEL, instrument } from '@/data/instruments'
import type { ManualPrice, Portfolio, Transaction } from '@/data/types'
import { cn, fmtEur, fmtNum, fmtPct } from '@/lib/utils'
import { diffDays, fmtDate, todayKey } from '@/lib/dates'
import type { Quote } from '@/services/server'
import { summarize, type PortfolioSummary } from './portfolio'
import { useHistory, type HistoryFile } from './instruments-ui'

const BENCH = 'EUNL.DE' // iShares Core MSCI World

/** Faktor, um einen Kurs in Euro umzurechnen (aus dem aktuellen Kurs abgeleitet) */
function fxFactor(q?: Quote) {
  if (!q) return null
  if (q.currency === 'EUR') return 1
  return q.priceEur != null && q.price ? q.priceEur / q.price : null
}

export interface Analysis {
  s: PortfolioSummary
  todayEur: number | null
  valueSeries: { date: string; value: number; invested: number }[]
  allocation: Record<'position' | 'branche' | 'region' | 'art', { label: string; value: number }[]>
  risk: { vol: number; maxDD: number; best: [string, number]; worst: [string, number]; ret1y: number; from: string; weekly: boolean } | null
  bench: { ret1y: number; vol: number; from: string } | null
  rows: {
    symbol: string
    name: string
    qty: number
    weight: number
    value: number
    gain: number | null
    gainPct: number | null
    todayPct: number | null
    days: number
    source: string
  }[]
  tips: string[]
}

/** Perioden pro Jahr aus dem typischen Abstand der Datenpunkte (Wochenkurse ≈ 52, Tageskurse ≈ 252) */
export function periodsPerYear(dates: string[]) {
  const gaps = dates.slice(1).map((d, i) => (Date.parse(d) - Date.parse(dates[i])) / 864e5).sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)] ?? 1
  return median >= 5 ? 52 : 252
}

export function stats(returns: { date: string; r: number }[]) {
  if (returns.length < 15) return null
  const mean = returns.reduce((a, x) => a + x.r, 0) / returns.length
  const perYear = periodsPerYear(returns.map((x) => x.date))
  const vol = Math.sqrt(returns.reduce((a, x) => a + (x.r - mean) ** 2, 0) / (returns.length - 1)) * Math.sqrt(perYear)
  let peak = 1
  let level = 1
  let maxDD = 0
  for (const x of returns) {
    level *= 1 + x.r
    peak = Math.max(peak, level)
    maxDD = Math.min(maxDD, level / peak - 1)
  }
  const sorted = [...returns].sort((a, b) => a.r - b.r)
  return { vol, maxDD, ret1y: level - 1, from: returns[0].date, weekly: perYear === 52, best: [sorted[sorted.length - 1].date, sorted[sorted.length - 1].r] as [string, number], worst: [sorted[0].date, sorted[0].r] as [string, number] }
}

function dailyReturns(series: [string, number][]) {
  const out: { date: string; r: number }[] = []
  for (let i = 1; i < series.length; i++) out.push({ date: series[i][0], r: series[i][1] / series[i - 1][1] - 1 })
  return out
}

export function analyze(portfolio: Portfolio, txAll: Transaction[], prices: ManualPrice[], quotes: Record<string, Quote> | null, history: HistoryFile | null): Analysis {
  const s = summarize(portfolio, txAll, prices, quotes)
  const txs = txAll.filter((t) => t.portfolioId === portfolio.id).sort((a, b) => a.date.localeCompare(b.date))
  const total = s.value
  const today = todayKey()

  // Heute: Veränderung aller Positionen mit Tageskurs
  let todayEur: number | null = null
  for (const p of s.positions) {
    const q = quotes?.[p.symbol]
    if (!q || q.changePct == null || p.value == null) continue
    todayEur = (todayEur ?? 0) + p.value - p.value / (1 + q.changePct)
  }

  // Wertentwicklung: Bestand je Tag × Schlusskurs (in Euro)
  const valueSeries: Analysis['valueSeries'] = []
  if (history && txs.length) {
    const ids = [...new Set(txs.map((t) => t.symbol))]
    const dates = [...new Set(ids.flatMap((id) => (history.series[id] ?? []).map(([d]) => d)))].filter((d) => d >= txs[0].date).sort()
    const lastClose = new Map<string, number>()
    const closeAt = new Map(ids.map((id) => [id, new Map(history.series[id] ?? [])]))
    for (const d of dates) {
      const qty = new Map<string, number>()
      let invested = 0
      const costs = new Map<string, number>()
      for (const t of txs) {
        if (t.date > d) break
        const q0 = qty.get(t.symbol) ?? 0
        const c0 = costs.get(t.symbol) ?? 0
        if (t.type === 'buy') {
          qty.set(t.symbol, q0 + t.qty)
          costs.set(t.symbol, c0 + t.qty * t.price + t.fees)
        } else {
          const avg = q0 > 0 ? c0 / q0 : 0
          qty.set(t.symbol, Math.max(0, q0 - t.qty))
          costs.set(t.symbol, Math.max(0, c0 - avg * t.qty))
        }
      }
      invested = [...costs.values()].reduce((a, b) => a + b, 0)
      let value = 0
      let complete = true
      for (const [id, n] of qty) {
        if (n <= 0) continue
        const c = closeAt.get(id)?.get(d)
        if (c != null) lastClose.set(id, c)
        const close = lastClose.get(id)
        const fx = fxFactor(quotes?.[id])
        if (close == null || fx == null) {
          complete = false
          continue
        }
        value += n * close * fx
      }
      if (complete) valueSeries.push({ date: d, value: Math.round(value * 100) / 100, invested: Math.round(invested * 100) / 100 })
    }
  }

  // Aufteilung
  const group = (key: (sym: string) => string) => {
    const m = new Map<string, number>()
    for (const p of s.positions) m.set(key(p.symbol), (m.get(key(p.symbol)) ?? 0) + (p.value ?? p.cost))
    if (s.cash != null && s.cash > 0 && key === artKey) m.set('Cash', s.cash)
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }
  const artKey = (sym: string) => instrument(sym)?.type ?? 'Sonstiges'
  const allocation = {
    position: s.positions.map((p) => ({ label: p.name, value: p.value ?? p.cost })),
    branche: group((sym) => instrument(sym)?.sector ?? 'Sonstiges'),
    region: group((sym) => {
      const c = instrument(sym)?.country
      return c ? COUNTRY_LABEL[c] ?? c : 'Sonstiges'
    }),
    art: group(artKey),
  }

  // Risiko: aktuelles Depot (heutige Gewichte) über das letzte Jahr
  let risk: Analysis['risk'] = null
  if (history && total > 0) {
    const weights = s.positions.map((p) => ({ id: p.symbol, w: (p.value ?? p.cost) / total })).filter((x) => history.series[x.id]?.length)
    const covered = weights.reduce((a, x) => a + x.w, 0)
    if (weights.length && covered > 0.5) {
      const rets = weights.map((x) => ({ w: x.w / covered, map: new Map(dailyReturns(history.series[x.id]).map((r) => [r.date, r.r])) }))
      const dates = [...new Set(rets.flatMap((r) => [...r.map.keys()]))].sort()
      const port = dates.map((d) => ({ date: d, r: rets.reduce((a, x) => a + x.w * (x.map.get(d) ?? 0), 0) }))
      risk = stats(port)
    }
  }
  const benchSeries = history?.series[BENCH]
  const bs = benchSeries ? stats(dailyReturns(benchSeries)) : null
  const bench = bs ? { ret1y: bs.ret1y, vol: bs.vol, from: bs.from } : null

  // Positionen im Detail
  const firstBuy = new Map<string, string>()
  for (const t of txs) if (t.type === 'buy' && !firstBuy.has(t.symbol)) firstBuy.set(t.symbol, t.date)
  const rows = s.positions.map((p) => {
    const q = quotes?.[p.symbol]
    return {
      symbol: p.symbol,
      name: p.name,
      qty: p.qty,
      weight: total ? (p.value ?? p.cost) / total : 0,
      value: p.value ?? p.cost,
      gain: p.gain,
      gainPct: p.gainPct,
      todayPct: q?.changePct ?? null,
      days: firstBuy.has(p.symbol) ? diffDays(today, firstBuy.get(p.symbol)!) : 0,
      source: p.priceSource === 'live' ? (q?.delayed === false ? 'live' : 'verzögert') : p.priceSource === 'manuell' ? 'manuell' : 'Einstand',
    }
  })

  // Hinweise
  const tips: string[] = []
  const top = [...rows].sort((a, b) => b.weight - a.weight)
  if (top[0] && top[0].weight > 0.4) tips.push(`⚠️ Klumpenrisiko: ${top[0].name} macht ${fmtPct(top[0].weight).replace('+', '')} des Depots aus.`)
  const top3 = top.slice(0, 3).reduce((a, r) => a + r.weight, 0)
  if (rows.length > 3 && top3 > 0.7) tips.push(`ℹ️ Die drei größten Positionen machen ${fmtPct(top3).replace('+', '')} aus.`)
  if (allocation.branche.length === 1 && rows.length > 1) tips.push(`ℹ️ Alles in einer Branche (${allocation.branche[0].label}) – Branchenkrisen träfen das ganze Depot.`)
  if (!rows.some((r) => instrument(r.symbol)?.type === 'ETF') && rows.length > 0) tips.push('💡 Kein ETF im Depot – ein breiter Welt-ETF streut das Risiko über tausende Unternehmen.')
  if (risk && bench) tips.push(risk.vol > bench.vol * 1.3 ? `📈 Dein Depot schwankt deutlich stärker als der MSCI World (${fmtPct(risk.vol).replace('+', '')} vs. ${fmtPct(bench.vol).replace('+', '')} p. a.).` : `✅ Die Schwankung liegt im Rahmen des MSCI World.`)
  if (s.unpriced > 0) tips.push(`ℹ️ ${s.unpriced} Position(en) ohne Kurs – dort zählt der Einstand.`)
  if (s.fees > 0 && s.invested > 0 && s.fees / s.invested > 0.01) tips.push(`💸 Gebühren: ${fmtPct(s.fees / s.invested).replace('+', '')} deines Einsatzes.`)

  return { s, todayEur, valueSeries, allocation, risk, bench, rows, tips }
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <p className={cn('font-display text-xl font-bold tabular', tone === 'up' && 'text-success', tone === 'down' && 'text-danger')}>{value}</p>
      {sub && <p className="text-xs text-muted tabular">{sub}</p>}
    </div>
  )
}

export function DepotAnalysis({ portfolio, transactions, prices, quotes }: { portfolio: Portfolio; transactions: Transaction[]; prices: ManualPrice[]; quotes: Record<string, Quote> | null }) {
  const history = useHistory()
  const [alloc, setAlloc] = useState<'position' | 'branche' | 'region' | 'art'>('branche')
  const a = useMemo(() => analyze(portfolio, transactions, prices, quotes, history.data ?? null), [portfolio, transactions, prices, quotes, history.data])
  const { s } = a
  if (s.positions.length === 0) return null
  const gain = s.value - s.invested
  const total = s.value + (s.cash ?? 0)
  const allocData = a.allocation[alloc]

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <SectionTitle>Depot-Analyse</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label={s.cash != null ? 'Gesamt inkl. Cash' : 'Depotwert'} value={fmtEur(total, true)} sub={s.cash != null ? `Cash ${fmtEur(s.cash, true)}` : `${s.positions.length} Positionen`} />
          <Kpi label="Gewinn / Verlust" value={`${gain >= 0 ? '+' : ''}${fmtEur(gain, true)}`} sub={s.invested ? fmtPct(gain / s.invested) : undefined} tone={gain >= 0 ? 'up' : 'down'} />
          <Kpi label="Heute" value={a.todayEur == null ? '–' : `${a.todayEur >= 0 ? '+' : ''}${fmtEur(a.todayEur, true)}`} sub={a.todayEur != null && s.value ? fmtPct(a.todayEur / (s.value - a.todayEur)) : 'kein Tageskurs'} tone={a.todayEur == null ? undefined : a.todayEur >= 0 ? 'up' : 'down'} />
          <Kpi label="Einstand" value={fmtEur(s.invested, true)} sub={`Gebühren ${fmtEur(s.fees, true)}`} />
          <Kpi label="Realisiert" value={fmtEur(s.realized, true)} tone={s.realized > 0 ? 'up' : s.realized < 0 ? 'down' : undefined} sub={s.closed.length ? `${s.closed.length} geschlossene Position(en)` : undefined} />
          <Kpi label="Größte Position" value={fmtPct([...a.rows].sort((x, y) => y.weight - x.weight)[0]?.weight ?? 0).replace('+', '')} sub={[...a.rows].sort((x, y) => y.weight - x.weight)[0]?.name} />
          <Kpi label="Schwankung p. a." value={a.risk ? fmtPct(a.risk.vol).replace('+', '') : '–'} sub={a.bench ? `MSCI World ${fmtPct(a.bench.vol).replace('+', '')}` : undefined} />
          <Kpi label="Max. Rückgang" value={a.risk ? fmtPct(a.risk.maxDD) : '–'} sub={a.risk ? 'mit heutiger Gewichtung' : 'Verlauf baut sich auf'} tone={a.risk ? 'down' : undefined} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionTitle>Wertentwicklung</SectionTitle>
          {history.loading && !history.data ? (
            <Skeleton className="h-52 w-full" />
          ) : a.valueSeries.length > 2 ? (
            <AreaChart
              points={a.valueSeries}
              series={[
                { key: 'value', label: 'Depotwert', color: seriesColor(0) },
                { key: 'invested', label: 'Eingezahlt (Einstand)', color: seriesColor(1) },
              ]}
              stacked={false}
              height={200}
              xLabel={(p) => fmtDate(String(p.date), { day: 'numeric', month: 'short', year: '2-digit' })}
              format={(v) => fmtEur(v, true)}
            />
          ) : (
            <p className="text-sm text-muted">Der Verlauf baut sich auf: Dailybase merkt sich ab jetzt jeden Tag die Kurse deiner Werte. Nach ein paar Handelstagen erscheint hier die Entwicklung, nach etwa drei Wochen auch Schwankung und maximaler Rückgang.</p>
          )}
          {a.risk && a.bench && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-surface-2 p-2.5">
                <p className="text-xs text-muted">Heutiges Depot seit {fmtDate(a.risk.from, { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                <p className={cn('font-bold tabular', a.risk.ret1y >= 0 ? 'text-success' : 'text-danger')}>{fmtPct(a.risk.ret1y)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-2.5">
                <p className="text-xs text-muted">MSCI World (EUNL) seit {fmtDate(a.bench.from, { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                <p className={cn('font-bold tabular', a.bench.ret1y >= 0 ? 'text-success' : 'text-danger')}>{fmtPct(a.bench.ret1y)}</p>
              </div>
            </div>
          )}
          {a.risk && (
            <p className="mt-2 text-xs text-muted">
              {a.risk.weekly ? 'Beste Woche' : 'Bester Tag'} {fmtPct(a.risk.best[1])} ({fmtDate(a.risk.best[0])}), {a.risk.weekly ? 'schlechteste Woche' : 'schlechtester Tag'} {fmtPct(a.risk.worst[1])} ({fmtDate(a.risk.worst[0])}).
            </p>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Aufteilung</h2>
            <Segmented size="sm" value={alloc} onChange={setAlloc} options={[{ value: 'branche', label: 'Branche' }, { value: 'region', label: 'Region' }, { value: 'art', label: 'Art' }, { value: 'position', label: 'Werte' }]} />
          </div>
          <Donut slices={allocData} format={(v) => fmtEur(v, true)} centerLabel="Gesamt" centerValue={fmtEur(allocData.reduce((x, y) => x + y.value, 0), true)} />
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="p-3">Wert</th>
              <th className="p-3 text-right">Anteil</th>
              <th className="p-3 text-right">Wert</th>
              <th className="p-3 text-right">Heute</th>
              <th className="p-3 text-right">Gesamt</th>
              <th className="p-3 text-right">G/V</th>
              <th className="p-3 text-right">Gehalten</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {[...a.rows]
              .sort((x, y) => y.weight - x.weight)
              .map((r) => (
                <tr key={r.symbol} className="border-t border-line">
                  <td className="p-3">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-muted">
                      {fmtNum(r.qty)} Stk. · Kurs {r.source}
                    </p>
                  </td>
                  <td className="p-3 text-right">{fmtPct(r.weight).replace('+', '')}</td>
                  <td className="p-3 text-right font-semibold">{fmtEur(r.value)}</td>
                  <td className={cn('p-3 text-right', r.todayPct != null && (r.todayPct >= 0 ? 'text-success' : 'text-danger'))}>{r.todayPct != null ? fmtPct(r.todayPct) : '–'}</td>
                  <td className={cn('p-3 text-right font-semibold', r.gainPct != null && (r.gainPct >= 0 ? 'text-success' : 'text-danger'))}>{r.gainPct != null ? fmtPct(r.gainPct) : '–'}</td>
                  <td className={cn('p-3 text-right', r.gain != null && (r.gain >= 0 ? 'text-success' : 'text-danger'))}>{r.gain != null ? fmtEur(r.gain) : '–'}</td>
                  <td className="p-3 text-right text-muted">{r.days} T.</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      {a.tips.length > 0 && (
        <Card className="p-4 sm:p-5">
          <SectionTitle>Hinweise</SectionTitle>
          <ul className="space-y-1.5 text-sm">
            {a.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">Automatische Auswertung deiner Daten, keine Anlageberatung.</p>
        </Card>
      )}
    </div>
  )
}
