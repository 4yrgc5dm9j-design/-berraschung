import { getJson } from './remote'
import { STATIC_HOSTING } from './server'
import { normalize } from '@/lib/utils'

// Quelle: OpenLigaDB (https://www.openligadb.de) – freie, community-gepflegte Fußballdaten, ohne Schlüssel.
const BASE = 'https://api.openligadb.de'

export const LEAGUES: { id: string; name: string }[] = [
  { id: 'bl1', name: '1. Bundesliga' },
  { id: 'bl2', name: '2. Bundesliga' },
  { id: 'bl3', name: '3. Liga' },
]

export interface Team {
  teamId: number
  teamName: string
  shortName: string
  teamIconUrl: string
}

export interface Match {
  matchID: number
  matchDateTime: string
  matchDateTimeUTC: string
  leagueName: string
  group: { groupName: string; groupOrderID: number }
  team1: Team
  team2: Team
  matchIsFinished: boolean
  matchResults: { resultTypeID: number; pointsTeam1: number; pointsTeam2: number; resultName: string }[]
  location: { locationCity: string; locationStadium: string } | null
}

export interface TableRow {
  teamInfoId: number
  teamName: string
  shortName: string
  teamIconUrl: string
  points: number
  goals: number
  opponentGoals: number
  goalDiff: number
  matches: number
  won: number
  draw: number
  lost: number
}

/** Saison-Schlüssel bei OpenLigaDB = Startjahr; neue Saison ab Juli. */
export function currentSeason(d = new Date()): number {
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
}

/** Erst direkt (CORS-fähig), bei Problemen über den Dailybase-Server. */
async function ligaGet<T>(path: string): Promise<T> {
  try {
    return await getJson<T>(`${BASE}/${path}`)
  } catch (e) {
    if (STATIC_HOSTING) throw e
    try {
      return await getJson<T>(`/api/sport/${path}`)
    } catch {
      throw e
    }
  }
}

export const fetchMatches = (league: string, season = currentSeason()) => ligaGet<Match[]>(`getmatchdata/${league}/${season}`)
export const fetchTable = (league: string, season = currentSeason()) => ligaGet<TableRow[]>(`getbltable/${league}/${season}`)
export const fetchTeams = (league: string, season = currentSeason()) => ligaGet<Team[]>(`getavailableteams/${league}/${season}`)

/** Verein in den Ligen suchen (für die automatische Zuordnung, z. B. „HSV“). */
export async function findTeam(name: string): Promise<{ team: Team; league: string } | null> {
  const q = normalize(name)
  let reached = false
  let lastError: unknown = null
  for (const l of LEAGUES) {
    try {
      const teams = await fetchTeams(l.id)
      reached = true
      const hit = teams.find(
        (t) => normalize(t.teamName) === q || normalize(t.shortName) === q || normalize(t.teamName).includes(q),
      )
      if (hit) return { team: hit, league: l.id }
    } catch (e) {
      lastError = e // nächste Liga probieren
    }
  }
  if (!reached) throw lastError ?? new Error('OpenLigaDB nicht erreichbar')
  return null
}

export function finalScore(m: Match): [number, number] | null {
  const end = m.matchResults.find((r) => r.resultTypeID === 2) ?? m.matchResults[m.matchResults.length - 1]
  return end ? [end.pointsTeam1, end.pointsTeam2] : null
}

export function teamMatches(matches: Match[], teamId: number) {
  const own = matches
    .filter((m) => m.team1.teamId === teamId || m.team2.teamId === teamId)
    .sort((a, b) => a.matchDateTimeUTC.localeCompare(b.matchDateTimeUTC))
  const now = Date.now()
  const past = own.filter((m) => m.matchIsFinished || new Date(m.matchDateTimeUTC).getTime() < now - 2.5 * 3600e3)
  const upcoming = own.filter((m) => !past.includes(m))
  const live = own.find((m) => {
    const t = new Date(m.matchDateTimeUTC).getTime()
    return !m.matchIsFinished && t <= now && now < t + 2.5 * 3600e3
  })
  return { all: own, past, upcoming, next: upcoming[0] ?? null, last: past[past.length - 1] ?? null, live: live ?? null }
}

export function resultFor(m: Match, teamId: number): 'S' | 'U' | 'N' | null {
  const s = finalScore(m)
  if (!s || !m.matchIsFinished) return null
  const [a, b] = m.team1.teamId === teamId ? s : [s[1], s[0]]
  return a > b ? 'S' : a === b ? 'U' : 'N'
}
