import { expect, it } from 'vitest'
import { buildSquads, mapPos } from './squads.mjs'

const year = new Date().getFullYear()
const row = (player, name, pos, born, start = `${year - 1}-07-01`, latest = start) => ({ club: 'Q1', player, name, pos, dob: `${born}-05-05`, start, latest })

it('baut Kader mit EA-FC-Werten, Schätzungen und festem Platz für Mario Vušković', () => {
  const raw = {
    fetchedAt: new Date().toISOString(),
    clubs: [{ name: 'Hamburger SV', short: 'HSV', qid: 'Q1' }],
    rows: [
      row('Q10', 'Daniel Heuer Fernandes', 'Torwart', 1992),
      row('Q11', 'Jean-Luc Dompé', 'Flügelspieler', 1995),
      row('Q12', 'Jonas Meffert', 'Mittelfeldspieler', 1994),
      row('Q13', 'Unbekannter Talent', 'Innenverteidiger', year - 19),
      row('Q14', 'Alter Recke', 'Stürmer', year - 45), // zu alt → raus
      row('Q15', 'Ehemaliger', 'Stürmer', 1998, '2010-01-01'), // uralte Zugehörigkeit → raus
      row('Q16', 'Längst Gewechselt', 'Stürmer', 1999, `${year - 3}-07-01`, `${year - 1}-07-01`), // spätere Station woanders → raus
      row('Q17', 'Ohne Startdatum', 'Stürmer', 2000, null, null), // unbekannt & ohne Datum → raus
    ],
  }
  const goals = new Map([['jean luc dompe', 4]])
  const [hsv] = buildSquads(raw, [{ name: 'Hamburger SV', short: 'HSV', ppg: 1.5 }], goals)
  const names = hsv.players.map((p) => p.name)
  expect(names).toContain('Mario Vušković')
  expect(names).not.toContain('Alter Recke')
  expect(names).not.toContain('Ehemaliger')
  expect(names).not.toContain('Längst Gewechselt')
  expect(names).not.toContain('Ohne Startdatum')
  const vus = hsv.players.find((p) => p.name === 'Mario Vušković')
  expect(vus).toMatchObject({ pos: 'AB', source: 'ea', rating: 75 })
  expect(hsv.players.find((p) => p.name === 'Jean-Luc Dompé')).toMatchObject({ rating: 75, goals: 4, pos: 'ST' })
  const talent = hsv.players.find((p) => p.name === 'Unbekannter Talent')
  expect(talent.source).toBe('schaetzung')
  expect(talent.pos).toBe('AB')
  expect(talent.rating).toBeLessThan(75)
})

it('ordnet Positionen auf Deutsch und Englisch zu', () => {
  expect(mapPos('Torwart')).toBe('TW')
  expect(mapPos('centre-back')).toBe('AB')
  expect(mapPos('Mittelfeldspieler')).toBe('MF')
  expect(mapPos('Linksaußen')).toBe('ST')
  expect(mapPos('Außenverteidiger')).toBe('AB')
  expect(mapPos('forward')).toBe('ST')
})
