import type { ManualPrice, Portfolio, Transaction } from '@/data/types'
import type { Quote } from '@/services/server'

export interface Position {
  symbol: string
  name: string
  qty: number
  cost: number // Einstand inkl. Gebühren (Durchschnittskostenmethode)
  avg: number
  price: number | null
  priceSource: 'manuell' | 'live' | null
  priceAt: string | null
  value: number | null
  gain: number | null
  gainPct: number | null
}

export interface PortfolioSummary {
  positions: Position[]
  closed: { symbol: string; name: string; realized: number }[]
  invested: number
  value: number // nur Positionen mit Kurs, sonst Einstand
  unpriced: number
  realized: number
  fees: number
  cash: number | null // nur Spieldepot
  history: { date: string; invested: number }[]
}

export function summarize(
  portfolio: Portfolio,
  transactions: Transaction[],
  manual: ManualPrice[],
  quotes: Record<string, Quote> | null,
): PortfolioSummary {
  const txs = transactions.filter((t) => t.portfolioId === portfolio.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const map = new Map<string, { name: string; qty: number; cost: number; realized: number }>()
  let cash = portfolio.startCash
  let fees = 0
  let realized = 0
  const history: { date: string; invested: number }[] = []

  for (const t of txs) {
    const p = map.get(t.symbol) ?? { name: t.name, qty: 0, cost: 0, realized: 0 }
    p.name = t.name || p.name
    fees += t.fees
    if (t.type === 'buy') {
      p.qty += t.qty
      p.cost += t.qty * t.price + t.fees
      cash -= t.qty * t.price + t.fees
    } else {
      const q = Math.min(t.qty, p.qty)
      const avg = p.qty > 0 ? p.cost / p.qty : 0
      const r = q * t.price - t.fees - avg * q
      p.realized += r
      realized += r
      p.cost -= avg * q
      p.qty -= q
      cash += q * t.price - t.fees
    }
    if (p.qty < 1e-9) {
      p.qty = 0
      p.cost = 0
    }
    map.set(t.symbol, p)
    const invested = [...map.values()].reduce((a, x) => a + x.cost, 0)
    if (history.length && history[history.length - 1].date === t.date) history[history.length - 1].invested = invested
    else history.push({ date: t.date, invested })
  }

  const positions: Position[] = []
  const closed: PortfolioSummary['closed'] = []
  for (const [symbol, p] of map) {
    if (p.qty <= 0) {
      closed.push({ symbol, name: p.name, realized: p.realized })
      continue
    }
    const m = manual.find((x) => x.id === symbol)
    const q = quotes?.[symbol]
    // Depot rechnet in EUR: Live-Kurse nur verwenden, wenn sie in EUR vorliegen.
    const price = m ? m.price : q && q.currency === 'EUR' ? q.price : null
    const value = price != null ? price * p.qty : null
    positions.push({
      symbol,
      name: p.name,
      qty: p.qty,
      cost: p.cost,
      avg: p.cost / p.qty,
      price,
      priceSource: m ? 'manuell' : price != null ? 'live' : null,
      priceAt: m ? m.updatedAt : q?.at ?? null,
      value,
      gain: value != null ? value - p.cost : null,
      gainPct: value != null && p.cost > 0 ? (value - p.cost) / p.cost : null,
    })
  }
  positions.sort((a, b) => (b.value ?? b.cost) - (a.value ?? a.cost))
  const invested = positions.reduce((a, p) => a + p.cost, 0)
  const value = positions.reduce((a, p) => a + (p.value ?? p.cost), 0)
  return {
    positions,
    closed,
    invested,
    value,
    unpriced: positions.filter((p) => p.price == null).length,
    realized,
    fees,
    cash: portfolio.kind === 'virtual' ? cash : null,
    history,
  }
}

/** Sparplan mit monatlicher Einzahlung und Zinseszins. */
export function savingsPlan(opts: { start: number; monthly: number; years: number; ratePct: number; dynamicPct: number; inflationPct: number }) {
  const r = Math.pow(1 + opts.ratePct / 100, 1 / 12) - 1
  let value = opts.start
  let deposits = opts.start
  let monthly = opts.monthly
  const rows: { year: number; deposits: number; gains: number; value: number; real: number }[] = [{ year: 0, deposits, gains: 0, value, real: value }]
  for (let y = 1; y <= opts.years; y++) {
    for (let m = 0; m < 12; m++) {
      value = value * (1 + r) + monthly
      deposits += monthly
    }
    const real = value / Math.pow(1 + opts.inflationPct / 100, y)
    rows.push({ year: y, deposits, gains: value - deposits, value, real })
    monthly *= 1 + opts.dynamicPct / 100
  }
  return rows
}
