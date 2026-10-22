import { test } from '@playwright/test'
import { mockExternal } from './mocks'
// Nur zum Anschauen (Screenshots), nicht Teil der normalen Tests
test.skip(!process.env.LOOK, 'nur mit LOOK=1')
for (const [name, w, h] of [['ipad-quer', 1180, 820], ['ipad-hoch', 820, 1180]] as const) {
  test(`Startseite ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await mockExternal(page)
    await page.goto('/')
    for (const v of ['Arbeit', 'Freizeit']) {
      await page.getByRole('tab', { name: new RegExp(v) }).click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `screenshots/look-${name}-${v}.png`, fullPage: true })
    }
  })
}
