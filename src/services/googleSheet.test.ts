import { describe, expect, it } from 'vitest'
import { csvUrl, googleTicker, parseCsvRows, parseSheet, sheetDate, sheetNumber, templateCsv } from './googleSheet'
import { INSTRUMENTS } from '@/data/instruments'

describe('Google-Tabelle', () => {
  it('erzeugt Google-Kürzel und Vorlage', () => {
    expect(googleTicker({ id: 'SAP.DE' })).toBe('ETR:SAP')
    expect(googleTicker({ id: 'AAPL' })).toBe('AAPL')
    const rows = parseCsvRows(templateCsv(['XYZ', 'SAP.DE']))
    expect(rows).toHaveLength(INSTRUMENTS.length + 2)
    expect(rows[0].slice(0, 5)).toEqual(['id', 'ticker', 'price', 'closeyest', 'currency'])
    const last = rows[rows.length - 1]
    expect(last[0]).toBe('XYZ')
    expect(last[2]).toBe(`=GOOGLEFINANCE(B${rows.length};"price")`)
  })

  it('liest Zahlen und Daten in deutschem und englischem Format', () => {
    expect(sheetNumber('1.234,56')).toBe(1234.56)
    expect(sheetNumber('245,3')).toBe(245.3)
    expect(sheetNumber('245.3')).toBe(245.3)
    expect(sheetNumber('#N/A')).toBeNull()
    expect(sheetNumber('')).toBeNull()
    expect(sheetDate('7.3.2026 16:00:00')).toBe('2026-03-07')
    expect(sheetDate('3/7/2026 16:00:00')).toBe('2026-03-07')
    expect(sheetDate('Date')).toBeNull()
  })

  it('wandelt nur veröffentlichte Links in CSV-Adressen um', () => {
    expect(csvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-1/pubhtml')).toBe('https://docs.google.com/spreadsheets/d/e/2PACX-1/pub?output=csv')
    expect(csvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-1/pub?gid=0&single=true&output=csv')).toContain('output=csv')
    expect(() => csvUrl('https://docs.google.com/spreadsheets/d/abc/edit')).toThrow(/veröffentlichen/)
    expect(() => csvUrl('https://example.com/x.csv')).toThrow(/kein Google/)
  })

  it('parst Kurse und rechtsbündigen Wochenverlauf', () => {
    const csv = [
      '"id","ticker","price","closeyest","currency","Date","1.1.2026 16:00:00","8.1.2026 16:00:00","15.1.2026 16:00:00","22.1.2026 16:00:00","29.1.2026 16:00:00"',
      '"SAP.DE","ETR:SAP","250,10","247,00","EUR","Close","200","201","202","203","204"',
      '"NEU","NEU","10,5","","USD","Close","1","2","3","4"',
      '"MSFT","MSFT","#N/A","#N/A","#N/A",""',
    ].join('\n')
    const d = parseSheet(csv)
    expect(Object.keys(d.quotes)).toEqual(['SAP.DE', 'NEU'])
    expect(d.quotes['SAP.DE']).toEqual({ price: 250.1, closeyest: 247, currency: 'EUR' })
    expect(d.quotes.NEU.closeyest).toBeNull()
    expect(d.history['SAP.DE'][0]).toEqual(['2026-01-01', 200])
    expect(d.history.NEU[0]).toEqual(['2026-01-08', 1])
    expect(() => parseSheet('a,b\n1,2')).toThrow(/Format/)
  })
})
