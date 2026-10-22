// Kader für den Fußballmanager: Wikidata (Namen, Positionen, Alter) + Stärkewerte.
import { RATINGS, ALWAYS } from './player-ratings.mjs'

export const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const WD_UA = { 'User-Agent': 'Dailybase/0.1 (https://github.com/4yrgc5dm9j-design/-berraschung; persoenliche App)', Accept: 'application/json' }

/** Bei Änderungen an der Abfrage erhöhen, damit alte Zwischenstände verworfen werden */
export const RAW_VERSION = 6

export async function wikidataRaw(clubs) {
  // 1) Vereine in Wikidata finden: alle Suchtreffer sammeln, dann den Eintrag
  //    mit den meisten zugeordneten Fußballspielern wählen (= Profiverein, nicht
  //    Saison-, Frauen- oder Nachwuchsteam; der Hauptverein heißt oft nur „Sportverein“).
  const candidates = new Map()
  for (const c of clubs) {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=de&uselang=de&type=item&limit=20&search=${encodeURIComponent(c.name)}`
    const r = await fetch(url, { headers: WD_UA })
    const j = await r.json()
    candidates.set(c.name, (j.search || []).map((x) => x.id))
  }
  const allIds = [...new Set([...candidates.values()].flat())]
  const countQuery = `SELECT ?c (COUNT(DISTINCT ?p) AS ?n) WHERE { VALUES ?c { ${allIds.map((q) => `wd:${q}`).join(' ')} } ?p wdt:P54 ?c ; wdt:P106 wd:Q937857 . } GROUP BY ?c`
  const cr = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(countQuery)}`, { headers: { ...WD_UA, Accept: 'application/sparql-results+json' } })
  if (!cr.ok) throw new Error(`Wikidata (Vereine) HTTP ${cr.status}`)
  const counts = new Map((await cr.json()).results.bindings.map((b) => [b.c.value.split('/').pop(), Number(b.n.value)]))
  const found = []
  for (const c of clubs) {
    const best = (candidates.get(c.name) || []).map((q) => ({ q, n: counts.get(q) ?? 0 })).sort((x, y) => y.n - x.n)[0]
    if (best && best.n >= 30) found.push({ ...c, qid: best.q, players: best.n })
  }
  // 2) Aktuelle Spieler je Verein – eine kleine Abfrage pro Verein (große Abfragen laufen ins Zeitlimit)
  const minYear = new Date().getFullYear() - 8
  const sparql = async (query) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { ...WD_UA, Accept: 'application/sparql-results+json' } })
      if (r.ok) return (await r.json()).results.bindings
      if (r.status !== 429 && r.status < 500) throw new Error(`Wikidata HTTP ${r.status}`)
      await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)))
    }
    throw new Error('Wikidata nicht erreichbar')
  }
  const rows = []
  for (const c of found) {
    const query = `SELECT ?player ?playerLabel ?posLabel ?dob ?start WHERE {
      ?player p:P54 ?st . ?st ps:P54 wd:${c.qid} .
      FILTER NOT EXISTS { ?st pq:P582 ?end . }
      OPTIONAL { ?st pq:P580 ?start . }
      FILTER(!BOUND(?start) || YEAR(?start) >= ${minYear})
      ?player wdt:P106 wd:Q937857 ; wdt:P21 wd:Q6581097 ; wdt:P569 ?dob .
      FILTER(YEAR(?dob) >= ${minYear - 32})
      OPTIONAL { ?player wdt:P413 ?pos . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
    }`
    for (const b of await sparql(query))
      rows.push({ club: c.qid, player: b.player.value.split('/').pop(), name: b.playerLabel?.value, pos: b.posLabel?.value || '', dob: b.dob?.value || null, start: b.start?.value || null, latest: null })
  }
  // Abgänge: Zugehörigkeiten mit Enddatum (damit gepflegte Spieler, die gegangen sind, nicht auftauchen)
  const ended = {}
  for (const c of found) {
    const q = `SELECT ?playerLabel WHERE { ?player p:P54 ?st . ?st ps:P54 wd:${c.qid} ; pq:P582 ?end . FILTER(YEAR(?end) >= ${minYear}) ?player wdt:P106 wd:Q937857 . SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". } }`
    ended[c.qid] = (await sparql(q)).map((b) => b.playerLabel?.value).filter(Boolean)
  }
  // 3) Jüngste Vereinsstation der Kandidaten (in Paketen), um längst gewechselte Spieler zu erkennen
  const ids = [...new Set(rows.map((r) => r.player))]
  const latest = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150).map((q) => `wd:${q}`).join(' ')
    const q = `SELECT ?player (MAX(?s) AS ?latest) WHERE { VALUES ?player { ${chunk} } ?player p:P54 ?x . ?x pq:P580 ?s ; ps:P54 ?c . ?c wdt:P31 wd:Q476028 . } GROUP BY ?player`
    for (const b of await sparql(q)) latest.set(b.player.value.split('/').pop(), b.latest.value)
  }
  for (const r of rows) r.latest = latest.get(r.player) ?? null
  return { version: RAW_VERSION, fetchedAt: new Date().toISOString(), clubs: found, rows, ended }
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

/** Gepflegte Liste zum Verein finden ("Werder Bremen" ↔ "SV Werder Bremen", "1. FC Heidenheim" ↔ "1. FC Heidenheim 1846") */
export function ratingsFor(clubName) {
  const tokens = new Set(norm(clubName).split(' '))
  const key = Object.keys(RATINGS).find((k) => norm(k).split(' ').every((t) => tokens.has(t)))
  return key ? RATINGS[key] : []
}

export function buildSquads(raw, clubs, goalsByName) {
  const year = new Date().getFullYear()
  const recentElsewhere = (clubQid) => new Set(raw.rows.filter((r) => r.club !== clubQid && r.start && r.start >= `${year - 1}-06-01`).map((r) => norm(r.name)))
  return clubs.map((club) => {
    const wd = raw.clubs.find((c) => c.name === club.name)
    const curated = new Map(ratingsFor(club.name).map(([n, pos, r]) => [norm(n), { name: n, pos, r }]))
    const players = new Map()
    for (const row of raw.rows.filter((x) => wd && x.club === wd.qid)) {
      if (!row.name || /^Q\d+$/.test(row.name)) continue
      const born = row.dob ? Number(row.dob.slice(0, 4)) : null
      if (born && (born < year - 38 || born > year - 16)) continue
      const known = curated.has(norm(row.name))
      // Nur wenn dieser Verein die jüngste Station ist; gepflegte Spieler auch ohne Startdatum
      if (row.start && row.latest && row.start < row.latest) continue
      if (!known && (!row.start || Number(row.start.slice(0, 4)) < year - 8)) continue
      const p = players.get(norm(row.name)) ?? { name: row.name, born, positions: [], start: row.start }
      const mp = mapPos(row.pos)
      if (mp) p.positions.push(mp)
      players.set(norm(row.name), p)
    }
    // Gepflegte Spieler ergänzen, solange Wikidata keinen Abgang oder neuen Verein zeigt
    const left = new Set((raw.ended?.[wd?.qid] ?? []).map(norm))
    const elsewhere = recentElsewhere(wd?.qid)
    for (const [key, c] of curated) if (!players.has(key) && !left.has(key) && !elsewhere.has(key)) players.set(key, { name: c.name, born: null, positions: [c.pos], start: null })
    for (const extra of ALWAYS[club.name] ?? []) if (!players.has(norm(extra.name))) players.set(norm(extra.name), { name: extra.name, born: extra.born, positions: [extra.pos], start: null })
    const list = [...players.values()].map((p) => {
      const known = curated.get(norm(p.name))
      const pos = known?.pos ?? (p.positions.includes('TW') ? 'TW' : p.positions[0] ?? 'MF')
      return { name: p.name, pos, age: p.born ? year - p.born : 26, goals: goalsByName.get(norm(p.name)) ?? 0, rating: known?.r ?? null, start: p.start }
    })
    // Schätzungen: etwas unter dem Niveau der bekannten Stammspieler, sonst nach Tabellenstand
    const knownVals = list.filter((p) => p.rating).map((p) => p.rating).sort((a, b) => b - a)
    const base = knownVals.length >= 5 ? knownVals.slice(0, 11).reduce((a, b) => a + b, 0) / Math.min(11, knownVals.length) - 7 : 66 + club.ppg * 3
    for (const p of list) {
      if (p.rating) {
        p.source = 'ea'
        continue
      }
      const ageAdj = p.age <= 19 ? -6 : p.age <= 21 ? -3 : p.age <= 30 ? 0 : p.age <= 33 ? -1 : -3
      const goalAdj = p.pos === 'ST' || p.pos === 'MF' ? Math.min(6, p.goals * 0.7) : 0
      p.rating = Math.round(Math.max(55, Math.min(82, base + hashDev(p.name) + ageAdj + goalAdj)))
      p.source = 'schaetzung'
    }
    list.sort((a, b) => (b.source === 'ea') - (a.source === 'ea') || (b.start ?? '').localeCompare(a.start ?? '') || b.rating - a.rating)
    return { name: club.name, short: club.short, qid: wd?.qid ?? null, players: list.slice(0, 30).map(({ start, ...p }) => p) }
  })
}
