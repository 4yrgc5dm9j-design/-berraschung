import { describe, expect, it } from 'vitest'
import { bestLineup, buyPlayer, newGame, nextSeason, playMatchday, roundRobin, seasonOver, sellPlayer, table } from './engine'

const clubs = Array.from({ length: 18 }, (_, i) => ({ name: `Verein ${i}`, short: `V${i}` }))

describe('Fußballmanager', () => {
  it('erstellt einen vollständigen Spielplan (34 Spieltage, jeder gegen jeden zweimal)', () => {
    const s = roundRobin(clubs.map((_, i) => `c${i}`))
    expect(s).toHaveLength(34)
    expect(s.every((d) => d.length === 9)).toBe(true)
    const pairs = new Set(s.flat().map((f) => `${f.home}-${f.away}`))
    expect(pairs.size).toBe(18 * 17)
  })

  it('spielt eine komplette Saison durch und startet die nächste', () => {
    let g = newGame(clubs, 3, 42)
    expect(g.lineup).toHaveLength(11)
    while (!seasonOver(g)) g = playMatchday(g).state
    const t = table(g)
    expect(t.reduce((a, r) => a + r.played, 0)).toBe(18 * 34)
    expect(t[0].points).toBeGreaterThanOrEqual(t[17].points)
    const next = nextSeason(g)
    expect(next.season).toBe(2)
    expect(next.matchday).toBe(0)
    expect(next.history).toHaveLength(1)
    expect(next.squad.every((p) => p.games === 0)).toBe(true)
  })

  it('ist mit gleichem Startwert reproduzierbar', () => {
    const a = playMatchday(newGame(clubs, 0, 7)).state
    const b = playMatchday(newGame(clubs, 0, 7)).state
    expect(a.schedule[0].map((f) => f.result)).toEqual(b.schedule[0].map((f) => f.result))
  })

  it('Transfers prüfen Budget und Kadergröße', () => {
    const g = newGame(clubs, 0, 1)
    const cheap = g.market.reduce((m, p) => (p.value < m.value ? p : m))
    const after = buyPlayer(g, cheap.id)
    expect(typeof after).toBe('object')
    if (typeof after === 'object') {
      expect(after.budget).toBe(g.budget - cheap.value)
      expect(after.squad).toHaveLength(g.squad.length + 1)
    }
    expect(buyPlayer({ ...g, budget: 0 }, cheap.id)).toBe('Nicht genug Budget.')
    const small = { ...g, squad: g.squad.slice(0, 16) }
    expect(sellPlayer(small, small.squad[5].id)).toMatch(/Mindestens 16/)
  })

  it('stellt verletzte Spieler nicht auf', () => {
    const g = newGame(clubs, 0, 3)
    const hurt = g.squad.find((p) => g.lineup.includes(p.id))!
    hurt.injuredDays = 2
    expect(bestLineup(g.squad, g.formation)).not.toContain(hurt.id)
  })
})

describe('Fußballmanager mit echten Kadern', () => {
  const mk = (n: number, rating: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `Spieler ${rating}-${i}`, pos: (['TW', 'AB', 'AB', 'MF', 'MF', 'ST'] as const)[i % 6], age: 20 + (i % 12), goals: 0, rating, source: 'ea' as const }))
  const real = clubs.map((c, i) => ({ ...c, players: mk(22, 70 + (i % 10)) }))
  real[3].players.push({ name: 'Mario Vušković', pos: 'AB', age: 25, goals: 0, rating: 75, source: 'ea' })

  it('übernimmt den echten Kader inklusive Mario Vušković', () => {
    const g = newGame(clubs, 3, 5, real)
    expect(g.realSquads).toBe(true)
    expect(g.squad.some((p) => p.name === 'Mario Vušković' && p.rating === 75)).toBe(true)
    expect(g.lineup).toHaveLength(11)
    expect(g.market.every((p) => p.club && p.club !== clubs[3].name)).toBe(true)
  })

  it('Gegnerstärke folgt den Spielerwerten', () => {
    const g = newGame(clubs, 3, 5, real)
    expect(g.clubs[9].strength).toBe(79)
    expect(g.clubs[0].strength).toBe(70)
  })

  it('gekaufte Spieler verschwinden aus dem Pool', () => {
    const g = newGame(clubs, 3, 5, real)
    const p = g.market[0]
    const after = buyPlayer({ ...g, budget: 1e9 }, p.id)
    expect(typeof after).toBe('object')
    if (typeof after === 'object') expect(after.realPool!.some((x) => x.name === p.name)).toBe(false)
  })

  it('fällt ohne passende Kaderdaten auf fiktive Spieler zurück', () => {
    const g = newGame(clubs, 3, 5, [])
    expect(g.realSquads).toBeUndefined()
    expect(g.squad.every((p) => p.source === 'fiktiv')).toBe(true)
  })
})
