import type { DataState, Settings, ViewId, WidgetConfig, WidgetId } from './types'
import { nowIso, uid } from '@/lib/utils'
import { addDays, todayKey } from '@/lib/dates'

export const ALL_WIDGETS: WidgetId[] = [
  'agenda',
  'tasks',
  'weather',
  'quicklinks',
  'match',
  'watchlist',
  'news',
  'habits',
  'focus',
  'idea',
  'budget',
]

const layout = (visible: WidgetId[]): WidgetConfig[] => [
  ...visible.map((id) => ({ id, visible: true })),
  ...ALL_WIDGETS.filter((id) => !visible.includes(id)).map((id) => ({ id, visible: false })),
]

export const defaultDashboard = (): Record<ViewId, WidgetConfig[]> => ({
  arbeit: layout(['agenda', 'tasks', 'watchlist', 'news', 'weather', 'quicklinks', 'budget']),
  uni: layout(['agenda', 'tasks', 'focus', 'habits', 'weather', 'quicklinks']),
  freizeit: layout(['match', 'weather', 'idea', 'quicklinks', 'news', 'habits']),
})

export const defaultSettings = (): Settings => ({
  name: '',
  theme: 'light',
  accent: 'ozean',
  activeView: 'arbeit',
  interests: ['wirtschaft', 'technologie', 'sport'],
  clubs: [{ id: uid(), name: 'Hamburger SV', shortName: 'HSV', teamId: null, league: null, icon: null }],
  weather: { name: 'Hamburg', region: 'Deutschland', lat: 53.5507, lon: 9.993 },
  modules: { news: true, markets: true, sport: true, flashcards: true, habits: true, shopping: true, finance: true, focus: true },
  taskCategories: ['Arbeit', 'Uni', 'Privat', 'Finanzen'],
  expenseCategories: ['Lebensmittel', 'Wohnen', 'Mobilität', 'Freizeit', 'Essen gehen', 'Uni', 'Abos', 'Sonstiges'],
  monthlyBudget: 800,
  focus: { work: 25, short: 5, long: 15, rounds: 4 },
  dashboard: defaultDashboard(),
  finnhubKey: '',
  onboarded: false,
})

function base() {
  const t = nowIso()
  return { id: uid(), createdAt: t, updatedAt: t }
}

/** Startinhalte: nur Struktur und Hilfestellung, keine erfundenen Daten. */
export function seedData(): DataState {
  const today = todayKey()
  const collections = [
    { emoji: '🍝', name: 'Rezepte', color: '#f97316', description: 'Gerichte, die ich nachkochen will', randomLabel: 'Was kochen wir heute?' },
    { emoji: '🍽️', name: 'Restaurants', color: '#ef4444', description: 'Ausprobieren & Lieblingsorte', randomLabel: 'Wo gehen wir essen?' },
    { emoji: '✈️', name: 'Reiseziele', color: '#0ea5e9', description: 'Irgendwann mal hin', randomLabel: 'Wohin geht die nächste Reise?' },
    { emoji: '🚲', name: 'Ausflugsideen', color: '#22c55e', description: 'Für freie Wochenenden', randomLabel: 'Was machen wir am Wochenende?' },
    { emoji: '🎁', name: 'Geschenkideen', color: '#ec4899', description: 'Produkte, Outfits & Geschenke', randomLabel: 'Zufällige Geschenkidee' },
    { emoji: '🎬', name: 'Reels & Videos', color: '#a855f7', description: 'Instagram, YouTube & Co.', randomLabel: 'Was schauen wir?' },
    { emoji: '📚', name: 'Lernmaterial', color: '#6366f1', description: 'Artikel, Skripte, Tutorials', randomLabel: 'Was lerne ich heute?' },
  ].map((c) => ({ ...base(), ...c, shared: false }))

  return {
    tasks: [
      {
        ...base(),
        title: 'Dailybase einrichten: Name, Wetter-Ort und Verein prüfen',
        notes: 'Unter Profil findest du alle Einstellungen.',
        priority: 'medium',
        due: today,
        dueTime: null,
        category: 'Privat',
        recurrence: 'none',
        done: false,
        doneAt: null,
        sourceItemId: null,
      },
      {
        ...base(),
        title: 'Dailybase zum Homescreen hinzufügen',
        notes: 'iPhone: Safari → Teilen → „Zum Home-Bildschirm“.',
        priority: 'low',
        due: addDays(today, 1),
        dueTime: null,
        category: 'Privat',
        recurrence: 'none',
        done: false,
        doneAt: null,
        sourceItemId: null,
      },
    ],
    events: [],
    notes: [],
    collections,
    items: [],
    links: [
      { ...base(), label: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
      { ...base(), label: 'Spotify', url: 'https://open.spotify.com/', icon: 'spotify' },
      { ...base(), label: 'YouTube', url: 'https://www.youtube.com/', icon: 'youtube' },
      { ...base(), label: 'HSV', url: 'https://www.hsv.de/', icon: 'web' },
    ],
    decks: [],
    cards: [],
    focusSessions: [],
    habits: [
      { ...base(), name: 'Wasser trinken', emoji: '💧', days: [], targetPerWeek: 7, archived: false },
      { ...base(), name: 'Lernen', emoji: '📖', days: [], targetPerWeek: 5, archived: false },
      { ...base(), name: 'Sport', emoji: '🏃', days: [], targetPerWeek: 3, archived: false },
    ],
    shoppingLists: [{ ...base(), name: 'Einkauf', emoji: '🛒' }],
    shoppingItems: [],
    expenses: [],
    goals: [],
    portfolios: [
      { ...base(), name: 'Mein Depot', kind: 'real', startCash: 0 },
      { ...base(), name: 'Spieldepot', kind: 'virtual', startCash: 100000 },
    ],
    transactions: [],
    watchlist: [],
    prices: [],
    savedArticles: [],
  }
}

export const emptyData = (): DataState => ({
  tasks: [],
  events: [],
  notes: [],
  collections: [],
  items: [],
  links: [],
  decks: [],
  cards: [],
  focusSessions: [],
  habits: [],
  shoppingLists: [],
  shoppingItems: [],
  expenses: [],
  goals: [],
  portfolios: [],
  transactions: [],
  watchlist: [],
  prices: [],
  savedArticles: [],
})
