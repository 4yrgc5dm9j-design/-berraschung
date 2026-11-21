// Dailybase Service Worker: App-Shell offline verfügbar machen.
// Externe Daten (Wetter, News, Kurse) werden NICHT hier gecacht – die App
// zeigt dafür den letzten Stand mit Zeitstempel an.
// Alle Pfade relativ zum Scope, damit die App auch in einem Unterordner läuft
// (z. B. GitHub Pages unter /<repository>/).
const CACHE = 'dailybase-shell-v2'
const BASE = new URL(self.registration.scope).pathname
const SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon.svg`, `${BASE}icons/icon-192.png`]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith(`${BASE}api/`)) return

  // Seitenaufrufe: erst Netz, offline die gecachte App-Shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(BASE, copy))
          }
          return res
        })
        .catch(() => caches.match(BASE)),
    )
    return
  }

  // Gebaute Dateien sind versioniert → Cache zuerst
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith(`${BASE}assets/`) || url.pathname.startsWith(`${BASE}icons/`))) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
