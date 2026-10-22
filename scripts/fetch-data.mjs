// Lädt öffentliche Daten für die statische Web-Version (GitHub Pages) und legt sie
// als JSON-Dateien neben die App: dist/data/…
// Läuft in der GitHub Action regelmäßig (siehe .github/workflows/pages.yml).
// - News: öffentliche RSS-Feeds (Browser dürfen sie wegen CORS nicht direkt laden)
// - Sport: Kopie der OpenLigaDB-Daten als Rückfallebene
// - status.json: Ergebnis jeder Quelle, damit Probleme in der App sichtbar sind
import { mkdirSync, writeFileSync } from 'node:fs'
import { FEEDS, parseFeed } from '../server/feeds.mjs'
import { buildSquads, norm, RAW_VERSION, wikidataRaw } from './squads.mjs'
import { buildQuotes, fetchFx, fetchHistory, fetchQuotes, instruments, probe } from './market-data.mjs'

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
const sportData = {}
const d = new Date()
const season = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
for (const league of ['bl1', 'bl2', 'bl3']) {
  for (const endpoint of ['getmatchdata', 'getbltable', 'getavailableteams']) {
    const path = `${endpoint}/${league}/${season}`
    try {
      const json = await (await get(`https://api.openligadb.de/${path}`, 'application/json')).json()
      sportData[path] = json
      writeFileSync(`${OUT}/sport/${path.replace(/\//g, '_')}.json`, JSON.stringify(json))
      status.sport.push({ path, ok: true })
    } catch (e) {
      status.sport.push({ path, ok: false, error: String(e.message || e) })
    }
  }
}
console.log(`Sport: ${status.sport.filter((s) => s.ok).length}/${status.sport.length} Dateien`)

// ---------------------------------------------------------------- Kader (Fußballmanager)
// Echte Spielernamen aus Wikidata (aktuelle Vereinszugehörigkeit), Saisontore aus
// OpenLigaDB, Stärken angelehnt an EA-FC-Ratings (scripts/player-ratings.mjs) oder geschätzt.
try {
  const teams = sportData[`getavailableteams/bl1/${season}`] || []
  const tableRows = sportData[`getbltable/bl1/${season}`] || []
  const clubs = teams.map((t) => {
    const row = tableRows.find((r) => r.teamInfoId === t.teamId)
    return { name: t.teamName, short: t.shortName || t.teamName.slice(0, 3).toUpperCase(), ppg: row && row.matches ? row.points / row.matches : 1.4 }
  })
  if (clubs.length < 10) throw new Error('keine Bundesliga-Vereine aus OpenLigaDB')
  // Saisontore aus OpenLigaDB
  const goalsByName = new Map()
  for (const m of sportData[`getmatchdata/bl1/${season}`] || [])
    for (const g of m.goals || []) if (g.goalGetterName && !g.isOwnGoal) goalsByName.set(norm(g.goalGetterName), (goalsByName.get(norm(g.goalGetterName)) || 0) + 1)
  // Wikidata höchstens einmal am Tag abfragen: vorhandene Rohdaten der Webseite wiederverwenden
  let raw = null
  if (process.env.SQUADS_CACHE_URL) {
    try {
      const r = await fetch(process.env.SQUADS_CACHE_URL)
      if (r.ok) {
        const cached = await r.json()
        if (cached.version === RAW_VERSION && Date.now() - new Date(cached.fetchedAt).getTime() < 24 * 3600e3 && cached.rows?.length) raw = cached
      }
    } catch {
      /* kein Cache */
    }
  }
  if (!raw) raw = await wikidataRaw(clubs)
  writeFileSync(`${OUT}/squads-raw.json`, JSON.stringify(raw))
  const squads = buildSquads(raw, clubs, goalsByName)
  writeFileSync(`${OUT}/squads.json`, JSON.stringify({ fetchedAt: raw.fetchedAt, season, clubs: squads }))
  const sizes = squads.map((c) => `${c.short}:${c.players.length}`).join(' ')
  status.squads = { ok: true, clubs: squads.length, sizes }
  console.log(`Kader: ${sizes}`)
} catch (e) {
  status.squads = { ok: false, error: String(e.message || e) }
  console.log('Kader: Fehler', e.message)
  // Letzten funktionierenden Stand der Webseite behalten, statt die Kader zu verlieren
  if (process.env.SQUADS_CACHE_URL) {
    for (const file of ['squads.json', 'squads-raw.json']) {
      try {
        const r = await fetch(process.env.SQUADS_CACHE_URL.replace('squads-raw.json', file))
        if (r.ok) writeFileSync(`${OUT}/${file}`, await r.text())
      } catch {
        /* nichts zu retten */
      }
    }
  }
}

// ---------------------------------------------------------------- Börse (Stooq, ohne Schlüssel)
try {
  const test = await probe()
  console.log('Stooq-Probe:', JSON.stringify(test))
  status.marketProbe = test
  if (!test.ok) throw new Error('Stooq liefert keine Kurse (Details in marketProbe)')
  const siteBase = process.env.SQUADS_CACHE_URL ? process.env.SQUADS_CACHE_URL.replace('squads-raw.json', '') : null
  // Tagesverlauf höchstens alle 12 Stunden neu laden, sonst von der Webseite übernehmen
  let history = null
  if (siteBase) {
    try {
      const r = await fetch(`${siteBase}history.json`)
      if (r.ok) {
        const h = await r.json()
        if (Date.now() - new Date(h.fetchedAt).getTime() < 12 * 3600e3 && Object.keys(h.series || {}).length > 50) history = h
      }
    } catch {
      /* neu laden */
    }
  }
  if (!history) history = { fetchedAt: new Date().toISOString(), series: await fetchHistory(instruments) }
  writeFileSync(`${OUT}/history.json`, JSON.stringify(history))
  const fx = await fetchFx().catch(() => null)
  const latest = await fetchQuotes(instruments)
  const quotes = buildQuotes(latest, history.series, fx)
  writeFileSync(`${OUT}/quotes.json`, JSON.stringify(quotes))
  status.market = { ok: latest.size > 0, quotes: `${latest.size}/${instruments.length}`, history: Object.keys(history.series).length, missing: quotes.errors.slice(0, 40) }
  console.log(`Börse: ${latest.size}/${instruments.length} Kurse, ${Object.keys(history.series).length} Verläufe`)
} catch (e) {
  status.market = { ok: false, error: String(e.message || e) }
  console.log('Börse: Fehler', e.message)
}

// ---------------------------------------------------------------- CORS-Prüfung der Direktquellen
for (const [name, url] of [
  ['open-meteo', 'https://api.open-meteo.com/v1/forecast?latitude=53.55&longitude=10&current=temperature_2m'],
  ['openligadb', `https://api.openligadb.de/getavailableteams/bl1/${season}`],
  ['finnhub', 'https://finnhub.io/api/v1/quote?symbol=AAPL'],
  ['frankfurter', 'https://api.frankfurter.dev/v1/latest?base=EUR'],
  ['stooq', 'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv'],
  ['yahoo', 'https://query1.finance.yahoo.com/v8/finance/chart/SAP.DE?range=5d&interval=1d'],
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
