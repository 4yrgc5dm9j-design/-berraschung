import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { idbStorage } from './storage'
import { todayKey } from '@/lib/dates'

// Eigener Kursverlauf: Dailybase merkt sich je Wert einen Kurs pro Tag (letzter abgerufener Kurs,
// in Handelswährung). Damit entstehen Charts und Risikokennzahlen auch ohne historischen Datenanbieter.
const MAX_POINTS = 400

interface PriceHistoryState {
  series: Record<string, [string, number][]>
  record: (prices: Record<string, number>) => void
}

export const usePriceHistory = create<PriceHistoryState>()(
  persist(
    (set) => ({
      series: {},
      record: (prices) =>
        set((s) => {
          const day = todayKey()
          let changed = false
          const series = { ...s.series }
          for (const [id, price] of Object.entries(prices)) {
            if (!(price > 0)) continue
            const list = series[id] ?? []
            const last = list[list.length - 1]
            if (last && last[0] === day && last[1] === price) continue
            const next = last && last[0] === day ? [...list.slice(0, -1), [day, price] as [string, number]] : [...list, [day, price] as [string, number]]
            series[id] = next.slice(-MAX_POINTS)
            changed = true
          }
          return changed ? { series } : s
        }),
    }),
    { name: 'dailybase-prices', storage: createJSONStorage(() => idbStorage), partialize: (s) => ({ series: s.series }) },
  ),
)
