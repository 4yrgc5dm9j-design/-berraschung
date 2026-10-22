import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.DAILYBASE_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    proxy: {
      // Der kleine Dailybase-Server (server/index.mjs) hält API-Schlüssel geheim
      // und übernimmt News-Feeds, Kurse und Link-Vorschauen.
      '/api': 'http://localhost:8787',
    },
  },
})
