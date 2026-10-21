import { describe, expect, it } from 'vitest'
import { savingsPlan, summarize } from '@/features/discover/portfolio'
import { addMonths, nextOccurrence, occursOn } from '@/lib/dates'
import { detectSource, instagramLabel, normalizeUrl } from '@/lib/links'
import { parseNum } from '@/lib/utils'
import type { Portfolio, Transaction } from '@/data/types'

const meta = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }

describe('Depot', () => {
  const p: Portfolio = { id: 'p', name: 'Test', kind: 'virtual', startCash: 10000, ...meta }
  const tx = (o: Partial<Transaction>): Transaction => ({ id: Math.random().toString(), portfolioId: 'p', symbol: 'X', name: 'X', type: 'buy', date: '2026-01-01', qty: 0, price: 0, fees: 0, ...meta, ...o })

  it('rechnet Durchschnittskosten, Teilverkauf und Spielgeld', () => {
    const s = summarize(
      p,
      [tx({ qty: 10, price: 100, fees: 1 }), tx({ qty: 10, price: 120, date: '2026-02-01' }), tx({ type: 'sell', qty: 5, price: 130, fees: 1, date: '2026-03-01' })],
      [{ id: 'X', price: 140, ...meta }],
      null,
    )
    // Einstand 2201 für 20 Stück → Ø 110,05; Verkauf 5 → Rest 15 × 110,05
    expect(s.positions[0].qty).toBe(15)
    expect(s.invested).toBeCloseTo(1650.75)
    expect(s.realized).toBeCloseTo(5 * 130 - 1 - 5 * 110.05)
    expect(s.value).toBeCloseTo(15 * 140)
    expect(s.cash).toBeCloseTo(10000 - 1001 - 1200 + 649)
  })

  it('setzt ohne Kurs den Einstand an und zählt die Position', () => {
    const s = summarize({ ...p, kind: 'real' }, [tx({ qty: 2, price: 50 })], [], null)
    expect(s.unpriced).toBe(1)
    expect(s.value).toBe(100)
    expect(s.cash).toBeNull()
  })
})

describe('Sparplan', () => {
  it('ohne Rendite = Summe der Einzahlungen', () => {
    const rows = savingsPlan({ start: 1000, monthly: 100, years: 2, ratePct: 0, dynamicPct: 0, inflationPct: 0 })
    expect(rows.at(-1)!.value).toBeCloseTo(3400)
  })
  it('mit Zinseszins wächst das Kapital über die Einzahlungen', () => {
    const last = savingsPlan({ start: 0, monthly: 100, years: 10, ratePct: 5, dynamicPct: 0, inflationPct: 0 }).at(-1)!
    expect(last.deposits).toBe(12000)
    expect(last.value).toBeGreaterThan(15400)
    expect(last.value).toBeLessThan(15600)
  })
})

describe('Datum & Wiederholung', () => {
  it('Monatsende wird sauber behandelt', () => expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'))
  it('werktags überspringt das Wochenende', () => expect(nextOccurrence('2026-10-23', 'weekdays')).toBe('2026-10-26'))
  it('wöchentliche Termine', () => {
    expect(occursOn('2026-10-05', 'weekly', '2026-10-19')).toBe(true)
    expect(occursOn('2026-10-05', 'weekly', '2026-10-20')).toBe(false)
    expect(occursOn('2026-10-05', 'weekly', '2026-09-28')).toBe(false)
  })
})

describe('Links & Zahlen', () => {
  it('erkennt Quellen', () => {
    expect(detectSource('https://www.instagram.com/reel/abc/')).toBe('instagram')
    expect(detectSource('https://youtu.be/xyz')).toBe('youtube')
    expect(instagramLabel('https://www.instagram.com/reel/abc/')).toBe('Instagram-Reel')
  })
  it('normalisiert Eingaben', () => {
    expect(normalizeUrl('hsv.de')).toBe('https://hsv.de/')
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('kein link')).toBeNull()
  })
  it('versteht deutsche Zahlen', () => {
    expect(parseNum('1.234,56')).toBeCloseTo(1234.56)
    expect(parseNum('95,5')).toBe(95.5)
    expect(parseNum('12.5')).toBe(12.5)
  })
})
