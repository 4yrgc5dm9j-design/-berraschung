// Kader für den Fußballmanager: Wikidata (Namen, Positionen, Alter) + Stärkewerte.
import { RATINGS, ALWAYS } from './player-ratings.mjs'

export const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const WD_UA = { 'User-Agent': 'Dailybase/0.1 (https://github.com/4yrgc5dm9j-design/-berraschung; persoenliche App)', Accept: 'application/json' }

/** Bei Änderungen an der Abfrage erhöhen, damit alte Zwischenstände verworfen werden */
export const RAW_VERSION = 2

export async function wikidataRaw(clubs) {
  // 1) Vereine in Wikidata finden (Suche nach dem Namen aus OpenLigaDB)
  const found = []
  for (const c of clubs) {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=de&uselang=de&type=item&limit=7&search=${encodeURIComponent(c.name)}`
    const r = await fetch(url, { headers: WD_UA })
    const j = await r.json()
    // Profivereine haben die älteren (niedrigeren) Wikidata-Nummern; Frauen-, Nachwuchs- und Zweitteams ausschließen
    const hits = (j.search || [])
      .filter((x) => /fußball|fussball|football|soccer/i.test(x.description || '') && !/frauen|women|female|\bii\b|u\d\d|jugend|youth|reserve|esport/i.test(`${x.label} ${x.description}`))
      .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
    if (hits[0]) found.push({ ...c, qid: hits[0].id })
  }
  // 2) Aktuelle Spieler je Verein (Vereinszugehörigkeit ohne Enddatum)
  const values = found.map((c) => `wd:${c.qid}`).join(' ')
  // ?latest = jüngster Vereinswechsel des Spielers (nur Vereine, keine Nationalteams)
  const query = `SELECT ?club ?player ?playerLabel ?posLabel ?dob ?start ?latest WHERE {
    VALUES ?club { ${values} }
    ?player p:P54 ?st . ?st ps:P54 ?club .
    FILTER NOT EXISTS { ?st pq:P582 ?end . }
    OPTIONAL { ?st pq:P580 ?start . }
    ?player wdt:P106 wd:Q937857 ; wdt:P21 wd:Q6581097 .
    OPTIONAL { ?player wdt:P413 ?pos . }
    OPTIONAL { ?player wdt:P569 ?dob . }
    OPTIONAL {
      SELECT ?player (MAX(?s2) AS ?latest) WHERE {
        ?player p:P54 ?x . ?x pq:P580 ?s2 ; ps:P54 ?c2 . ?c2 wdt:P31 wd:Q476028 .
      } GROUP BY ?player
    }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
  }`
  const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { ...WD_UA, Accept: 'application/sparql-results+json' } })
  if (!r.ok) throw new Error(`Wikidata HTTP ${r.status}`)
  const rows = (await r.json()).results.bindings
  return {
    version: RAW_VERSION,
    fetchedAt: new Date().toISOString(),
    clubs: found,
    rows: rows.map((b) => ({ club: b.club.value.split('/').pop(), player: b.player.value.split('/').pop(), name: b.playerLabel?.value, pos: b.posLabel?.value || '', dob: b.dob?.value || null, start: b.start?.value || null, latest: b.latest?.value || null })),
  }
}

export function mapPos(label) {
  const l = label.toLowerCase()
  if (/tor(wart|hüter)|goalkeeper|keeper/.test(l)) return 'TW'
  if (/verteidig|abwehr|defender|back|libero|sweeper/.test(l)) return 'AB'
  if (/stürmer|sturm|flügel|angreifer|außen|aussen|forward|striker|winger|attacker/.test(l)) return 'ST'
  if (/mittelfeld|midfield/.test(l)) return 'MF'
  return null
}

function hashDev(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 9) - 4 // -4 … +4
}

export function buildSquads(raw, clubs, goalsByName) {
  const ratingMap = new Map(RATINGS.map(([n, pos, r]) => [norm(n), { pos, r }]))
  const year = new Date().getFullYear()
  return clubs.map((club) => {
    const wd = raw.clubs.find((c) => c.name === club.name)
    const players = new Map()
    for (const row of raw.rows.filter((x) => wd && x.club === wd.qid)) {
      if (!row.name || /^Q\d+$/.test(row.name)) continue
      const born = row.dob ? Number(row.dob.slice(0, 4)) : null
      if (born && (born < year - 38 || born > year - 16)) continue
      const known = ratingMap.has(norm(row.name))
      // Nur wenn dieser Verein die jüngste Station ist (sonst längst gewechselt) – bekannte Spieler immer
      if (!known) {
        if (!row.start) continue
        if (row.latest && row.start < row.latest) continue
        if (Number(row.start.slice(0, 4)) < year - 8) continue
      }
      const p = players.get(row.player) ?? { name: row.name, born, positions: [], start: row.start }
      const mp = mapPos(row.pos)
      if (mp) p.positions.push(mp)
      players.set(row.player, p)
    }
    for (const extra of ALWAYS[club.name] ?? []) if (![...players.values()].some((p) => norm(p.name) === norm(extra.name))) players.set(`always:${extra.name}`, { name: extra.name, born: extra.born, positions: [extra.pos], start: null })
    const list = [...players.values()].map((p) => {
      const known = ratingMap.get(norm(p.name))
      const pos = known?.pos ?? (p.positions.includes('TW') ? 'TW' : p.positions[0] ?? 'MF')
      return { name: p.name, pos, age: p.born ? year - p.born : 25, goals: goalsByName.get(norm(p.name)) ?? 0, rating: known?.r ?? null, start: p.start }
    })
    // Basis für Schätzungen: bekannte Werte des Vereins, sonst Tabellenstand
    const knownVals = list.filter((p) => p.rating).map((p) => p.rating).sort((a, b) => b - a)
    const base = knownVals.length >= 3 ? knownVals.slice(0, 11).reduce((a, b) => a + b, 0) / Math.min(11, knownVals.length) - 4 : 68 + club.ppg * 3
    for (const p of list) {
      if (p.rating) {
        p.source = 'ea'
        continue
      }
      const ageAdj = p.age <= 19 ? -6 : p.age <= 21 ? -3 : p.age <= 30 ? 0 : p.age <= 33 ? -1 : -3
      const goalAdj = p.pos === 'ST' || p.pos === 'MF' ? Math.min(6, p.goals * 0.7) : 0
      p.rating = Math.round(Math.max(55, Math.min(84, base + hashDev(p.name) + ageAdj + goalAdj)))
      p.source = 'schaetzung'
    }
    list.sort((a, b) => (b.source === 'ea') - (a.source === 'ea') || (b.start ?? '').localeCompare(a.start ?? '') || b.rating - a.rating)
    return { name: club.name, short: club.short, qid: wd?.qid ?? null, players: list.slice(0, 30).map(({ start, ...p }) => p) }
  })
}

