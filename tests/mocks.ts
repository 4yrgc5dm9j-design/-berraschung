import type { Page } from '@playwright/test'

// Testdaten NUR für automatisierte Tests – die App selbst zeigt nie erfundene Daten.
const now = Date.now()
const iso = (h: number) => new Date(now + h * 3600e3).toISOString()

export async function mockExternal(page: Page) {
  await page.route('https://api.open-meteo.com/**', (r) => {
    const hours = Array.from({ length: 48 }, (_, i) => new Date(now + i * 3600e3).toISOString().slice(0, 13) + ':00')
    const days = Array.from({ length: 7 }, (_, i) => new Date(now + i * 86400e3).toISOString().slice(0, 10))
    r.fulfill({
      json: {
        current: { temperature_2m: 12.4, apparent_temperature: 10.1, weather_code: 2, wind_speed_10m: 14, is_day: 1, precipitation: 0 },
        hourly: { time: hours, temperature_2m: hours.map((_, i) => 10 + (i % 6)), weather_code: hours.map(() => 3), precipitation_probability: hours.map(() => 20) },
        daily: { time: days, weather_code: days.map(() => 61), temperature_2m_max: days.map(() => 14), temperature_2m_min: days.map(() => 7), precipitation_probability_max: days.map(() => 40), sunrise: days, sunset: days },
      },
    })
  })
  await page.route('https://geocoding-api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { results: [{ name: 'Lüneburg', admin1: 'Niedersachsen', country: 'Deutschland', latitude: 53.25, longitude: 10.41 }] } }),
  )
  const team = (id: number, name: string, short: string) => ({ teamId: id, teamName: name, shortName: short, teamIconUrl: '' })
  const hsv = team(100, 'Hamburger SV', 'HSV')
  const others = [team(40, 'FC Bayern München', 'Bayern'), team(7, 'Borussia Dortmund', 'BVB'), team(87, 'Werder Bremen', 'Werder')]
  // Hinweis: später registrierte Routen haben Vorrang
  await page.route('https://api.openligadb.de/getavailableteams/**', (r) => r.fulfill({ json: [] }))
  await page.route('https://api.openligadb.de/getavailableteams/bl1/**', (r) => r.fulfill({ json: [hsv, ...others] }))
  await page.route('https://api.openligadb.de/getmatchdata/**', (r) =>
    r.fulfill({
      json: others.map((o, i) => ({
        matchID: i + 1,
        matchDateTime: iso((i - 1) * 24 * 7),
        matchDateTimeUTC: iso((i - 1) * 24 * 7),
        leagueName: '1. Fußball-Bundesliga',
        group: { groupName: `${i + 7}. Spieltag`, groupOrderID: i + 7 },
        team1: i % 2 ? o : hsv,
        team2: i % 2 ? hsv : o,
        matchIsFinished: i === 0,
        matchResults: i === 0 ? [{ resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1, resultName: 'Endergebnis' }] : [],
        location: { locationCity: 'Hamburg', locationStadium: 'Volksparkstadion' },
      })),
    }),
  )
  await page.route('https://api.openligadb.de/getbltable/**', (r) =>
    r.fulfill({
      json: [hsv, ...others].map((t, i) => ({ teamInfoId: t.teamId, teamName: t.teamName, shortName: t.shortName, teamIconUrl: '', points: 20 - i * 3, goals: 15, opponentGoals: 10 + i, goalDiff: 5 - i, matches: 8, won: 6 - i, draw: 2, lost: i })),
    }),
  )
  await page.route('**/api/news**', (r) =>
    r.fulfill({
      json: {
        fetchedAt: new Date().toISOString(),
        errors: [],
        items: [
          { id: 'https://example.org/a', title: 'Testartikel Wirtschaft', link: 'https://example.org/a', source: 'tagesschau', publishedAt: iso(-1), topic: 'wirtschaft', summary: 'Kurzer Anriss.', image: null },
          { id: 'https://example.org/b', title: 'Testartikel Technologie', link: 'https://example.org/b', source: 'heise online', publishedAt: iso(-3), topic: 'technologie', summary: 'Noch ein Anriss.', image: null },
        ],
      },
    }),
  )
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
}
