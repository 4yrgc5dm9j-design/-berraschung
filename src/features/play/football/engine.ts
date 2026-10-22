// Fußballmanager – reine Spiellogik (ohne Oberfläche, gut testbar).
// Alle Spieler sind frei erfunden. Vereinsnamen dienen nur als Kulisse,
// Stärken und Ergebnisse werden simuliert.

export type Pos = 'TW' | 'AB' | 'MF' | 'ST'
export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2'
export type Tactic = 'defensiv' | 'ausgewogen' | 'offensiv'
export type TrainingFocus = 'kondition' | 'technik' | 'taktik' | 'erholung'

export interface Player {
  id: string
  name: string
  pos: Pos
  age: number
  rating: number // 40–95
  potential: number
  form: number // -5 … +5
  injuredDays: number // in Spieltagen
  value: number // €
  salary: number // € pro Spieltag
  goals: number
  games: number
  /** Herkunft des Stärkewerts: an EA FC angelehnt, geschätzt oder fiktiver Spieler */
  source?: 'ea' | 'schaetzung' | 'fiktiv'
  /** bisheriger Verein (Transfermarkt) */
  club?: string
}

/** Echter Kader aus data/squads.json */
export interface RealClub {
  name: string
  short: string
  players: { name: string; pos: Pos; age: number; goals: number; rating: number; source: 'ea' | 'schaetzung' }[]
}

export interface Club {
  id: string
  name: string
  short: string
  strength: number // nur für KI-Teams
  isUser: boolean
}

export interface Fixture {
  home: string
  away: string
  result: [number, number] | null
}

export interface MatchEvent {
  minute: number
  team: 'home' | 'away'
  type: 'tor' | 'chance' | 'karte' | 'verletzung'
  text: string
}

export interface ManagerState {
  version: 1
  seed: number
  season: number
  clubId: string
  clubs: Club[]
  squad: Player[]
  lineup: string[] // 11 Spieler-IDs
  formation: Formation
  tactic: Tactic
  training: TrainingFocus
  budget: number
  matchday: number // nächster Spieltag (0-basiert)
  schedule: Fixture[][]
  market: Player[]
  log: { matchday: number; text: string }[]
  objective: { label: string; maxRank: number }
  history: { season: number; rank: number; points: number }[]
  /** Spieler anderer Vereine für den Transfermarkt (nur mit echten Kadern) */
  realPool?: Player[]
  realSquads?: boolean
}

// ---------------------------------------------------------------- Zufall (reproduzierbar)
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 1_000_000) / 1_000_000
  }
}
type Rand = () => number
const pick = <T,>(r: Rand, arr: T[]) => arr[Math.floor(r() * arr.length)]
const id = (r: Rand) => Math.floor(r() * 1e12).toString(36)

const FIRST = ['Lukas', 'Jonas', 'Leon', 'Finn', 'Noah', 'Elias', 'Paul', 'Ben', 'Felix', 'Moritz', 'Tim', 'Nico', 'Jan', 'Luca', 'Mats', 'Ole', 'Emil', 'Henrik', 'Mattis', 'Karim', 'Mateo', 'Yusuf', 'Rafael', 'Kenan', 'Malik', 'Tobias', 'Fabian', 'Milan', 'Aaron', 'Joel', 'Lasse', 'Sven', 'Marco', 'Diego', 'Arda']
const LAST = ['Brandt', 'Kessler', 'Vogt', 'Hartmann', 'Lindner', 'Albers', 'Petersen', 'Jansen', 'Krüger', 'Brinkmann', 'Sommer', 'Winter', 'Lorenz', 'Haas', 'Engel', 'Seidel', 'Kaya', 'Demir', 'Novak', 'Silva', 'Moreau', 'Larsen', 'Berger', 'Falk', 'Thiel', 'Roth', 'Busch', 'Graf', 'Wendt', 'Ahrens', 'Behrens', 'Claussen', 'Dittmer', 'Ewers', 'Feddersen']

export const POS_LABEL: Record<Pos, string> = { TW: 'Torwart', AB: 'Abwehr', MF: 'Mittelfeld', ST: 'Sturm' }

export const FORMATIONS: Record<Formation, Record<Exclude<Pos, 'TW'>, number>> = {
  '4-4-2': { AB: 4, MF: 4, ST: 2 },
  '4-3-3': { AB: 4, MF: 3, ST: 3 },
  '4-2-3-1': { AB: 4, MF: 5, ST: 1 },
  '3-5-2': { AB: 3, MF: 5, ST: 2 },
  '5-3-2': { AB: 5, MF: 3, ST: 2 },
}

export function valueFor(rating: number, age: number) {
  const ageFactor = age <= 23 ? 1.35 : age <= 28 ? 1 : age <= 31 ? 0.7 : 0.4
  return Math.round((Math.pow(Math.max(rating - 40, 1), 2.6) * 120 * ageFactor) / 10000) * 10000
}

export function makePlayer(r: Rand, pos: Pos, base: number): Player {
  const age = 18 + Math.floor(r() * 16)
  const rating = Math.max(45, Math.min(92, Math.round(base + (r() - 0.5) * 16)))
  const potential = Math.min(95, rating + (age < 23 ? Math.round(r() * 12) : Math.round(r() * 3)))
  return {
    id: id(r),
    name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
    pos,
    age,
    rating,
    potential,
    form: 0,
    injuredDays: 0,
    value: valueFor(rating, age),
    salary: Math.round((rating * rating * 11) / 1000) * 1000, // € pro Spieltag
    goals: 0,
    games: 0,
    source: 'fiktiv',
  }
}

export function fromReal(r: Rand, rp: RealClub['players'][number], club: string): Player {
  const potential = Math.min(95, rp.rating + (rp.age < 23 ? 2 + Math.round(r() * 6) : rp.age < 26 ? Math.round(r() * 2) : 0))
  return {
    id: id(r),
    name: rp.name,
    pos: rp.pos,
    age: rp.age,
    rating: rp.rating,
    potential,
    form: 0,
    injuredDays: 0,
    value: valueFor(rp.rating, rp.age),
    salary: Math.round((rp.rating * rp.rating * 11) / 1000) * 1000,
    goals: 0,
    games: 0,
    source: rp.source,
    club,
  }
}

/** Fehlende Positionen mit Nachwuchsspielern auffüllen, damit immer eine Elf möglich ist. */
function fillSquad(r: Rand, squad: Player[], base: number) {
  const min: Record<Pos, number> = { TW: 2, AB: 6, MF: 6, ST: 3 }
  for (const pos of ['TW', 'AB', 'MF', 'ST'] as Pos[]) {
    let have = squad.filter((p) => p.pos === pos).length
    while (have < min[pos]) {
      const p = makePlayer(r, pos, base - 6)
      p.age = 18 + Math.floor(r() * 3)
      p.name = `${p.name} (Nachwuchs)`
      squad.push(p)
      have++
    }
  }
  return squad
}

const top11 = (ratings: number[]) => {
  const t = [...ratings].sort((a, b) => b - a).slice(0, 11)
  return t.reduce((a, b) => a + b, 0) / Math.max(1, t.length)
}

function makeSquad(r: Rand, base: number): Player[] {
  const plan: [Pos, number][] = [['TW', 2], ['AB', 7], ['MF', 7], ['ST', 4]]
  return plan.flatMap(([pos, n]) => Array.from({ length: n }, () => makePlayer(r, pos, base)))
}

/** Rundenturnier (Kreisverfahren) mit Hin- und Rückrunde. */
export function roundRobin(ids: string[]): Fixture[][] {
  const teams = [...ids]
  if (teams.length % 2) teams.push('frei')
  const n = teams.length
  const rounds: Fixture[][] = []
  for (let round = 0; round < n - 1; round++) {
    const day: Fixture[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i]
      const b = teams[n - 1 - i]
      if (a === 'frei' || b === 'frei') continue
      day.push(round % 2 === 0 ? { home: a, away: b, result: null } : { home: b, away: a, result: null })
    }
    rounds.push(day)
    teams.splice(1, 0, teams.pop()!)
  }
  const second = rounds.map((d) => d.map((f) => ({ home: f.away, away: f.home, result: null })))
  return [...rounds, ...second]
}

export function bestLineup(squad: Player[], formation: Formation): string[] {
  const fit = squad.filter((p) => p.injuredDays === 0).sort((a, b) => b.rating + b.form - (a.rating + a.form))
  const need = { TW: 1, ...FORMATIONS[formation] }
  const chosen: Player[] = []
  for (const pos of ['TW', 'AB', 'MF', 'ST'] as Pos[]) chosen.push(...fit.filter((p) => p.pos === pos).slice(0, need[pos]))
  // Lücken (z. B. Verletzungen) mit den besten übrigen Spielern füllen
  for (const p of fit) if (chosen.length < 11 && !chosen.includes(p)) chosen.push(p)
  return chosen.slice(0, 11).map((p) => p.id)
}

export function newGame(clubNames: { name: string; short: string }[], userIndex: number, seed = Date.now(), real?: RealClub[]): ManagerState {
  const r = rng(seed)
  const realFor = (name: string) => real?.find((c) => c.name === name && c.players.length >= 11)
  if (real && realFor(clubNames[userIndex].name)) return newRealGame(clubNames, userIndex, seed, real)
  const clubs: Club[] = clubNames.map((c, i) => ({
    id: `c${i}`,
    name: c.name,
    short: c.short,
    strength: Math.round(62 + r() * 18),
    isUser: i === userIndex,
  }))
  const user = clubs[userIndex]
  const others = clubs.filter((c) => !c.isUser).map((c) => c.strength).sort((a, b) => a - b)
  user.strength = others[Math.floor(others.length * 0.45)] // Mittelfeld-Stärke zum Start
  const squad = makeSquad(r, user.strength - 2)
  const formation: Formation = '4-4-2'
  return {
    version: 1,
    seed,
    season: 1,
    clubId: user.id,
    clubs,
    squad,
    lineup: bestLineup(squad, formation),
    formation,
    tactic: 'ausgewogen',
    training: 'technik',
    budget: 8_000_000,
    matchday: 0,
    schedule: roundRobin(clubs.map((c) => c.id)),
    market: Array.from({ length: 8 }, () => makePlayer(r, pick(r, ['TW', 'AB', 'AB', 'MF', 'MF', 'ST', 'ST'] as Pos[]), user.strength + 2)),
    log: [{ matchday: 0, text: `Willkommen als Trainer von ${user.name}! Saisonziel: ${objectiveFor(1).label}.` }],
    objective: objectiveFor(1),
    history: [],
  }
}

function newRealGame(clubNames: { name: string; short: string }[], userIndex: number, seed: number, real: RealClub[]): ManagerState {
  const r = rng(seed)
  const realFor = (name: string) => real.find((c) => c.name === name && c.players.length >= 11)
  const clubs: Club[] = clubNames.map((c, i) => {
    const rc = realFor(c.name)
    return { id: `c${i}`, name: c.name, short: c.short, strength: rc ? Math.round(top11(rc.players.map((p) => p.rating))) : Math.round(64 + r() * 10), isUser: i === userIndex }
  })
  const user = clubs[userIndex]
  const squad = fillSquad(r, realFor(user.name)!.players.map((p) => fromReal(r, p, user.name)), user.strength)
  const realPool = clubs
    .filter((c) => !c.isUser)
    .flatMap((c) => (realFor(c.name)?.players ?? []).map((p) => fromReal(r, p, c.name)))
  const formation: Formation = '4-4-2'
  const state: ManagerState = {
    version: 1,
    seed,
    season: 1,
    clubId: user.id,
    clubs,
    squad,
    lineup: bestLineup(squad, formation),
    formation,
    tactic: 'ausgewogen',
    training: 'technik',
    budget: 15_000_000,
    matchday: 0,
    schedule: roundRobin(clubs.map((c) => c.id)),
    market: [],
    log: [],
    objective: objectiveFor(1),
    history: [],
    realPool,
    realSquads: true,
  }
  state.market = marketFromPool(state, r)
  state.log = [{ matchday: 0, text: `Willkommen als Trainer von ${user.name}! Echter Kader mit ${squad.length} Spielern. Saisonziel: ${state.objective.label}.` }]
  return state
}

/** 8 Angebote aus dem Spielerpool, eher in Reichweite der eigenen Teamstärke */
function marketFromPool(s: ManagerState, r: Rand): Player[] {
  const own = new Set(s.squad.map((p) => p.name))
  const userStrength = s.clubs.find((c) => c.isUser)!.strength
  const pool = (s.realPool ?? []).filter((p) => !own.has(p.name) && p.rating <= userStrength + 10)
  const picks: Player[] = []
  while (picks.length < 8 && pool.length) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return picks
}

function objectiveFor(season: number) {
  return season === 1 ? { label: 'Obere Tabellenhälfte', maxRank: 9 } : { label: 'Europapokal-Plätze (Top 6)', maxRank: 6 }
}

// ---------------------------------------------------------------- Teamstärke
export function lineupStrength(state: ManagerState) {
  const players = state.lineup.map((pid) => state.squad.find((p) => p.id === pid)).filter(Boolean) as Player[]
  const need = { TW: 1, ...FORMATIONS[state.formation] }
  const avg = (pos: Pos) => {
    const list = players.filter((p) => p.pos === pos)
    const sum = list.reduce((a, p) => a + p.rating + p.form, 0)
    // fehlende/falsch besetzte Positionen kosten Stärke
    const missing = Math.max(0, need[pos] - list.length)
    return (sum + missing * 40) / Math.max(need[pos], list.length || 1)
  }
  const gk = avg('TW')
  const def = avg('AB')
  const mid = avg('MF')
  const att = avg('ST')
  const tacticAtt = state.tactic === 'offensiv' ? 4 : state.tactic === 'defensiv' ? -4 : 0
  const attack = att * 0.45 + mid * 0.4 + def * 0.15 + tacticAtt
  const defense = gk * 0.3 + def * 0.45 + mid * 0.25 - tacticAtt * 0.8
  const penalty = players.length < 11 ? (11 - players.length) * 6 : 0
  return { attack: attack - penalty, defense: defense - penalty, overall: (attack + defense) / 2 - penalty }
}

function poisson(r: Rand, lambda: number) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= r()
  } while (p > L)
  return k - 1
}

export function expectedGoals(attack: number, defense: number, home: boolean) {
  return Math.max(0.15, 1.35 * Math.pow(attack / defense, 3.2) * (home ? 1.12 : 0.92))
}

export interface MatchResult {
  home: string
  away: string
  score: [number, number]
  events: MatchEvent[]
  scorers: string[] // Spieler-IDs der eigenen Torschützen
}

export function simulateMatch(state: ManagerState, f: Fixture, r: Rand): MatchResult {
  const userStr = lineupStrength(state)
  const str = (cid: string) => {
    const c = state.clubs.find((x) => x.id === cid)!
    return c.isUser ? userStr : { attack: c.strength + (r() - 0.5) * 6, defense: c.strength + (r() - 0.5) * 6 }
  }
  const h = str(f.home)
  const a = str(f.away)
  const gh = poisson(r, expectedGoals(h.attack, a.defense, true))
  const ga = poisson(r, expectedGoals(a.attack, h.defense, false))
  const events: MatchEvent[] = []
  const scorers: string[] = []
  const userSide = state.clubs.find((c) => c.id === f.home)!.isUser ? 'home' : state.clubs.find((c) => c.id === f.away)!.isUser ? 'away' : null
  const lineupPlayers = state.lineup.map((pid) => state.squad.find((p) => p.id === pid)).filter(Boolean) as Player[]
  const scorerPool = lineupPlayers.flatMap((p) => Array(p.pos === 'ST' ? 6 : p.pos === 'MF' ? 3 : p.pos === 'AB' ? 1 : 0).fill(p)) as Player[]

  const addGoals = (n: number, team: 'home' | 'away') => {
    const clubName = state.clubs.find((c) => c.id === (team === 'home' ? f.home : f.away))!.short
    for (let i = 0; i < n; i++) {
      const minute = 1 + Math.floor(r() * 90)
      if (team === userSide && scorerPool.length) {
        const p = pick(r, scorerPool)
        scorers.push(p.id)
        events.push({ minute, team, type: 'tor', text: `Tor für ${clubName}! ${p.name} trifft.` })
      } else events.push({ minute, team, type: 'tor', text: `Tor für ${clubName}!` })
    }
  }
  addGoals(gh, 'home')
  addGoals(ga, 'away')
  for (let i = 0; i < 3 + Math.floor(r() * 4); i++) {
    const team = r() < 0.5 ? 'home' : 'away'
    const name = state.clubs.find((c) => c.id === (team === 'home' ? f.home : f.away))!.short
    events.push({ minute: 1 + Math.floor(r() * 90), team, type: 'chance', text: pick(r, [`Große Chance für ${name} – knapp vorbei!`, `${name} trifft nur den Pfosten.`, `Starke Parade gegen ${name}.`, `${name} macht Druck.`]) })
  }
  if (r() < 0.5) events.push({ minute: 1 + Math.floor(r() * 90), team: r() < 0.5 ? 'home' : 'away', type: 'karte', text: 'Gelbe Karte nach taktischem Foul.' })
  events.sort((x, y) => x.minute - y.minute)
  return { home: f.home, away: f.away, score: [gh, ga], events, scorers }
}

// ---------------------------------------------------------------- Tabelle
export interface Row {
  clubId: string
  played: number
  won: number
  draw: number
  lost: number
  gf: number
  ga: number
  points: number
}

export function table(state: ManagerState): Row[] {
  const rows = new Map<string, Row>(state.clubs.map((c) => [c.id, { clubId: c.id, played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, points: 0 }]))
  for (const day of state.schedule)
    for (const f of day) {
      if (!f.result) continue
      const h = rows.get(f.home)!
      const a = rows.get(f.away)!
      const [x, y] = f.result
      h.played++
      a.played++
      h.gf += x
      h.ga += y
      a.gf += y
      a.ga += x
      if (x > y) {
        h.won++
        h.points += 3
        a.lost++
      } else if (x < y) {
        a.won++
        a.points += 3
        h.lost++
      } else {
        h.draw++
        a.draw++
        h.points++
        a.points++
      }
    }
  return [...rows.values()].sort((p, q) => q.points - p.points || q.gf - q.ga - (p.gf - p.ga) || q.gf - p.gf)
}

// ---------------------------------------------------------------- Spieltag
export function playMatchday(state: ManagerState): { state: ManagerState; own: MatchResult | null } {
  if (state.matchday >= state.schedule.length) return { state, own: null }
  const r = rng(state.seed + state.season * 1000 + state.matchday * 37 + 7)
  const s: ManagerState = structuredClone(state)
  // Verletzte nicht aufstellen
  s.lineup = s.lineup.filter((pid) => (s.squad.find((p) => p.id === pid)?.injuredDays ?? 1) === 0)
  if (s.lineup.length < 11) s.lineup = bestLineup(s.squad, s.formation)
  let own: MatchResult | null = null
  for (const f of s.schedule[s.matchday]) {
    const res = simulateMatch(s, f, r)
    f.result = res.score
    const isOwn = s.clubs.find((c) => c.id === f.home)!.isUser || s.clubs.find((c) => c.id === f.away)!.isUser
    if (isOwn) own = res
  }
  // Spieler-Entwicklung
  const won = own ? (own.home === s.clubId ? own.score[0] > own.score[1] : own.score[1] > own.score[0]) : false
  const lost = own ? (own.home === s.clubId ? own.score[0] < own.score[1] : own.score[1] < own.score[0]) : false
  for (const p of s.squad) {
    const played = s.lineup.includes(p.id)
    if (p.injuredDays > 0) p.injuredDays--
    if (played) {
      p.games++
      p.goals += own?.scorers.filter((x) => x === p.id).length ?? 0
      p.form = Math.max(-5, Math.min(5, p.form + (won ? 1 : lost ? -1 : 0) + (r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0)))
      const injuryRisk = s.training === 'kondition' ? 0.015 : s.training === 'erholung' ? 0.008 : 0.025
      if (r() < injuryRisk) {
        p.injuredDays = 1 + Math.floor(r() * 4)
        s.log.unshift({ matchday: s.matchday + 1, text: `🚑 ${p.name} verletzt sich und fällt ${p.injuredDays} Spieltag(e) aus.` })
      }
    } else if (s.training === 'erholung') p.form = Math.min(5, p.form + 1)
    // Training: junge Spieler mit Potenzial entwickeln sich
    const growChance = s.training === 'technik' || s.training === 'taktik' ? 0.12 : 0.05
    if (p.rating < p.potential && r() < growChance * (p.age < 24 ? 1.6 : 0.6)) p.rating++
    p.value = valueFor(p.rating, p.age)
  }
  // Finanzen
  const homeGame = own && own.home === s.clubId
  const income = (homeGame ? 1_900_000 : 600_000) + (won ? 250_000 : 0)
  const wages = s.squad.reduce((a, p) => a + p.salary, 0)
  s.budget += income - wages
  if (own) {
    const opp = s.clubs.find((c) => c.id === (own!.home === s.clubId ? own!.away : own!.home))!
    const mine = own.home === s.clubId ? own.score : ([own.score[1], own.score[0]] as [number, number])
    s.log.unshift({ matchday: s.matchday + 1, text: `${won ? '✅ Sieg' : lost ? '❌ Niederlage' : '🤝 Unentschieden'} gegen ${opp.name}: ${mine[0]}:${mine[1]}` })
  }
  // Transfermarkt alle 3 Spieltage erneuern
  if ((s.matchday + 1) % 3 === 0) {
    const base = s.clubs.find((c) => c.isUser)!.strength
    s.market = s.realPool?.length ? marketFromPool(s, r) : Array.from({ length: 8 }, () => makePlayer(r, pick(r, ['TW', 'AB', 'AB', 'MF', 'MF', 'ST', 'ST'] as Pos[]), base + 3))
  }
  s.matchday++
  s.log = s.log.slice(0, 60)
  return { state: s, own }
}

export function seasonOver(s: ManagerState) {
  return s.matchday >= s.schedule.length
}

/** Saisonabschluss: Prämie, Altern, neue Saison mit neuem Spielplan. */
export function nextSeason(state: ManagerState): ManagerState {
  const s: ManagerState = structuredClone(state)
  const rows = table(s)
  const rank = rows.findIndex((x) => x.clubId === s.clubId) + 1
  const points = rows[rank - 1].points
  s.history.push({ season: s.season, rank, points })
  s.budget += Math.max(0, (19 - rank) * 600_000)
  const r = rng(s.seed + s.season * 7919)
  for (const p of s.squad) {
    p.age++
    p.form = 0
    p.injuredDays = 0
    p.goals = 0
    p.games = 0
    if (p.age > 31) p.rating = Math.max(45, p.rating - 1 - Math.floor(r() * 3))
    p.value = valueFor(p.rating, p.age)
  }
  // KI-Teams verändern sich leicht
  for (const c of s.clubs) if (!c.isUser) c.strength = Math.max(58, Math.min(84, c.strength + Math.round((r() - 0.5) * 6)))
  s.season++
  s.matchday = 0
  s.schedule = roundRobin(s.clubs.map((c) => c.id))
  s.objective = objectiveFor(s.season)
  s.log.unshift({ matchday: 0, text: `Saison ${s.season - 1} beendet auf Platz ${rank} mit ${points} Punkten. Neues Ziel: ${s.objective.label}.` })
  return s
}

export function buyPlayer(state: ManagerState, playerId: string): ManagerState | string {
  const p = state.market.find((x) => x.id === playerId)
  if (!p) return 'Spieler nicht mehr verfügbar.'
  if (p.value > state.budget) return 'Nicht genug Budget.'
  if (state.squad.length >= 28) return 'Kader ist voll (max. 28).'
  return {
    ...state,
    budget: state.budget - p.value,
    squad: [...state.squad, p],
    market: state.market.filter((x) => x.id !== playerId),
    realPool: state.realPool?.filter((x) => x.name !== p.name),
    log: [{ matchday: state.matchday, text: `✍️ ${p.name}${p.club ? ` (von ${p.club})` : ''} verpflichtet – ${POS_LABEL[p.pos]}, Stärke ${p.rating}.` }, ...state.log],
  }
}

export function sellPlayer(state: ManagerState, playerId: string): ManagerState | string {
  const p = state.squad.find((x) => x.id === playerId)
  if (!p) return 'Spieler nicht gefunden.'
  if (state.squad.length <= 16) return 'Mindestens 16 Spieler im Kader nötig.'
  if (p.pos === 'TW' && state.squad.filter((x) => x.pos === 'TW').length <= 1) return 'Du brauchst mindestens einen Torwart.'
  const price = Math.round((p.value * 0.9) / 10000) * 10000
  return {
    ...state,
    budget: state.budget + price,
    squad: state.squad.filter((x) => x.id !== playerId),
    lineup: state.lineup.filter((x) => x !== playerId),
    log: [{ matchday: state.matchday, text: `💸 ${p.name} für ${(price / 1e6).toFixed(1).replace('.', ',')} Mio. € verkauft.` }, ...state.log],
  }
}
