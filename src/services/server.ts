import { ApiError, getJson } from './remote'

/** true in der statischen Web-Version (z. B. GitHub Pages) – dort läuft kein Dailybase-Server. */
export const STATIC_HOSTING = import.meta.env.VITE_STATIC === '1'

function api<T>(path: string, timeoutMs?: number): Promise<T> {
  if (STATIC_HOSTING) return Promise.reject(new ApiError('In der Web-Version ohne eigenen Dailybase-Server nicht verfügbar', 'no-server'))
  return getJson<T>(`/api/${path}`, timeoutMs)
}

// Endpunkte des Dailybase-Servers (server/index.mjs). Hier liegen alle
// Abfragen, die Schlüssel brauchen oder wegen CORS nicht direkt gehen.

export interface ServerStatus {
  ok: boolean
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
  at: string
}

export interface QuotesResponse {
  source: string
  quotes: Record<string, Quote>
  errors: string[]
  fetchedAt: string
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

export const fetchStatus = () => api<ServerStatus>('status', 5000)
export const fetchNews = (topics: string[]) => api<NewsResponse>(`news?topics=${topics.join(',')}`, 20000)
export const fetchQuotes = (symbols: string[]) =>
  api<QuotesResponse>(`quotes?symbols=${encodeURIComponent(symbols.join(','))}`, 15000)
export const searchSymbols = (q: string) => api<{ results: SymbolHit[] }>(`symbols?q=${encodeURIComponent(q)}`)
export const fetchPreview = (url: string) => api<PreviewResponse>(`preview?url=${encodeURIComponent(url)}`, 12000)
