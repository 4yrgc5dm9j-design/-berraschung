// Kurse über Google Tabellen: Die Funktion GOOGLEFINANCE ist Googles offizieller, kostenloser
// Weg zu (bis zu 20 Min. verzögerten) Kursen. Die Tabelle wird vom Nutzer „im Web veröffentlicht“
// und von Dailybase als CSV gelesen – ohne Schlüssel, ohne Scraping.
import { INSTRUMENTS, type Instrument } from '@/data/instruments'
import { ApiError } from './remote'

/** Google-Finance-Kürzel: Xetra mit „ETR:“, US-Werte direkt */
export function googleTicker(inst: Pick<Instrument, 'id'>) {
  return inst.id.endsWith('.DE') ? `ETR:${inst.id.slice(0, -3)}` : inst.id
}

const q = (v: string) => `"${v.replace(/"/g, '""')}"`

/**
 * Vorlage zum Import in Google Tabellen. Formeln mit Semikolon (deutsches Gebietsschema).
 * Spalten: Kürzel | Google-Kürzel | Kurs | Vortag | Währung | Wochenkurse (1 Jahr, falls Google sie herausgibt)
 */
export function templateCsv(extra: string[] = []) {
  const ids = [...INSTRUMENTS.map((i) => i.id), ...extra.filter((e) => !INSTRUMENTS.some((i) => i.id === e))]
  const hist = (cell: string, col: 1 | 2) => `=IFERROR(TRANSPOSE(INDEX(GOOGLEFINANCE(${cell};"close";TODAY()-370;TODAY();"WEEKLY");;${col}));"")`
  const rows = [[q('id'), q('ticker'), q('price'), q('closeyest'), q('currency'), q(hist('"AAPL"', 1))].join(',')]
  ids.forEach((id, i) => {
    const r = i + 2
    rows.push([q(id), q(googleTicker({ id })), q(`=GOOGLEFINANCE(B${r};"price")`), q(`=GOOGLEFINANCE(B${r};"closeyest")`), q(`=GOOGLEFINANCE(B${r};"currency")`), q(hist(`B${r}`, 2))].join(','))
  })
  return rows.join('\n')
}

/** CSV mit Anführungszeichen korrekt zerlegen */
export function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (inQuotes) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') inQuotes = false
      else cell += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** „1.234,56“, „1234.56“, „245,3“ → Zahl */
export function sheetNumber(v: string | undefined): number | null {
  if (!v) return null
  const t = v.trim().replace(/\s|€|\$/g, '')
  if (!t || /#|n\/a|error|fehler/i.test(t)) return null
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t)
  return Number.isFinite(n) ? n : null
}

/** „17.10.2025 16:00:00“ oder „10/17/2025 16:00:00“ oder „2025-10-17“ → „2025-10-17“ */
export function sheetDate(v: string): string | null {
  const t = v.trim()
  let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** Eingefügten Link in die CSV-Adresse der veröffentlichten Tabelle umwandeln */
export function csvUrl(input: string): string {
  const url = input.trim()
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) throw new ApiError('Das ist kein Google-Tabellen-Link.', 'bad_url')
  if (/\/d\/e\/[^/]+\/pub/.test(url)) {
    const u = new URL(url)
    u.searchParams.set('output', 'csv')
    u.pathname = u.pathname.replace(/pubhtml$/, 'pub')
    return u.toString()
  }
  throw new ApiError('Bitte den Link aus „Datei → Freigeben → Im Web veröffentlichen“ verwenden (er enthält „/pub“).', 'not_published')
}

export interface SheetData {
  quotes: Record<string, { price: number; closeyest: number | null; currency: string }>
  history: Record<string, [string, number][]>
}

export function parseSheet(csv: string): SheetData {
  const rows = parseCsvRows(csv)
  if (!rows.length || !/^id$/i.test((rows[0][0] ?? '').trim())) throw new ApiError('Die Tabelle hat nicht das erwartete Format – bitte die Dailybase-Vorlage verwenden.', 'format')
  const dates = rows[0].slice(5).map(sheetDate)
  const quotes: SheetData['quotes'] = {}
  const history: SheetData['history'] = {}
  for (const r of rows.slice(1)) {
    const id = (r[0] ?? '').trim().toUpperCase()
    const price = sheetNumber(r[2])
    if (!id || price == null) continue
    quotes[id] = { price, closeyest: sheetNumber(r[3]), currency: (r[4] ?? '').trim().toUpperCase() || (id.endsWith('.DE') ? 'EUR' : 'USD') }
    // Wochenkurse rechtsbündig an den Datumszeilen ausrichten (neuere Werte haben weniger Wochen)
    const vals = r.slice(5).map(sheetNumber).filter((x): x is number => x != null)
    const ds = dates.filter((d): d is string => !!d)
    if (vals.length >= 4 && ds.length) {
      const offset = ds.length - vals.length
      history[id] = vals.map((v, j) => [ds[offset + j], v] as [string, number]).filter(([d]) => !!d)
    }
  }
  if (!Object.keys(quotes).length) throw new ApiError('In der Tabelle stehen noch keine Kurse. Google braucht nach dem Import ein paar Sekunden.', 'empty')
  return { quotes, history }
}

export async function fetchSheet(url: string): Promise<SheetData> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('Keine Internetverbindung', 'offline')
  let res: Response
  try {
    res = await fetch(csvUrl(url), { cache: 'no-store' })
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError('Google-Tabelle nicht erreichbar', 'network')
  }
  if (!res.ok) throw new ApiError(`Google-Tabelle nicht lesbar (Fehler ${res.status}) – ist sie im Web veröffentlicht?`, 'http')
  return parseSheet(await res.text())
}

// Kurse und Verlauf lesen dieselbe Tabelle – innerhalb einer Minute nur einmal abrufen
let sheetCache: { url: string; at: number; value: Promise<SheetData> } | null = null

export function loadSheet(url: string): Promise<SheetData> {
  if (sheetCache && sheetCache.url === url && Date.now() - sheetCache.at < 50_000) return sheetCache.value
  const value = fetchSheet(url)
  sheetCache = { url, at: Date.now(), value }
  value.catch(() => {
    if (sheetCache?.value === value) sheetCache = null
  })
  return value
}
