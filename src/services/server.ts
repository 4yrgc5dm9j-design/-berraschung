import { getJson } from './remote'

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

export const fetchStatus = () => getJson<ServerStatus>('/api/status', 5000)
export const fetchNews = (topics: string[]) => getJson<NewsResponse>(`/api/news?topics=${topics.join(',')}`, 20000)
export const fetchQuotes = (symbols: string[]) =>
  getJson<QuotesResponse>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, 15000)
export const searchSymbols = (q: string) => getJson<{ results: SymbolHit[] }>(`/api/symbols?q=${encodeURIComponent(q)}`)
export const fetchPreview = (url: string) => getJson<PreviewResponse>(`/api/preview?url=${encodeURIComponent(url)}`, 12000)
