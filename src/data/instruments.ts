import list from './instruments.json'
import { matches } from '@/lib/utils'

// Bekannte Aktien und ETFs (DAX, MDAX/SDAX-Auswahl, USA, international, Sparplan-ETFs).
// Kurse kommen in der Web-Version kostenlos von Stooq (leicht verzögert).
export interface Instrument {
  id: string // App-Kürzel, z. B. SAP.DE, AAPL, EUNL.DE
  name: string
  type: 'Aktie' | 'ETF'
  sector: string
  country: string
  index: string // DAX, MDAX, SDAX, USA, Welt, ETF
  currency: string
}

export const INSTRUMENTS = list as unknown as Instrument[]
const byId = new Map(INSTRUMENTS.map((i) => [i.id.toUpperCase(), i]))

export const instrument = (id: string) => byId.get(id.toUpperCase())

export const INDEX_FILTERS = ['Alle', 'DAX', 'MDAX', 'SDAX', 'USA', 'Welt', 'ETF'] as const
export type IndexFilter = (typeof INDEX_FILTERS)[number]

export function searchInstruments(q: string, filter: IndexFilter = 'Alle') {
  return INSTRUMENTS.filter((i) => (filter === 'Alle' ? true : i.index === filter)).filter((i) => matches(q, i.name, i.id, i.sector, i.country))
}

export const COUNTRY_LABEL: Record<string, string> = {
  DE: 'Deutschland', US: 'USA', NL: 'Niederlande', GB: 'Großbritannien', FR: 'Frankreich', CH: 'Schweiz', DK: 'Dänemark', SE: 'Schweden',
  JP: 'Japan', TW: 'Taiwan', CN: 'China', AU: 'Australien', CA: 'Kanada', AR: 'Argentinien', BR: 'Brasilien',
  Welt: 'Welt (breit gestreut)', USA: 'USA', Europa: 'Europa', Schwellenländer: 'Schwellenländer',
}
