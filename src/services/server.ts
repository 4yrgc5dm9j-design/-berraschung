import { ApiError, getJson } from './remote'
import { fetchFx, fetchQuotesDirect, searchSymbolsDirect, toEur } from './quotes'
import { loadSheet } from './googleSheet'
import { usePriceHistory } from '@/data/priceHistory'
import { useApp } from '@/data/store'

/** true in der statischen Web-Version (z. B. GitHub Pages) – dort läuft kein Dailybase-Server. */
export const STATIC_HOSTING = import.meta.env.VITE_STATIC === '1'

function api<T>(path: string, timeoutMs?: number): Promise<T> {
  if (STATIC_HOSTING) return Promise.reject(new ApiError('In der Web-Version ohne eigenen Dailybase-Server nicht verfügbar', 'no-server'))
  return getJson<T>(`/api/${path}`, timeoutMs)
}

/**
 * Daten, die in der Web-Version regelmäßig per GitHub Action erzeugt werden (dist/data/…).
 * Der Zeitbaustein umgeht den 10-Minuten-Cache von GitHub Pages.
 */
export function staticData<T>(file: string, timeoutMs?: number): Promise<T> {
  const bucket = Math.floor(Date.now() / 300000)
  return getJson<T>(`${import.meta.env.BASE_URL}data/${file}?v=${bucket}`, timeoutMs)
}

interface StaticStatus {
  fetchedAt: string
  news: { source: string; ok: boolean }[]
}

// Endpunkte des Dailybase-Servers (server/index.mjs). Hier liegen alle
// Abfragen, die Schlüssel brauchen oder wegen CORS nicht direkt gehen.

export interface ServerStatus {
  ok: boolean
  mode?: 'server' | 'static'
  dataAt?: string
  version: string
  news: { sources: string[] }
  quotes: { provider: string | null }
  preview: boolean
}

export interface NewsItem {
  id: string
  title: string
  link: string
  source: string
  publishedAt: string | null
  topic: string
  summary: string
  image: string | null
}

export interface NewsResponse {
  items: NewsItem[]
  fetchedAt: string
  errors: { source: string; message: string }[]
}

export interface Quote {
  symbol: string
  price: number
  change: number | null
  changePct: number | null
  currency: string
  /** Kurs in Euro (umgerechnet mit EZB-Referenzkurs), falls möglich */
  priceEur?: number | null
  at: string
  /** live (Finnhub) oder verzögert (Google Finanzen) */
  delayed?: boolean
}

export interface QuotesResponse {
  source: string
  quotes: Record<string, Quote>
  errors: string[]
  fetchedAt: string
  fxDate?: string | null
}

export interface SymbolHit {
  symbol: string
  name: string
  type: string
}

export interface PreviewResponse {
  title?: string
  description?: string
  image?: string
  siteName?: string
  unsupported?: boolean
  reason?: string
}

export const fetchStatus = async (): Promise<ServerStatus> => {
  if (!STATIC_HOSTING) return { ...(await api<ServerStatus>('status', 5000)), mode: 'server' }
  const s = await staticData<StaticStatus>('status.json', 8000)
  return { ok: true, mode: 'static', dataAt: s.fetchedAt, version: '', news: { sources: [...new Set(s.news.filter((n) => n.ok).map((n) => n.source))] }, quotes: { provider: null }, preview: false }
}
export const fetchNews = async (topics: string[]): Promise<NewsResponse> => {
  if (!STATIC_HOSTING) return api<NewsResponse>(`news?topics=${topics.join(',')}`, 20000)
  const all = await staticData<NewsResponse>('news.json', 20000)
  return { ...all, items: all.items.filter((i) => topics.includes(i.topic)) }
}
const noQuotes = () => Promise.reject(new ApiError('Keine Kursquelle eingerichtet – unter Profil → Börsenkurse einmalig die Google-Tabelle verbinden.', 'not_configured'))
const userKey = () => useApp.getState().settings.finnhubKey.trim()
const sheetUrl = () => useApp.getState().settings.googleSheetUrl.trim()

/** Kurse aus der veröffentlichten Google-Tabelle (GOOGLEFINANCE, bis zu 20 Min. verzögert) */
async function fetchSheetQuotes(symbols: string[], url: string): Promise<QuotesResponse> {
  const [sheet, fx] = await Promise.all([loadSheet(url), fetchFx().catch(() => null)])
  const quotes: Record<string, Quote> = {}
  const at = new Date().toISOString()
  for (const sym of symbols) {
    const r = sheet.quotes[sym.toUpperCase()]
    if (!r) continue
    const change = r.closeyest ? r.price - r.closeyest : null
    quotes[sym] = { symbol: sym, price: r.price, change, changePct: r.closeyest ? r.price / r.closeyest - 1 : null, currency: r.currency, priceEur: toEur(r.price, r.currency, fx), at, delayed: true }
  }
  return { source: 'Google Finanzen', quotes, errors: [], fetchedAt: at, fxDate: fx?.date ?? null }
}

/**
 * Kurse zusammenführen:
 * 1) eigene Google-Tabelle: verzögerte Kurse aller bekannten Werte (auch Xetra)
 * 2) mit eigenem Finnhub-Schlüssel: Live-Kurse für US-Werte darüber legen
 * 3) lokaler Server mit Schlüssel als Alternative
 * Jeder abgerufene Kurs wandert zusätzlich in den eigenen Tagesverlauf.
 */
export async function fetchQuotes(symbols: string[]): Promise<QuotesResponse> {
  const key = userKey()
  const url = sheetUrl()
  const [base, live] = await Promise.all([
    url ? fetchSheetQuotes(symbols, url).catch((e) => e as Error) : Promise.resolve(null),
    key ? fetchQuotesDirect(symbols.filter((s) => !s.includes('.')), key).catch((e) => e as Error) : Promise.resolve(null),
  ])
  if (!base && !live && !STATIC_HOSTING) return api<QuotesResponse>(`quotes?symbols=${encodeURIComponent(symbols.join(','))}`, 15000)
  const baseOk = base && !(base instanceof Error) ? base : null
  const liveOk = live && !(live instanceof Error) ? live : null
  if (!baseOk && !liveOk) {
    if (base instanceof Error) throw base
    if (live instanceof Error) throw live
    return noQuotes()
  }
  const quotes: Record<string, Quote> = {}
  for (const sym of symbols) if (baseOk?.quotes[sym]) quotes[sym] = baseOk.quotes[sym]
  if (liveOk) for (const [sym, q] of Object.entries(liveOk.quotes)) quotes[sym] = { ...q, delayed: false }
  usePriceHistory.getState().record(Object.fromEntries(Object.entries(quotes).map(([sym, q]) => [sym.toUpperCase(), q.price])))
  const errors = symbols.filter((s) => !quotes[s]).map((s) => `${s}: kein Kurs verfügbar`)
  if (base instanceof Error) errors.unshift(`Google-Tabelle: ${base.message}`)
  return {
    source: liveOk ? (baseOk ? 'Finnhub (live) + Google Finanzen (verzögert)' : 'Finnhub (live)') : 'Google Finanzen (bis 20 Min. verzögert)',
    quotes,
    errors,
    fetchedAt: baseOk?.fetchedAt ?? liveOk?.fetchedAt ?? new Date().toISOString(),
    fxDate: baseOk?.fxDate ?? liveOk?.fxDate ?? null,
  }
}
export const searchSymbols = (q: string): Promise<{ results: SymbolHit[] }> =>
  userKey() ? searchSymbolsDirect(q, userKey()) : STATIC_HOSTING ? noQuotes() : api<{ results: SymbolHit[] }>(`symbols?q=${encodeURIComponent(q)}`)
export const fetchPreview = (url: string): Promise<PreviewResponse> =>
  STATIC_HOSTING ? Promise.reject(new ApiError('Automatische Vorschauen gibt es nur mit eigenem Dailybase-Server. Titel und Foto kannst du selbst ergänzen.', 'no-server')) : api<PreviewResponse>(`preview?url=${encodeURIComponent(url)}`, 12000)
