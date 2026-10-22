import { ApiError, getJson } from './remote'
import type { Quote, QuotesResponse, SymbolHit } from './server'

// Live-Kurse direkt aus dem Browser über Finnhub (kostenloser Plan, persönlicher Schlüssel).
// Der Schlüssel wird nur lokal auf dem Gerät gespeichert – nie im Code oder Repository.
// Umrechnung in Euro mit den Referenzkursen der EZB über Frankfurter (kostenlos, ohne Schlüssel).

const FINNHUB = 'https://finnhub.io/api/v1'

/** Währung anhand der Börsenendung (Finnhub liefert sie beim Kurs nicht mit). */
export function quoteCurrency(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s.includes(':')) return s.endsWith('USDT') || s.endsWith('USD') ? 'USD' : s.endsWith('EUR') ? 'EUR' : 'USD'
  const suffix = s.includes('.') ? s.split('.').pop()! : ''
  if (['DE', 'F', 'PA', 'AS', 'MI', 'MC', 'BR', 'VI', 'HE', 'LS', 'IR'].includes(suffix)) return 'EUR'
  if (suffix === 'L') return 'GBP'
  if (suffix === 'SW') return 'CHF'
  if (['ST'].includes(suffix)) return 'SEK'
  if (suffix === 'CO') return 'DKK'
  if (suffix === 'TO' || suffix === 'V') return 'CAD'
  return 'USD'
}

interface FxRates {
  date: string
  rates: Record<string, number> // 1 EUR = x Fremdwährung
}

let fxCache: { at: number; value: FxRates } | null = null

export async function fetchFx(): Promise<FxRates> {
  if (fxCache && Date.now() - fxCache.at < 3 * 3600e3) return fxCache.value
  const r = await getJson<{ date: string; rates: Record<string, number> }>('https://api.frankfurter.dev/v1/latest?base=EUR', 10000)
  fxCache = { at: Date.now(), value: { date: r.date, rates: r.rates } }
  return fxCache.value
}

export function toEur(price: number, currency: string, fx: FxRates | null): number | null {
  if (currency === 'EUR') return price
  const rate = fx?.rates[currency]
  return rate ? price / rate : null
}

async function finnhub<T>(path: string, key: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  let res: Response
  try {
    res = await fetch(`${FINNHUB}/${path}${sep}token=${encodeURIComponent(key)}`)
  } catch {
    throw new ApiError(navigator.onLine === false ? 'Keine Internetverbindung' : 'Finnhub nicht erreichbar', 'network')
  }
  if (res.status === 401) throw new ApiError('Finnhub-Schlüssel ungültig – bitte unter Profil prüfen.', 'auth')
  if (res.status === 403) throw new ApiError('Nicht im kostenlosen Finnhub-Plan (meist Börsen außerhalb der USA).', 'plan')
  if (res.status === 429) throw new ApiError('Zu viele Abfragen – Finnhub erlaubt 60 pro Minute.', 'limit')
  if (!res.ok) throw new ApiError(`Finnhub-Fehler ${res.status}`, 'http')
  return res.json() as Promise<T>
}

interface FinnhubQuote {
  c: number
  d: number | null
  dp: number | null
  t: number
}

export async function fetchQuotesDirect(symbols: string[], key: string): Promise<QuotesResponse> {
  const fx = await fetchFx().catch(() => null)
  const quotes: Record<string, Quote> = {}
  const errors: string[] = []
  let fatal: ApiError | null = null
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await finnhub<FinnhubQuote>(`quote?symbol=${encodeURIComponent(symbol)}`, key)
        if (!q || !q.c) throw new ApiError('Symbol unbekannt oder keine Kurse', 'empty')
        const currency = quoteCurrency(symbol)
        quotes[symbol] = {
          symbol,
          price: q.c,
          change: q.d ?? null,
          changePct: q.dp != null ? q.dp / 100 : null,
          currency,
          priceEur: toEur(q.c, currency, fx),
          at: new Date((q.t || Date.now() / 1000) * 1000).toISOString(),
        }
      } catch (e) {
        const err = e as ApiError
        if (err.code === 'auth' || err.code === 'network' || err.code === 'limit') fatal = err
        errors.push(`${symbol}: ${err.message}`)
      }
    }),
  )
  if (fatal && Object.keys(quotes).length === 0) throw fatal
  return { source: 'Finnhub', quotes, errors, fetchedAt: new Date().toISOString(), fxDate: fx?.date ?? null }
}

export async function searchSymbolsDirect(q: string, key: string): Promise<{ results: SymbolHit[] }> {
  const r = await finnhub<{ result?: { symbol: string; description: string; type: string }[] }>(`search?q=${encodeURIComponent(q)}`, key)
  return { results: (r.result ?? []).slice(0, 15).map((x) => ({ symbol: x.symbol, name: x.description, type: x.type })) }
}

/** Schlüssel testen: liefert den Apple-Kurs oder wirft einen verständlichen Fehler. */
export async function testFinnhubKey(key: string): Promise<number> {
  const q = await finnhub<FinnhubQuote>('quote?symbol=AAPL', key)
  if (!q.c) throw new ApiError('Keine Daten erhalten', 'empty')
  return q.c
}
