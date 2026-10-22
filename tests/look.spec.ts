import { test } from '@playwright/test'
import { mockExternal } from './mocks'
// Nur zum Anschauen (Screenshots), nicht Teil der normalen Tests
test.skip(!process.env.LOOK, 'nur mit LOOK=1')
test('Startseite alle Ansichten', async ({ page }, info) => {
  await mockExternal(page)
  await page.goto('/')
  for (const v of ['Arbeit', 'Uni', 'Freizeit']) {
    await page.getByRole('tab', { name: new RegExp(v) }).click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `screenshots/look-${info.project.name}-${v}.png`, fullPage: true })
  }
})
