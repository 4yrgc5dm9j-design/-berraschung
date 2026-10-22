import { expect, it } from 'vitest'
import { buildQuotes, instruments, parseCsv } from './market-data.mjs'

it('liest Stooq-CSV und berechnet Vortagsveränderung und Euro-Kurs', () => {
  const rows = parseCsv('Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-10-21,22:00:09,230,235,229,240,1000\nSAP.DE,2026-10-21,17:35:00,200,205,199,N/D,0')
  expect(rows[0]).toMatchObject({ symbol: 'AAPL.US', close: '240' })
  const latest = new Map([['AAPL', { close: 240, date: '2026-10-21', time: '22:00:09' }], ['SAP.DE', { close: 210, date: '2026-10-21', time: '17:35:00' }]])
  const history = { AAPL: [['2026-10-19', 230], ['2026-10-20', 236]], 'SAP.DE': [['2026-10-20', 200], ['2026-10-21', 210]] }
  const q = buildQuotes(latest, history, { date: '2026-10-21', rates: { USD: 1.2 } })
  expect(q.quotes.AAPL.priceEur).toBe(200)
  expect(q.quotes.AAPL.changePct).toBeCloseTo(240 / 236 - 1)
  expect(q.quotes['SAP.DE']).toMatchObject({ priceEur: 210, currency: 'EUR' })
  expect(q.quotes['SAP.DE'].changePct).toBeCloseTo(0.05)
  expect(q.errors.length).toBe(instruments.length - 2)
})

it('Werte-Liste: eindeutige Kürzel, gültige Stooq-Symbole', () => {
  const ids = instruments.map((i) => i.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(instruments.find((i) => i.id === 'BRK.B').stooq).toBe('brk-b.us')
  expect(instruments.find((i) => i.id === 'EUNL.DE')).toMatchObject({ stooq: 'eunl.de', currency: 'EUR', type: 'ETF' })
})
