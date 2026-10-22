import { actions } from '@/data/store'
import { emptyData } from '@/data/defaults'
import type { DataState, Settings } from '@/data/types'
import { toast, useToasts } from '@/data/toasts'
import { todayKey } from '@/lib/dates'
import { useGames } from '@/data/games'
import type { ManagerState } from '@/features/play/football/engine'

const FORMAT = 'dailybase-backup'

export function exportData() {
  const { data, settings } = actions()
  // Persönlicher API-Schlüssel gehört nicht in Sicherungsdateien
  const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data, settings: { ...settings, finnhubKey: '' }, games: { football: useGames.getState().football } }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dailybase-${todayKey()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast('Export erstellt', 'success')
}

/** Prüft die Datei grob und ersetzt danach alle Daten – mit „Rückgängig“. */
export async function importData(file: File) {
  let parsed: { format?: string; data?: Partial<DataState>; settings?: Partial<Settings>; games?: { football?: unknown } }
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return toast('Die Datei ist keine gültige JSON-Datei.', 'error')
  }
  if (parsed.format !== FORMAT || !parsed.data || typeof parsed.data !== 'object') {
    return toast('Das ist keine Dailybase-Sicherung.', 'error')
  }
  const base = emptyData()
  const data = { ...base }
  for (const key of Object.keys(base) as (keyof DataState)[]) {
    const v = parsed.data[key]
    if (v !== undefined && !Array.isArray(v)) return toast(`Ungültige Daten im Bereich „${key}“.`, 'error')
    if (Array.isArray(v)) data[key] = v.filter((e) => e && typeof e === 'object' && typeof e.id === 'string') as never
  }
  const snap = { data: actions().data, settings: actions().settings }
  const footballBefore = useGames.getState().football
  if (parsed.games?.football && typeof parsed.games.football === 'object') useGames.getState().setFootball(parsed.games.football as ManagerState)
  actions().replaceAll(data, { ...(parsed.settings ?? snap.settings), finnhubKey: snap.settings.finnhubKey } as Settings)
  const n = Object.values(data).reduce((a, l) => a + l.length, 0)
  useToasts.getState().push({ message: `${n} Einträge importiert`, tone: 'success', action: { label: 'Rückgängig', run: () => {
        actions().replaceAll(snap.data, snap.settings)
        useGames.getState().setFootball(footballBefore)
      } } }, 10000)
}
