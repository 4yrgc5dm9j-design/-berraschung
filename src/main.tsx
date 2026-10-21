import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useApp } from '@/data/store'
import { LogoMark } from '@/components/layout/Logo'

/** Wartet, bis die lokalen Daten aus IndexedDB geladen sind. */
function Root() {
  const hydrated = useApp((s) => s.hydrated)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [])
  if (!hydrated)
    return (
      <div className="grid h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <LogoMark className="size-14 animate-pulse" />
          {slow && <p className="max-w-xs text-center text-sm text-muted">Lokaler Speicher reagiert nicht. Ist privates Surfen aktiv? Dann kann Dailybase keine Daten speichern.</p>}
        </div>
      </div>
    )
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
