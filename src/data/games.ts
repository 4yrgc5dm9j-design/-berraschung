import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { idbStorage } from './storage'
import type { ManagerState } from '@/features/play/football/engine'

// Spielstände der Spiele (getrennt von den Alltagsdaten, damit die Hauptdaten schlank bleiben)
interface GamesState {
  football: ManagerState | null
  hydrated: boolean
  setFootball: (s: ManagerState | null) => void
}

export const useGames = create<GamesState>()(
  persist((set) => ({ football: null, hydrated: false, setFootball: (football) => set({ football }) }), {
    name: 'dailybase-games',
    storage: createJSONStorage(() => idbStorage),
    partialize: (s) => ({ football: s.football }),
    onRehydrateStorage: () => () => useGames.setState({ hydrated: true }),
  }),
)
