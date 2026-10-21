import { del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

/**
 * Speicher-Adapter. Daten liegen in IndexedDB (verträgt auch Bilder) und
 * zusätzlich – solange sie klein genug sind – synchron in localStorage.
 * Die synchrone Kopie sorgt dafür, dass auch eine Änderung direkt vor dem
 * Schließen oder Neuladen nicht verloren geht. Beim Lesen gewinnt der neuere Stand.
 *
 * Für ein späteres Backend kann hier ein Sync-Adapter eingesetzt werden,
 * ohne dass sich die Oberfläche ändert.
 */
interface Envelope {
  t: number
  v: string
}

const LS_LIMIT = 2_500_000 // Zeichen; darüber nur IndexedDB (z. B. bei vielen Bildern)

function readLocal(name: string): Envelope | null {
  try {
    const raw = localStorage.getItem(name)
    return raw ? (JSON.parse(raw) as Envelope) : null
  } catch {
    return null
  }
}

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    const local = readLocal(name)
    let remote: Envelope | string | undefined
    try {
      remote = await get<Envelope | string>(name)
    } catch {
      remote = undefined
    }
    // ältere Versionen speicherten den reinen String
    const idb: Envelope | null = typeof remote === 'string' ? { t: 0, v: remote } : (remote ?? null)
    if (local && (!idb || local.t >= idb.t)) return local.v
    return idb?.v ?? null
  },
  setItem: async (name, value) => {
    const env: Envelope = { t: Date.now(), v: value }
    try {
      if (value.length < LS_LIMIT) localStorage.setItem(name, JSON.stringify(env))
      else localStorage.removeItem(name)
    } catch {
      // Kontingent voll → nur IndexedDB
      try {
        localStorage.removeItem(name)
      } catch {
        /* ignore */
      }
    }
    await set(name, env)
  },
  removeItem: async (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
    await del(name)
  },
}
