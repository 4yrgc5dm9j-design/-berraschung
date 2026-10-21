// Dailybase-Server: liefert die gebaute App aus und stellt eine kleine API bereit.
// - hält API-Schlüssel geheim (sie verlassen nie den Server)
// - lädt öffentliche News-Feeds (im Browser wegen CORS nicht direkt möglich)
// - erzeugt Link-Vorschauen nur aus öffentlich zugänglichen Metadaten
// Keine Abhängigkeiten außer Node.js ≥ 20.

import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dns from 'node:dns/promises'
import net from 'node:net'
import { FEEDS, parseFeed } from './feeds.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'))

const PORT = Number(process.env.PORT || 8787)
const FINNHUB = process.env.FINNHUB_API_KEY?.trim() || ''
const DIST = path.join(root, 'dist')
const VERSION = '0.1.0'
const UA = 'Dailybase/0.1 (persoenliche Alltags-App; Feed-Reader)'

// ---------------------------------------------------------------- Hilfen
const cache = new Map()
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  const value = await fn()
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 500) cache.delete(cache.keys().next().value)
  return value
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

async function fetchText(url, { timeout = 10000, maxBytes = 2_000_000, headers = {} } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const reader = r.body.getReader()
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) {
        ctrl.abort()
        break
      }
      chunks.push(value)
    }
    return { text: Buffer.concat(chunks).toString('utf8'), url: r.url, type: r.headers.get('content-type') || '' }
  } finally {
    clearTimeout(t)
  }
}

// Schutz vor Anfragen an interne Netze (SSRF) bei Link-Vorschauen.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && isPrivateIp(v.slice(7))
}

async function assertPublicUrl(raw) {
  const u = new URL(raw)
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Nur http(s)-Links')
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Port nicht erlaubt')
  const addrs = await dns.lookup(u.hostname, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Adresse nicht erlaubt')
  return u
}

// ---------------------------------------------------------------- News
async function loadFeed(feed, topic) {
  return cached(`feed:${feed.url}`, 10 * 60 * 1000, async () => {
    const { text } = await fetchText(feed.url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } })
    return parseFeed(text, feed.source, topic)
  })
}

async function handleNews(url, res) {
  const topics = (url.searchParams.get('topics') || 'wirtschaft').split(',').filter((t) => FEEDS[t])
  const jobs = topics.flatMap((topic) => FEEDS[topic].map((feed) => ({ topic, feed })))
  const results = await Promise.allSettled(jobs.map((j) => loadFeed(j.feed, j.topic)))
  const items = []
  const errors = []
  const seen = new Set()
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      for (const it of r.value) {
        if (seen.has(it.link)) continue
        seen.add(it.link)
        items.push(it)
      }
    } else errors.push({ source: jobs[i].feed.source, message: String(r.reason?.message || r.reason) })
  })
  items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  if (!items.length && errors.length) return send(res, 502, { error: 'feeds_unavailable', message: 'Die Nachrichtenquellen sind gerade nicht erreichbar.', errors })
  send(res, 200, { items: items.slice(0, 150), fetchedAt: new Date().toISOString(), errors })
}

// ---------------------------------------------------------------- Kurse
async function handleQuotes(url, res) {
  if (!FINNHUB) return send(res, 503, { error: 'not_configured', message: 'Keine Kursquelle eingerichtet (FINNHUB_API_KEY fehlt).' })
  const symbols = [...new Set((url.searchParams.get('symbols') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 30)
  const quotes = {}
  const errors = []
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await cached(`quote:${symbol}`, 60 * 1000, async () => {
          const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, { headers: { 'X-Finnhub-Token': FINNHUB } })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        // Finnhub liefert c=0 für unbekannte Symbole
        if (!q || !q.c) throw new Error('keine Daten')
        quotes[symbol] = { symbol, price: q.c, change: q.d ?? null, changePct: q.dp != null ? q.dp / 100 : null, currency: 'USD', at: new Date((q.t || Date.now() / 1000) * 1000).toISOString() }
      } catch (e) {
        errors.push(`${symbol}: ${e.message}`)
      }
    }),
  )
  send(res, 200, { source: 'Finnhub', quotes, errors, fetchedAt: new Date().toISOString() })
}

async function handleSymbols(url, res) {
  if (!FINNHUB) return send(res, 503, { error: 'not_configured', message: 'Keine Kursquelle eingerichtet.' })
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 1) return send(res, 200, { results: [] })
  const data = await cached(`sym:${q.toLowerCase()}`, 24 * 3600 * 1000, async () => {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}`, { headers: { 'X-Finnhub-Token': FINNHUB } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
  send(res, 200, { results: (data.result || []).slice(0, 12).map((r) => ({ symbol: r.symbol, name: r.description, type: r.type })) })
}

// ---------------------------------------------------------------- Sport-Fallback
async function handleSport(pathname, res) {
  const sub = pathname.replace(/^\/api\/sport\//, '')
  if (!/^(getmatchdata|getbltable|getavailableteams)\/[a-z0-9]+\/\d{4}$/.test(sub)) return send(res, 400, { error: 'bad_request', message: 'Ungültige Anfrage' })
  const data = await cached(`liga:${sub}`, 5 * 60 * 1000, async () => {
    const { text } = await fetchText(`https://api.openligadb.de/${sub}`, { headers: { Accept: 'application/json' }, maxBytes: 5_000_000 })
    return JSON.parse(text)
  })
  send(res, 200, data)
}

// ---------------------------------------------------------------- Link-Vorschau
function meta(html, ...names) {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i')
    const tagMatch = html.match(re)
    if (tagMatch) {
      const c = tagMatch[0].match(/content=["']([^"']*)["']/i)
      if (c) return c[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
    }
  }
  return ''
}

async function handlePreview(url, res) {
  const raw = url.searchParams.get('url') || ''
  let host = ''
  try {
    host = new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return send(res, 400, { error: 'bad_url', message: 'Ungültiger Link' })
  }
  // Instagram/Facebook: Vorschauen sind offiziell nur über die Meta-oEmbed-API
  // mit registrierter App möglich. Wir umgehen das nicht.
  if (/(^|\.)instagram\.com$|^instagr\.am$|(^|\.)facebook\.com$/.test(host)) {
    return send(res, 200, { unsupported: true, reason: 'Instagram erlaubt Vorschauen nur über eine registrierte Meta-App (oEmbed). Der Link wird gespeichert und öffnet direkt in Instagram.' })
  }
  let target
  try {
    target = await assertPublicUrl(raw)
  } catch (e) {
    return send(res, 400, { error: 'bad_url', message: e.message })
  }
  try {
    const data = await cached(`preview:${target}`, 24 * 3600 * 1000, async () => {
      if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) {
        const { text } = await fetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target.toString())}`)
        const o = JSON.parse(text)
        return { title: o.title, description: o.author_name ? `von ${o.author_name}` : '', image: o.thumbnail_url, siteName: 'YouTube' }
      }
      const { text, url: finalUrl } = await fetchText(target.toString(), { maxBytes: 600_000, headers: { Accept: 'text/html' } })
      await assertPublicUrl(finalUrl)
      const head = text.slice(0, 300_000)
      let image = meta(head, 'og:image', 'twitter:image')
      if (image) {
        try {
          image = new URL(image, finalUrl).toString()
        } catch {
          image = ''
        }
      }
      return {
        title: meta(head, 'og:title', 'twitter:title') || (head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim(),
        description: meta(head, 'og:description', 'description', 'twitter:description'),
        image: image.startsWith('https://') ? image : '',
        siteName: meta(head, 'og:site_name') || host,
      }
    })
    send(res, 200, data)
  } catch (e) {
    send(res, 502, { error: 'preview_failed', message: `Keine Vorschau möglich (${e.message})` })
  }
}

// ---------------------------------------------------------------- Statische Dateien
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

async function serveStatic(pathname, res) {
  if (!existsSync(DIST)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('Noch kein Build vorhanden. Bitte zuerst „npm run build“ ausführen oder im Entwicklungsmodus „npm run dev“ nutzen.')
  }
  let file = path.join(DIST, path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html')
  let s = await stat(file).catch(() => null)
  if (!s || s.isDirectory()) {
    file = path.join(DIST, 'index.html')
    s = await stat(file)
  }
  const ext = path.extname(file)
  const immutable = pathname.startsWith('/assets/')
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(await readFile(file))
}

// ---------------------------------------------------------------- Router
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return send(res, 405, { error: 'method', message: 'Nur GET' })
      if (url.pathname === '/api/status')
        return send(res, 200, { ok: true, version: VERSION, news: { sources: [...new Set(Object.values(FEEDS).flat().map((f) => f.source))] }, quotes: { provider: FINNHUB ? 'Finnhub' : null }, preview: true })
      if (url.pathname === '/api/news') return await handleNews(url, res)
      if (url.pathname === '/api/quotes') return await handleQuotes(url, res)
      if (url.pathname === '/api/symbols') return await handleSymbols(url, res)
      if (url.pathname === '/api/preview') return await handlePreview(url, res)
      if (url.pathname.startsWith('/api/sport/')) return await handleSport(url.pathname, res)
      return send(res, 404, { error: 'not_found', message: 'Unbekannter Endpunkt' })
    }
    await serveStatic(url.pathname, res)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) send(res, 500, { error: 'server', message: 'Interner Fehler' })
  }
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} ist schon belegt – läuft Dailybase bereits? Anderen Port mit PORT=8790 npm start wählen.`)
  else console.error(e)
  process.exit(1)
})

server.listen(PORT, () => {
  console.log(`Dailybase-Server läuft auf http://localhost:${PORT}`)
  console.log(`Kursquelle: ${FINNHUB ? 'Finnhub' : 'nicht eingerichtet (manuelle Kurse)'}`)
})
