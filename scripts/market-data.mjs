// Kurse für alle Werte aus src/data/instruments.json – kostenlos über Stooq (ohne Schlüssel,
// leicht verzögert). Läuft in der GitHub Action (scripts/fetch-data.mjs).
// - quotes.json: letzter Kurs, Veränderung zum Vortag, Euro-Kurs
// - history.json: ein Jahr Tagesschlusskurse (für Depot-Entwicklung, Risiko & Charts)
import { readFileSync } from 'node:fs'

const UA = 'Dailybase/0.1 (persoenliche App)'
export const instruments = JSON.parse(readFileSync(new URL('../src/data/instruments.json', import.meta.url), 'utf8'))

async function text(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.text()
  } finally {
    clearTimeout(t)
  }
}

/** CSV mit Kopfzeile → Objekte */
export function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v.trim()])))
}

const num = (v) => (v == null || v === '' || /n\/d/i.test(v) ? null : Number(v))

/** Letzte Kurse in Paketen; fehlende Werte einzeln nachladen */
export async function fetchQuotes(list) {
  const result = new Map()
  for (let i = 0; i < list.length; i += 40) {
    const chunk = list.slice(i, i + 40)
    try {
      const csv = await text(`https://stooq.com/q/l/?s=${chunk.map((x) => x.stooq).join(',')}&f=sd2t2ohlcv&h&e=csv`)
      for (const row of parseCsv(csv)) {
        const inst = chunk.find((x) => x.stooq === (row.symbol || '').toLowerCase())
        const close = num(row.close)
        if (inst && close) result.set(inst.id, { close, date: row.date, time: row.time })
      }
    } catch {
      /* einzeln versuchen */
    }
  }
  const missing = list.filter((x) => !result.has(x.id))
  for (const inst of missing.slice(0, 60)) {
    try {
      const [row] = parseCsv(await text(`https://stooq.com/q/l/?s=${inst.stooq}&f=sd2t2ohlcv&h&e=csv`))
      const close = num(row?.close)
      if (close) result.set(inst.id, { close, date: row.date, time: row.time })
    } catch {
      /* bleibt fehlend */
    }
  }
  return result
}

/** Kurze Probeabfrage: Antwortet Stooq überhaupt mit Kursdaten? */
export async function probe() {
  try {
    const body = await text('https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv')
    const [row] = parseCsv(body)
    return { ok: !!num(row?.close), sample: body.slice(0, 160) }
  } catch (e) {
    return { ok: false, sample: String(e.message || e) }
  }
}

/** Ein Jahr Tagesschlusskurse (parallel, aber schonend, mit Zeitbudget) */
export async function fetchHistory(list, days = 370, budgetMs = 5 * 60e3) {
  const deadline = Date.now() + budgetMs
  const to = new Date()
  const from = new Date(Date.now() - days * 86400e3)
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
  const series = {}
  const queue = [...list]
  async function worker() {
    for (let inst = queue.shift(); inst && Date.now() < deadline; inst = queue.shift()) {
      try {
        const rows = parseCsv(await text(`https://stooq.com/q/d/l/?s=${inst.stooq}&d1=${fmt(from)}&d2=${fmt(to)}&i=d`))
        const s = rows.filter((r) => num(r.close)).map((r) => [r.date, Math.round(num(r.close) * 10000) / 10000])
        if (s.length) series[inst.id] = s
      } catch {
        /* ohne Verlauf */
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  return series
}

export async function fetchFx() {
  const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR', { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Frankfurter HTTP ${r.status}`)
  return r.json() // { date, rates: { USD: 1.08, … } }
}

/** quotes.json im Format der App (QuotesResponse) */
export function buildQuotes(latest, history, fx) {
  const quotes = {}
  const errors = []
  for (const inst of instruments) {
    const q = latest.get(inst.id)
    if (!q) {
      errors.push(`${inst.id}: keine Daten`)
      continue
    }
    const s = history[inst.id] ?? []
    const prev = [...s].reverse().find(([d]) => d < q.date)?.[1] ?? null
    const rate = inst.currency === 'EUR' ? 1 : fx?.rates?.[inst.currency]
    quotes[inst.id] = {
      symbol: inst.id,
      price: q.close,
      change: prev ? Math.round((q.close - prev) * 10000) / 10000 : null,
      changePct: prev ? q.close / prev - 1 : null,
      currency: inst.currency,
      priceEur: rate ? Math.round((q.close / rate) * 10000) / 10000 : null,
      at: new Date(`${q.date}T${/^\d\d:\d\d/.test(q.time || '') ? q.time : '17:30:00'}Z`).toISOString(),
    }
  }
  return { source: 'Stooq (verzögert)', quotes, errors, fetchedAt: new Date().toISOString(), fxDate: fx?.date ?? null }
}
