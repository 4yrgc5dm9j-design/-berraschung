import { expect, test } from '@playwright/test'
import { mockExternal } from './mocks'

// Prüft die statische Web-Version (GitHub Pages) – nur manuell mit laufendem Pages-Testserver.
test.skip(!process.env.PAGES_URL, 'nur mit PAGES_URL')

test.describe('Daten', () => {
  // Anfragen des Service Workers lassen sich nicht abfangen → für die Datentests blockieren
  test.use({ serviceWorkers: 'block' })

test('Web-Version im Unterordner', async ({ page }) => {
  const base = process.env.PAGES_URL!
  await mockExternal(page)
  const at = new Date(Date.now() - 12 * 60000).toISOString()
  await page.route('**/data/news.json*', (r) =>
    r.fulfill({ json: { fetchedAt: at, errors: [], items: [{ id: 'https://example.org/x', title: 'Testmeldung aus news.json', link: 'https://example.org/x', source: 'tagesschau', publishedAt: at, topic: 'wirtschaft', summary: 'Anriss', image: null }] } }),
  )
  await page.route('**/data/status.json*', (r) => r.fulfill({ json: { fetchedAt: at, news: [{ source: 'tagesschau', ok: true }], sport: [], cors: {} } }))
  // OpenLigaDB direkt nicht erreichbar → Kopie aus der Web-Version verwenden
  await page.route('https://api.openligadb.de/**', (r) => r.abort())
  const match = (r: import('@playwright/test').Route) =>
    r.fulfill({ json: [{ matchID: 1, matchDateTime: new Date(Date.now() + 2 * 86400e3).toISOString(), matchDateTimeUTC: new Date(Date.now() + 2 * 86400e3).toISOString(), leagueName: 'Bundesliga', group: { groupName: '9. Spieltag', groupOrderID: 9 }, team1: { teamId: 100, teamName: 'Hamburger SV', shortName: 'HSV', teamIconUrl: '' }, team2: { teamId: 7, teamName: 'Borussia Dortmund', shortName: 'BVB', teamIconUrl: '' }, matchIsFinished: false, matchResults: [], location: { locationCity: 'Hamburg', locationStadium: 'Volksparkstadion' } }] })
  await page.route(/\/data\/sport\//, (r) => {
    const u = r.request().url()
    if (u.includes('getavailableteams_bl1_')) return r.fulfill({ json: [{ teamId: 100, teamName: 'Hamburger SV', shortName: 'HSV', teamIconUrl: '' }] })
    if (u.includes('getmatchdata_bl1_')) return match(r)
    return r.fulfill({ status: 404, contentType: 'text/html', body: 'nicht gefunden' })
  })
  await page.goto(base)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Planen' }).first().click()
  await expect(page).toHaveURL(/\/-berraschung\/planen\/aufgaben/)
  await page.getByPlaceholder('Neue Aufgabe – Enter zum Speichern').fill('Test auf Pages')
  await page.keyboard.press('Enter')
  await page.reload() // Direktaufruf über 404.html
  await expect(page.getByText('Test auf Pages')).toBeVisible()
  await page.goto(base + 'entdecken/news')
  await expect(page.getByText('Testmeldung aus news.json')).toBeVisible()
  await expect(page.getByText(/Aktualisiert vor 12 Min/)).toBeVisible()
  await page.goto(base + 'entdecken/sport')
  await expect(page.getByText('Volksparkstadion')).toBeVisible()
  await page.goto(base + 'entdecken/boerse')
  await expect(page.getByText('Watchlist ist leer')).toBeVisible()
  await page.goto(base + 'profil')
  await expect(page.getByText(/alle 30 Minuten automatisch abgerufen \(zuletzt vor 12 Min/)).toBeVisible()
  })

  test('Börse mit verzögerten Kursen, Märkten, Depot-Analyse und 100.000 € Spielgeld', async ({ page }) => {
    const base = process.env.PAGES_URL!
    await mockExternal(page)
    const now = Date.now()
    const days = Array.from({ length: 120 }, (_, i) => new Date(now - (119 - i) * 86400e3).toISOString().slice(0, 10))
    const mk = (start: number, drift: number) => days.map((d, i) => [d, Math.round((start * (1 + drift * i) + Math.sin(i) * 2) * 100) / 100])
    const series = { 'SAP.DE': mk(200, 0.001), 'EUNL.DE': mk(100, 0.0008), AAPL: mk(200, 0.0015) }
    await page.route('**/data/history.json*', (r) => r.fulfill({ json: { fetchedAt: new Date().toISOString(), series } }))
    const q = (id: string, price: number, cur: string, eur: number, ch: number) => ({ symbol: id, price, currency: cur, priceEur: eur, change: price * ch, changePct: ch, at: new Date().toISOString() })
    await page.route('**/data/quotes.json*', (r) =>
      r.fulfill({ json: { source: 'Stooq (verzögert)', fetchedAt: new Date().toISOString(), fxDate: '2026-10-21', errors: [], quotes: { 'SAP.DE': q('SAP.DE', 250, 'EUR', 250, 0.012), 'EUNL.DE': q('EUNL.DE', 110, 'EUR', 110, -0.003), AAPL: q('AAPL', 240, 'USD', 200, 0.02) } } }),
    )
    // Märkte
    await page.goto(base + 'entdecken/boerse')
    await page.getByRole('tab', { name: /Märkte/ }).click()
    await expect(page.getByText('verzögert', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /SAP SAP/ }).click()
    await expect(page.getByRole('dialog').getByText(/Entwicklung 6M/)).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Im Börsenspiel handeln' }).click()
    // Börsenspiel mit 100.000 € und SAP vorausgewählt
    await expect(page.getByText(/seit Start \(100\.000\s€\)/)).toBeVisible()
    await expect(page.getByText('Verzögerter Kurs', { exact: false })).toBeVisible()
    await page.getByLabel('Betrag in Euro').fill('25000')
    await page.getByRole('button', { name: 'Kauforder ausführen' }).click()
    await expect(page.getByText(/Gekauft: 99,99/)).toBeVisible()
    await expect(page.getByText('Depot-Analyse')).toBeVisible()
    await expect(page.getByText('Schwankung p. a.')).toBeVisible()
    await expect(page.getByText(/MSCI World \(EUNL\), 12 Monate/)).toBeVisible()
  })

  test('Fußballmanager mit echten Kadern', async ({ page }) => {
    const base = process.env.PAGES_URL!
    await mockExternal(page)
    const names = ['FC Bayern München', 'Borussia Dortmund', 'Bayer 04 Leverkusen', 'RB Leipzig', 'VfB Stuttgart', 'Eintracht Frankfurt', 'SC Freiburg', 'VfL Wolfsburg', 'Borussia Mönchengladbach', 'Werder Bremen', '1. FSV Mainz 05', 'TSG Hoffenheim', 'FC Augsburg', '1. FC Union Berlin', '1. FC Heidenheim 1846', 'FC St. Pauli', '1. FC Köln', 'Hamburger SV']
    const pos = ['TW', 'AB', 'AB', 'AB', 'MF', 'MF', 'MF', 'ST', 'ST', 'AB', 'MF', 'ST', 'TW', 'MF', 'AB', 'ST']
    const clubs = names.map((name, i) => ({
      name,
      short: name === 'Hamburger SV' ? 'HSV' : `V${i}`,
      players: [
        ...(name === 'Hamburger SV' ? [{ name: 'Mario Vušković', pos: 'AB', age: 25, goals: 0, rating: 75, source: 'ea' }, { name: 'Jean-Luc Dompé', pos: 'ST', age: 30, goals: 3, rating: 75, source: 'ea' }] : []),
        ...pos.map((p, k) => ({ name: `Spieler ${i}-${k}`, pos: p, age: 24, goals: 0, rating: 68 + (k % 5), source: 'schaetzung' })),
      ],
    }))
    await page.route('**/data/squads.json*', (r) => r.fulfill({ json: { fetchedAt: new Date().toISOString(), season: 2026, clubs } }))
    await page.goto(base + 'spielen/fussball')
    await expect(page.getByText(/Echte Kader/)).toBeVisible()
    await expect(page.getByRole('combobox')).toHaveValue('17') // Lieblingsverein HSV vorausgewählt
    await page.getByRole('button', { name: 'Karriere starten' }).click()
    await page.getByRole('button', { name: /Kader/ }).click()
    await expect(page.getByText('Mario Vušković')).toBeVisible()
    await expect(page.getByText('EA').first()).toBeVisible()
    await page.getByRole('button', { name: /Transfers/ }).click()
    await expect(page.getByText(/Spieler \d+-\d+/).first()).toBeVisible()
  })
})

test('Web-Version: Manifest und Service Worker', async ({ page }) => {
  await page.goto(process.env.PAGES_URL!)
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href)).json())
  expect(manifest.start_url).toBe('./')
  const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(sw).toMatch(/\/-berraschung\/$/)
})
