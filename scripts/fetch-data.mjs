// Lädt öffentliche Daten für die statische Web-Version (GitHub Pages) und legt sie
// als JSON-Dateien neben die App: dist/data/…
// Läuft in der GitHub Action regelmäßig (siehe .github/workflows/pages.yml).
// - News: öffentliche RSS-Feeds (Browser dürfen sie wegen CORS nicht direkt laden)
// - Sport: Kopie der OpenLigaDB-Daten als Rückfallebene
// - status.json: Ergebnis jeder Quelle, damit Probleme in der App sichtbar sind
import { mkdirSync, writeFileSync } from 'node:fs'
import { FEEDS, parseFeed } from '../server/feeds.mjs'

const OUT = process.argv[2] || 'dist/data'
const UA = 'Dailybase/0.1 (persoenliche Alltags-App; Feed-Reader)'
mkdirSync(`${OUT}/sport`, { recursive: true })

async function get(url, accept) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: accept } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r
  } finally {
    clearTimeout(t)
  }
}

const status = { fetchedAt: new Date().toISOString(), news: [], sport: [], cors: {} }

// ---------------------------------------------------------------- News
const items = []
const errors = []
const seen = new Set()
for (const [topic, feeds] of Object.entries(FEEDS)) {
  for (const feed of feeds) {
    try {
      const xml = await (await get(feed.url, 'application/rss+xml, application/atom+xml, application/xml, text/xml')).text()
      const parsed = parseFeed(xml, feed.source, topic)
      let added = 0
      for (const it of parsed) {
        if (seen.has(it.link)) continue
        seen.add(it.link)
        items.push(it)
        added++
      }
      status.news.push({ source: feed.source, topic, ok: true, items: added })
    } catch (e) {
      errors.push({ source: feed.source, message: String(e.message || e) })
      status.news.push({ source: feed.source, topic, ok: false, error: String(e.message || e) })
    }
  }
}
items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
// pro Thema die neuesten 40 behalten
const perTopic = {}
const kept = items.filter((i) => (perTopic[i.topic] = (perTopic[i.topic] || 0) + 1) <= 40)
writeFileSync(`${OUT}/news.json`, JSON.stringify({ items: kept, fetchedAt: status.fetchedAt, errors }))
console.log(`News: ${kept.length} Artikel, ${errors.length} Quellen nicht erreichbar`)

// ---------------------------------------------------------------- Sport
const d = new Date()
const season = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
for (const league of ['bl1', 'bl2', 'bl3']) {
  for (const endpoint of ['getmatchdata', 'getbltable', 'getavailableteams']) {
    const path = `${endpoint}/${league}/${season}`
    try {
      const json = await (await get(`https://api.openligadb.de/${path}`, 'application/json')).json()
      writeFileSync(`${OUT}/sport/${path.replace(/\//g, '_')}.json`, JSON.stringify(json))
      status.sport.push({ path, ok: true })
    } catch (e) {
      status.sport.push({ path, ok: false, error: String(e.message || e) })
    }
  }
}
console.log(`Sport: ${status.sport.filter((s) => s.ok).length}/${status.sport.length} Dateien`)

// ---------------------------------------------------------------- CORS-Prüfung der Direktquellen
for (const [name, url] of [
  ['open-meteo', 'https://api.open-meteo.com/v1/forecast?latitude=53.55&longitude=10&current=temperature_2m'],
  ['openligadb', `https://api.openligadb.de/getavailableteams/bl1/${season}`],
  ['finnhub', 'https://finnhub.io/api/v1/quote?symbol=AAPL'],
  ['frankfurter', 'https://api.frankfurter.dev/v1/latest?base=EUR'],
]) {
  try {
    const r = await fetch(url, { headers: { Origin: 'https://example.github.io', 'User-Agent': UA } })
    status.cors[name] = { status: r.status, allowOrigin: r.headers.get('access-control-allow-origin') }
  } catch (e) {
    status.cors[name] = { error: String(e.message || e) }
  }
}
console.log('CORS:', JSON.stringify(status.cors))
writeFileSync(`${OUT}/status.json`, JSON.stringify(status, null, 2))
