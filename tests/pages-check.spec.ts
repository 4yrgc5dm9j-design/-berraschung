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
})

test('Web-Version: Manifest und Service Worker', async ({ page }) => {
  await page.goto(process.env.PAGES_URL!)
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href)).json())
  expect(manifest.start_url).toBe('./')
  const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(sw).toMatch(/\/-berraschung\/$/)
})
