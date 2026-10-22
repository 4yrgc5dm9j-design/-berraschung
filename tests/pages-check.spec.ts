import { expect, test } from '@playwright/test'
import { mockExternal } from './mocks'

// Prüft die statische Web-Version (GitHub Pages) – nur manuell mit laufendem Pages-Testserver.
test.skip(!process.env.PAGES_URL, 'nur mit PAGES_URL')

test('Web-Version im Unterordner', async ({ page }) => {
  const base = process.env.PAGES_URL!
  await mockExternal(page)
  await page.goto(base)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Planen' }).first().click()
  await expect(page).toHaveURL(/\/-berraschung\/planen\/aufgaben/)
  await page.getByPlaceholder('Neue Aufgabe – Enter zum Speichern').fill('Test auf Pages')
  await page.keyboard.press('Enter')
  await page.reload() // Direktaufruf über 404.html
  await expect(page.getByText('Test auf Pages')).toBeVisible()
  await page.goto(base + 'entdecken/news')
  await expect(page.getByText(/In der installierbaren Web-Version/)).toBeVisible()
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href)).json())
  expect(manifest.start_url).toBe('./')
  const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(sw).toMatch(/\/-berraschung\/$/)
})
