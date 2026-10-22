import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { idbStorage } from './storage'
import { defaultDashboard, defaultSettings, emptyData, seedData, ALL_WIDGETS } from './defaults'
import type { DataState, Entity, EntityKey, EntityOf, Settings } from './types'
import { nowIso, uid } from '@/lib/utils'
import { useToasts } from './toasts'

type NewEntity<K extends EntityKey> = Omit<EntityOf<K>, keyof Entity> & Partial<Entity>

/** Abhängige Daten, die beim Löschen mit entfernt (und beim Rückgängig-Machen wiederhergestellt) werden. */
const cascades: Partial<Record<EntityKey, { key: EntityKey; field: string }[]>> = {
  collections: [{ key: 'items', field: 'collectionId' }],
  decks: [{ key: 'cards', field: 'deckId' }],
  shoppingLists: [{ key: 'shoppingItems', field: 'listId' }],
  portfolios: [{ key: 'transactions', field: 'portfolioId' }],
}

export interface AppState {
  data: DataState
  settings: Settings
  hydrated: boolean
  add: <K extends EntityKey>(key: K, value: NewEntity<K>) => EntityOf<K>
  update: <K extends EntityKey>(key: K, id: string, patch: Partial<EntityOf<K>>) => void
  /** Löscht einen Eintrag und bietet „Rückgängig“ an. */
  remove: <K extends EntityKey>(key: K, id: string, label?: string) => void
  removeMany: <K extends EntityKey>(key: K, ids: string[], label: string) => void
  setList: <K extends EntityKey>(key: K, list: DataState[K]) => void
  upsert: <K extends EntityKey>(key: K, value: EntityOf<K>) => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: DataState, settings: Settings) => void
  resetAll: () => void
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      data: seedData(),
      settings: defaultSettings(),
      hydrated: false,

      add: (key, value) => {
        const t = nowIso()
        const entity = { id: uid(), createdAt: t, updatedAt: t, ...value } as unknown as EntityOf<typeof key>
        set((s) => ({ data: { ...s.data, [key]: [...(s.data[key] as Entity[]), entity] } }))
        return entity
      },

      update: (key, id, patch) => {
        set((s) => ({
          data: {
            ...s.data,
            [key]: (s.data[key] as Entity[]).map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowIso() } : e)),
          },
        }))
      },

      upsert: (key, value) => {
        const list = get().data[key] as Entity[]
        const exists = list.some((e) => e.id === (value as Entity).id)
        set((s) => ({
          data: {
            ...s.data,
            [key]: exists
              ? list.map((e) => (e.id === (value as Entity).id ? { ...value, updatedAt: nowIso() } : e))
              : [...list, value],
          },
        }))
      },

      remove: (key, id, label = 'Eintrag gelöscht') => get().removeMany(key, [id], label),

      removeMany: (key, ids, label) => {
        const before = get().data
        const idSet = new Set(ids)
        const next: DataState = { ...before, [key]: (before[key] as Entity[]).filter((e) => !idSet.has(e.id)) }
        for (const c of cascades[key] ?? []) {
          next[c.key] = (before[c.key] as unknown as Record<string, unknown>[]).filter(
            (e) => !idSet.has(e[c.field] as string),
          ) as never
        }
        set({ data: next })
        const touched: EntityKey[] = [key, ...(cascades[key] ?? []).map((c) => c.key)]
        useToasts.getState().push(
          {
            message: label,
            action: {
              label: 'Rückgängig',
              run: () => {
                // Nur die gelöschten Einträge zurückholen, spätere Änderungen bleiben erhalten.
                const cur = get().data
                const restored: Partial<DataState> = {}
                for (const k of touched) {
                  const curIds = new Set((cur[k] as Entity[]).map((e) => e.id))
                  const missing = (before[k] as Entity[]).filter((e) => !curIds.has(e.id))
                  const merged = [...(cur[k] as Entity[]), ...missing]
                  // ursprüngliche Reihenfolge so gut wie möglich beibehalten
                  const order = new Map((before[k] as Entity[]).map((e, i) => [e.id, i]))
                  merged.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
                  restored[k] = merged as never
                }
                set({ data: { ...cur, ...restored } })
              },
            },
          },
          7000,
        )
      },

      setList: (key, list) => set((s) => ({ data: { ...s.data, [key]: list } })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: (data, settings) => set({ data: { ...emptyData(), ...data }, settings: normalizeSettings(settings) }),

      resetAll: () => set({ data: seedData(), settings: defaultSettings() }),
    }),
    {
      name: 'dailybase-v1',
      version: 3,
      migrate: (persisted, version) => {
        const p = persisted as Partial<AppState>
        // v2: neues, helles Design – wer „System“ eingestellt hatte, startet einmalig in Hell
        if (version < 2 && p?.settings?.theme === 'system') p.settings = { ...p.settings, theme: 'light' }
        // v3: Spieldepot startet mit 100.000 € statt 10.000 €
        if (version < 3 && p?.data?.portfolios)
          p.data = { ...p.data, portfolios: p.data.portfolios.map((x) => (x.kind === 'virtual' && x.startCash === 10000 ? { ...x, startCash: 100000 } : x)) }
        return p as AppState
      },
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ data: s.data, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          data: p.data ? { ...emptyData(), ...p.data } : current.data,
          settings: p.settings ? normalizeSettings(p.settings) : current.settings,
        }
      },
      onRehydrateStorage: () => () => {
        useApp.setState({ hydrated: true })
      },
    },
  ),
)

/** Fehlende Felder (z. B. nach Updates der App) mit Standardwerten auffüllen. */
export function normalizeSettings(s: Partial<Settings>): Settings {
  const d = defaultSettings()
  const merged: Settings = { ...d, ...s, modules: { ...d.modules, ...s.modules }, focus: { ...d.focus, ...s.focus } }
  const dash = { ...defaultDashboard(), ...(s.dashboard ?? {}) }
  for (const view of Object.keys(dash) as (keyof typeof dash)[]) {
    const known = dash[view].filter((w) => ALL_WIDGETS.includes(w.id))
    const missing = ALL_WIDGETS.filter((id) => !known.some((w) => w.id === id)).map((id) => ({ id, visible: false }))
    dash[view] = [...known, ...missing]
  }
  merged.dashboard = dash
  return merged
}

// Bequeme Selektoren
export const useData = <K extends EntityKey>(key: K) => useApp((s) => s.data[key])
export const useSettings = () => useApp((s) => s.settings)
export const actions = () => useApp.getState()
