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
