import { useEffect, useMemo } from 'react'
import { useRemote } from './remote'
import { fetchNews, fetchQuotes, fetchStatus } from './server'
import { fetchMatches, fetchTable, findTeam, teamMatches } from './sport'
import { fetchWeather } from './weather'
import { actions, useSettings } from '@/data/store'
import type { Club } from '@/data/types'

export function useServerStatus() {
  return useRemote('status', fetchStatus, 60 * 1000)
}

export function useNews(topics: string[]) {
  const key = topics.length ? `news:${[...topics].sort().join(',')}` : null
  return useRemote(key, () => fetchNews(topics), 10 * 60 * 1000)
}

export function useQuotes(symbols: string[]) {
  const list = useMemo(() => [...new Set(symbols.map((s) => s.toUpperCase()))].sort(), [symbols])
  return useRemote(list.length ? `quotes:${list.join(',')}` : null, () => fetchQuotes(list), 60 * 1000)
}

export function useWeather() {
  const { weather } = useSettings()
  return useRemote(weather ? `weather:${weather.lat.toFixed(2)},${weather.lon.toFixed(2)}` : null, () => fetchWeather(weather!), 15 * 60 * 1000)
}

/** Verein automatisch einer Liga zuordnen (einmalig), danach Spiele laden. */
export function useClub(club: Club | undefined) {
  const resolve = useRemote(club && (!club.teamId || !club.league) ? `findteam:${club.name}` : null, () => findTeam(club!.name), 24 * 3600 * 1000)

  useEffect(() => {
    if (!club || club.teamId || !resolve.data) return
    const { team, league } = resolve.data
    const s = actions().settings
    actions().setSettings({
      clubs: s.clubs.map((c) => (c.id === club.id ? { ...c, teamId: team.teamId, league, shortName: team.shortName || c.shortName, icon: team.teamIconUrl } : c)),
    })
  }, [club, resolve.data])

  const league = club?.league ?? null
  const matches = useRemote(league ? `matches:${league}` : null, () => fetchMatches(league!), 5 * 60 * 1000)
  const table = useRemote(league ? `table:${league}` : null, () => fetchTable(league!), 15 * 60 * 1000)
  const derived = useMemo(() => (matches.data && club?.teamId ? teamMatches(matches.data, club.teamId) : null), [matches.data, club?.teamId])

  return {
    resolving: resolve.loading,
    notFound: !!club && !club.teamId && !resolve.loading && resolve.fetchedAt != null && resolve.data == null,
    resolveError: resolve.error,
    matches,
    table,
    derived,
  }
}
