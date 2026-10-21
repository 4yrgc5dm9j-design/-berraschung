import type { Recurrence } from '@/data/types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const todayKey = () => toDateKey(new Date())

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

export function addMonths(key: string, months: number): string {
  const d = fromDateKey(key)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toDateKey(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromDateKey(a).getTime() - fromDateKey(b).getTime()) / 86400000)
}

export function nextOccurrence(key: string, r: Recurrence): string {
  switch (r) {
    case 'daily':
      return addDays(key, 1)
    case 'weekdays': {
      let n = addDays(key, 1)
      while ([0, 6].includes(fromDateKey(n).getDay())) n = addDays(n, 1)
      return n
    }
    case 'weekly':
      return addDays(key, 7)
    case 'monthly':
      return addMonths(key, 1)
    case 'yearly':
      return addMonths(key, 12)
    default:
      return key
  }
}

/** Liegt ein wiederkehrender Termin (Start: base) am Tag key? */
export function occursOn(base: string, r: Recurrence, key: string): boolean {
  if (key < base) return false
  if (key === base) return true
  const a = fromDateKey(base)
  const b = fromDateKey(key)
  switch (r) {
    case 'daily':
      return true
    case 'weekdays':
      return b.getDay() !== 0 && b.getDay() !== 6
    case 'weekly':
      return diffDays(key, base) % 7 === 0
    case 'monthly':
      return a.getDate() === b.getDate()
    case 'yearly':
      return a.getDate() === b.getDate() && a.getMonth() === b.getMonth()
    default:
      return false
  }
}

export const weekdayShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function fmtDate(key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return fromDateKey(key).toLocaleDateString('de-DE', opts)
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/** „heute“, „morgen“, „gestern“, „in 3 Tagen“, „Fr, 24. Okt.“ */
export function relativeDay(key: string): string {
  const d = diffDays(key, todayKey())
  if (d === 0) return 'Heute'
  if (d === 1) return 'Morgen'
  if (d === -1) return 'Gestern'
  if (d > 1 && d < 7) return fromDateKey(key).toLocaleDateString('de-DE', { weekday: 'long' })
  return fmtDate(key, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'gerade eben'
  const m = Math.round(s / 60)
  if (m < 60) return `vor ${m} Min.`
  const h = Math.round(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.round(h / 24)
  if (d < 7) return `vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}`
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 14) return 'Mahlzeit'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function monthMatrix(year: number, month: number): string[] {
  // Montag als Wochenbeginn, 6 Wochen
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toDateKey(d)
  })
}

export function startOfWeek(key: string): string {
  const d = fromDateKey(key)
  return addDays(key, -((d.getDay() + 6) % 7))
}

export const recurrenceLabel: Record<Recurrence, string> = {
  none: 'Einmalig',
  daily: 'Täglich',
  weekdays: 'Werktags',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
}
