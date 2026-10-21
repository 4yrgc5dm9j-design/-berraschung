import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:8788', locale: 'de-DE', timezoneId: 'Europe/Berlin' },
  webServer: { command: 'PORT=8788 node server/index.mjs', url: 'http://localhost:8788/api/status', reuseExistingServer: true },
  projects: [
    { name: 'mobil', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
})
