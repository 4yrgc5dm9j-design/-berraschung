// Baut die statische Web-Version für GitHub Pages (App liegt unter /<repository>/).
import { execSync } from 'node:child_process'
import { copyFileSync, writeFileSync } from 'node:fs'

const base = process.env.DAILYBASE_BASE || '/-berraschung/'
execSync('npx tsc -b && npx vite build', { stdio: 'inherit', env: { ...process.env, DAILYBASE_BASE: base, VITE_STATIC: '1' } })
// Direktaufrufe wie /planen/aufgaben landen auf der 404-Seite → dieselbe App ausliefern
copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')
console.log(`Web-Version gebaut für ${base}`)
