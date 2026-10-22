import { ApiError, getJson } from './remote'
import { fetchQuotesDirect, searchSymbolsDirect } from './quotes'
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
const noQuotes = () => Promise.reject(new ApiError('Keine Kursquelle eingerichtet – Kurse pflegst du manuell.', 'not_configured'))
const userKey = () => useApp.getState().settings.finnhubKey.trim()

/** Eigener Schlüssel im Profil → direkt aus dem Browser; sonst eigener Server (falls vorhanden). */
export const fetchQuotes = (symbols: string[]): Promise<QuotesResponse> =>
  userKey() ? fetchQuotesDirect(symbols, userKey()) : STATIC_HOSTING ? noQuotes() : api<QuotesResponse>(`quotes?symbols=${encodeURIComponent(symbols.join(','))}`, 15000)
export const searchSymbols = (q: string): Promise<{ results: SymbolHit[] }> =>
  userKey() ? searchSymbolsDirect(q, userKey()) : STATIC_HOSTING ? noQuotes() : api<{ results: SymbolHit[] }>(`symbols?q=${encodeURIComponent(q)}`)
export const fetchPreview = (url: string): Promise<PreviewResponse> =>
  STATIC_HOSTING ? Promise.reject(new ApiError('Automatische Vorschauen gibt es nur mit eigenem Dailybase-Server. Titel und Foto kannst du selbst ergänzen.', 'no-server')) : api<PreviewResponse>(`preview?url=${encodeURIComponent(url)}`, 12000)
