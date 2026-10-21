import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Kleiner Daten-Hook für externe Quellen:
 * - merkt sich die letzte erfolgreiche Antwort (localStorage), damit offline
 *   der letzte Stand mit Zeitstempel angezeigt werden kann
 * - liefert Lade- und Fehlerzustand
 */
export interface Remote<T> {
  data: T | null
  fetchedAt: string | null
  loading: boolean
  error: string | null
  stale: boolean // Daten stammen aus dem Cache, aktuelle Abfrage fehlgeschlagen
  reload: () => void
}

const memory = new Map<string, { data: unknown; fetchedAt: string }>()
const inflight = new Map<string, Promise<unknown>>()

function readCache<T>(key: string): { data: T; fetchedAt: string } | null {
  const m = memory.get(key)
  if (m) return m as { data: T; fetchedAt: string }
  try {
    const raw = localStorage.getItem(`dailybase-cache:${key}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      memory.set(key, parsed)
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeCache(key: string, data: unknown) {
  const entry = { data, fetchedAt: new Date().toISOString() }
  memory.set(key, entry)
  try {
    localStorage.setItem(`dailybase-cache:${key}`, JSON.stringify(entry))
  } catch {
    /* Speicher voll – Cache ist optional */
  }
  return entry
}

export function useRemote<T>(key: string | null, fetcher: () => Promise<T>, ttlMs = 10 * 60 * 1000): Remote<T> {
  const cached = key ? readCache<T>(key) : null
  const [state, setState] = useState<Omit<Remote<T>, 'reload'>>({
    data: cached?.data ?? null,
    fetchedAt: cached?.fetchedAt ?? null,
    loading: false,
    error: null,
    stale: false,
  })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(
    async (force: boolean) => {
      if (!key) return
      const c = readCache<T>(key)
      if (c) setState((s) => ({ ...s, data: c.data, fetchedAt: c.fetchedAt }))
      if (!force && c && Date.now() - new Date(c.fetchedAt).getTime() < ttlMs) {
        setState((s) => ({ ...s, loading: false, error: null, stale: false }))
        return
      }
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        let p = inflight.get(key) as Promise<T> | undefined
        if (!p) {
          p = fetcherRef.current()
          inflight.set(key, p)
        }
        const data = await p
        const entry = writeCache(key, data)
        setState({ data, fetchedAt: entry.fetchedAt, loading: false, error: null, stale: false })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        setState((s) => ({ ...s, loading: false, error: msg, stale: s.data != null }))
      } finally {
        inflight.delete(key)
      }
    },
    [key, ttlMs],
  )

  useEffect(() => {
    if (!key) {
      setState({ data: null, fetchedAt: null, loading: false, error: null, stale: false })
      return
    }
    run(false)
  }, [key, run])

  return { ...state, reload: () => run(true) }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = 'error',
  ) {
    super(message)
  }
}

export async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('Keine Internetverbindung', 'offline')
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError('Zeitüberschreitung bei der Abfrage', 'timeout')
    throw new ApiError('Quelle nicht erreichbar', 'network')
  } finally {
    clearTimeout(timer)
  }
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) {
    // z. B. wenn der Dailybase-Server nicht läuft und die SPA-HTML zurückkommt
    throw new ApiError('Dailybase-Server nicht erreichbar', 'no-server')
  }
  const body = await res.json()
  if (!res.ok) throw new ApiError(body?.message ?? `Fehler ${res.status}`, body?.error ?? 'http')
  return body as T
}
