import { expect, it } from 'vitest'
import { buildSquads, mapPos, ratingsFor } from './squads.mjs'

const year = new Date().getFullYear()
const row = (club, player, name, pos, born, start = `${year - 1}-07-01`, latest = start) => ({ club, player, name, pos, dob: born ? `${born}-05-05` : null, start, latest })

const raw = {
  fetchedAt: new Date().toISOString(),
  clubs: [
    { name: 'Hamburger SV', short: 'HSV', qid: 'Q1' },
    { name: 'VfB Stuttgart', short: 'VFB', qid: 'Q2' },
  ],
  rows: [
    row('Q1', 'Q10', 'Daniel Heuer Fernandes', 'Torwart', 1992, null, null), // gepflegt, ohne Startdatum → bleibt
    row('Q1', 'Q11', 'Neuzugang Eins', 'Linksaußen', year - 24), // neu laut Wikidata → bleibt (geschätzt)
    row('Q1', 'Q12', 'Ermedin Demirović', 'Sturm', 1998, null, `${year - 2}-07-16`), // gehört nicht zum HSV → raus
    row('Q1', 'Q13', 'Alte Leiche', 'Sturm', 1999, null, null), // ohne Startdatum & unbekannt → raus
    row('Q1', 'Q14', 'Weitergezogen', 'Sturm', 1999, `${year - 3}-07-01`, `${year - 1}-07-01`), // später woanders → raus
    row('Q2', 'Q20', 'Robert Glatzel', 'Sturm', 1994, `${year}-01-10`), // frisch bei anderem Verein → nicht mehr HSV
    row('Q1', 'Q15', 'Josha Vagnoman', 'Abwehrspieler', 2000, `${year - 8}-07-01`), // laut Liste beim VfB → nicht HSV
  ],
  ended: { Q1: ['Jonas Meffert'] }, // Abgang laut Wikidata
  birth: { 'jean luc dompe': 1995 },
}

it('baut Kader aus Wikidata und gepflegter EA-FC-Liste – mit festem Platz für Mario Vušković', () => {
  const [hsv] = buildSquads(raw, [{ name: 'Hamburger SV', short: 'HSV', ppg: 1.5 }], new Map([['jean luc dompe', 4]]))
  const names = hsv.players.map((p) => p.name)
  expect(names).toContain('Mario Vušković')
  expect(names).toContain('Daniel Heuer Fernandes')
  expect(names).toContain('Neuzugang Eins')
  expect(names).toContain('Jean-Luc Dompé') // gepflegt, kein Abgang bekannt
  for (const n of ['Ermedin Demirović', 'Alte Leiche', 'Weitergezogen', 'Jonas Meffert', 'Robert Glatzel', 'Josha Vagnoman']) expect(names).not.toContain(n)
  expect(hsv.players.find((p) => p.name === 'Jean-Luc Dompé').age).toBe(year - 1995)
  expect(hsv.players.find((p) => p.name === 'Mario Vušković')).toMatchObject({ pos: 'AB', source: 'ea', rating: 75 })
  expect(hsv.players.find((p) => p.name === 'Jean-Luc Dompé')).toMatchObject({ goals: 4, pos: 'ST', rating: 75 })
  const neu = hsv.players.find((p) => p.name === 'Neuzugang Eins')
  expect(neu).toMatchObject({ source: 'schaetzung', pos: 'ST' })
  expect(neu.rating).toBeLessThanOrEqual(73)
})

it('findet die gepflegte Liste auch bei abweichenden Vereinsnamen', () => {
  expect(ratingsFor('SV Werder Bremen').length).toBeGreaterThan(3)
  expect(ratingsFor('1. FC Heidenheim 1846').length).toBeGreaterThan(3)
  expect(ratingsFor('SC Paderborn 07')).toEqual([])
})

it('ordnet Positionen auf Deutsch und Englisch zu', () => {
  expect(mapPos('Fußballtorwart')).toBe('TW')
  expect(mapPos('centre-back')).toBe('AB')
  expect(mapPos('Mittelfeldspieler')).toBe('MF')
  expect(mapPos('Linksaußen')).toBe('ST')
  expect(mapPos('Außenverteidiger')).toBe('AB')
  expect(mapPos('forward')).toBe('ST')
})
