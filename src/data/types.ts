// Zentrales Datenmodell. Jede Entität hat id + Zeitstempel, damit später
// eine Synchronisation mit einem Backend (Konflikte über updatedAt) möglich ist.

export interface Entity {
  id: string
  createdAt: string
  updatedAt: string
}

export type Priority = 'low' | 'medium' | 'high'
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

export interface Task extends Entity {
  title: string
  notes: string
  priority: Priority
  due: string | null // YYYY-MM-DD
  dueTime: string | null // HH:mm
  category: string
  recurrence: Recurrence
  done: boolean
  doneAt: string | null
  sourceItemId: string | null
}

export type EventKind = 'termin' | 'pruefung' | 'vorlesung' | 'arbeit' | 'privat'

export interface CalEvent extends Entity {
  title: string
  date: string // YYYY-MM-DD (erster Termin)
  start: string | null // HH:mm
  end: string | null
  kind: EventKind
  location: string
  notes: string
  recurrence: Recurrence
}

export interface Note extends Entity {
  title: string
  body: string
  pinned: boolean
  color: NoteColor
  tags: string[]
}
export type NoteColor = 'none' | 'gelb' | 'gruen' | 'blau' | 'rosa' | 'lila'

export interface Collection extends Entity {
  name: string
  emoji: string
  color: string
  description: string
  randomLabel: string // z. B. „Was kochen wir heute?“
  shared: boolean // vorbereitet für gemeinsame Sammlungen
}

export type ItemKind = 'link' | 'note' | 'image'
export type LinkSource = 'instagram' | 'youtube' | 'tiktok' | 'spotify' | 'maps' | 'web'

export interface LinkPreview {
  title?: string
  description?: string
  image?: string
  siteName?: string
  fetchedAt: string
}

export interface CollectionItem extends Entity {
  collectionId: string
  kind: ItemKind
  title: string
  url: string
  source: LinkSource
  note: string
  image: string | null // Data-URL (lokal komprimiert)
  preview: LinkPreview | null
  rating: number // 0–5
  tags: string[]
  favorite: boolean
  done: boolean // „ausprobiert / erledigt“
}

export type QuickLinkIcon = 'instagram' | 'spotify' | 'youtube' | 'mail' | 'bank' | 'uni' | 'news' | 'web' | 'maps' | 'chat'

export interface QuickLink extends Entity {
  label: string
  url: string
  icon: QuickLinkIcon
}

export interface Deck extends Entity {
  name: string
  color: string
}

export interface Flashcard extends Entity {
  deckId: string
  front: string
  back: string
  box: number // Leitner-Fach 1–5
  dueDate: string // YYYY-MM-DD
}

export interface FocusSession extends Entity {
  startedAt: string
  minutes: number
  label: string
}

export interface Habit extends Entity {
  name: string
  emoji: string
  days: string[] // erledigte Tage YYYY-MM-DD
  targetPerWeek: number
  archived: boolean
}

export interface ShoppingList extends Entity {
  name: string
  emoji: string
}

export interface ShoppingItem extends Entity {
  listId: string
  name: string
  qty: string
  done: boolean
}

export interface Expense extends Entity {
  date: string
  amount: number // immer positiv
  type: 'expense' | 'income'
  category: string
  note: string
}

export interface SavingsGoal extends Entity {
  name: string
  emoji: string
  target: number
  saved: number
  deadline: string | null
}

export interface Portfolio extends Entity {
  name: string
  kind: 'real' | 'virtual'
  startCash: number // nur Spieldepot
}

export interface Transaction extends Entity {
  portfolioId: string
  symbol: string
  name: string
  type: 'buy' | 'sell'
  date: string
  qty: number
  price: number
  fees: number
}

export type AssetKind = 'Aktie' | 'ETF' | 'Fonds' | 'Krypto' | 'Sonstiges'

export interface WatchItem extends Entity {
  symbol: string
  name: string
  kind: AssetKind
  note: string
}

/** Manuell gepflegter Kurs, wenn keine Kursquelle verbunden ist. id = Symbol */
export interface ManualPrice extends Entity {
  price: number
}

export interface SavedArticle extends Entity {
  title: string
  link: string
  source: string
  publishedAt: string | null
  topic: string
  summary: string
}

export interface DataState {
  tasks: Task[]
  events: CalEvent[]
  notes: Note[]
  collections: Collection[]
  items: CollectionItem[]
  links: QuickLink[]
  decks: Deck[]
  cards: Flashcard[]
  focusSessions: FocusSession[]
  habits: Habit[]
  shoppingLists: ShoppingList[]
  shoppingItems: ShoppingItem[]
  expenses: Expense[]
  goals: SavingsGoal[]
  portfolios: Portfolio[]
  transactions: Transaction[]
  watchlist: WatchItem[]
  prices: ManualPrice[]
  savedArticles: SavedArticle[]
}

export type EntityKey = keyof DataState
export type EntityOf<K extends EntityKey> = DataState[K][number]

// ---------------- Einstellungen & Dashboard ----------------

export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentId = 'ozean' | 'smaragd' | 'koralle' | 'violett' | 'bernstein' | 'raute'
export type ViewId = 'arbeit' | 'uni' | 'freizeit'
export type NewsTopic = 'wirtschaft' | 'finanzen' | 'technologie' | 'politik' | 'sport' | 'wissen'
export type ModuleId = 'news' | 'markets' | 'sport' | 'flashcards' | 'habits' | 'shopping' | 'finance' | 'focus'

export type WidgetId =
  | 'tasks'
  | 'agenda'
  | 'weather'
  | 'quicklinks'
  | 'news'
  | 'watchlist'
  | 'match'
  | 'habits'
  | 'focus'
  | 'idea'
  | 'budget'

export interface WidgetConfig {
  id: WidgetId
  visible: boolean
}

export interface Club {
  id: string
  name: string // wie bei OpenLigaDB, z. B. „Hamburger SV“
  shortName: string
  teamId: number | null
  league: string | null // OpenLigaDB-Kürzel, z. B. bl1, bl2
  icon: string | null
}

export interface WeatherLocation {
  name: string
  region: string
  lat: number
  lon: number
}

export interface Settings {
  name: string
  theme: ThemeMode
  accent: AccentId
  activeView: ViewId
  interests: NewsTopic[]
  clubs: Club[]
  weather: WeatherLocation | null
  modules: Record<ModuleId, boolean>
  taskCategories: string[]
  expenseCategories: string[]
  monthlyBudget: number
  focus: { work: number; short: number; long: number; rounds: number }
  dashboard: Record<ViewId, WidgetConfig[]>
  onboarded: boolean
}
