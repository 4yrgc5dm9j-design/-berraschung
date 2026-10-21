import clsx, { type ClassValue } from 'clsx'

export const cn = (...v: ClassValue[]) => clsx(v)

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const nowIso = () => new Date().toISOString()

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const eurRound = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const pct = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' })

export const fmtEur = (v: number, round = false) => (round ? eurRound : eur).format(v)
export const fmtNum = (v: number) => num.format(v)
export const fmtPct = (v: number) => pct.format(v)
export const fmtMoney = (v: number, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v)

/** „12,5“ und „12.5“ als Zahl verstehen */
export function parseNum(v: string): number {
  const cleaned = v.trim().replace(/\s/g, '')
  if (!cleaned) return NaN
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned
  return Number(normalized)
}

export function pickRandom<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  if (to < 0 || to >= copy.length) return copy
  const [x] = copy.splice(from, 1)
  copy.splice(to, 0, x)
  return copy
}

export function normalize(s: string) {
  return s.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function matches(query: string, ...fields: (string | undefined | null)[]) {
  const q = normalize(query.trim())
  if (!q) return true
  const hay = normalize(fields.filter(Boolean).join(' '))
  return q.split(/\s+/).every((part) => hay.includes(part))
}

export function parseTags(v: string): string[] {
  return Array.from(new Set(v.split(/[,#]/).map((t) => t.trim().toLowerCase()).filter(Boolean)))
}
