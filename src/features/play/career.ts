// Karriere-Simulator: vereinfachte Modellannahmen (keine echten Gehaltsdaten!).
// Jeder Pfad wird viele Male mit Zufallsereignissen durchgespielt (Monte-Carlo).
import { rng } from './football/engine'

export interface CareerPath {
  id: string
  name: string
  emoji: string
  summary: string
  color: string
  /** Jahre ohne volles Gehalt am Anfang (z. B. Vollzeit-Master) */
  ramp: { years: number; salary: number }
  start: number // Bruttogehalt im ersten vollen Jahr
  growth: number // mittleres jährliches Wachstum
  volatility: number // Schwankung des Wachstums
  workload: number // 0–100
  security: number // 0–100
  events: { label: string; chance: number; effect: 'raise' | 'bonus' | 'setback' | 'jobloss'; size: [number, number]; from?: number }[]
}

export const PATHS: CareerPath[] = [
  {
    id: 'bank-privat',
    name: 'Bank: Kundenberater → Filialleitung',
    emoji: '🏦',
    summary: 'Klassischer Weg in der Bank, solide und planbar.',
    color: '#3b82f6',
    ramp: { years: 0, salary: 0 },
    start: 46000,
    growth: 0.03,
    volatility: 0.012,
    workload: 55,
    security: 85,
    events: [
      { label: 'Beförderung zum Senior-Berater', chance: 0.12, effect: 'raise', size: [0.08, 0.14], from: 3 },
      { label: 'Übernahme einer Filialleitung', chance: 0.06, effect: 'raise', size: [0.15, 0.25], from: 8 },
      { label: 'Filialschließung, Versetzung', chance: 0.03, effect: 'setback', size: [0.02, 0.05] },
    ],
  },
  {
    id: 'bank-firmen',
    name: 'Bank + Bachelor → Firmenkunden/Spezialist',
    emoji: '📊',
    summary: 'Studium nebenbei abschließen und als Spezialist aufsteigen.',
    color: '#8b5cf6',
    ramp: { years: 2, salary: 46000 },
    start: 52000,
    growth: 0.04,
    volatility: 0.018,
    workload: 65,
    security: 80,
    events: [
      { label: 'Wechsel ins Firmenkundengeschäft', chance: 0.15, effect: 'raise', size: [0.1, 0.16], from: 2 },
      { label: 'Abteilungsleitung', chance: 0.05, effect: 'raise', size: [0.18, 0.3], from: 8 },
      { label: 'Gute Jahresprämie', chance: 0.2, effect: 'bonus', size: [0.05, 0.12] },
    ],
  },
  {
    id: 'ib',
    name: 'Master → Investment Banking/Beratung',
    emoji: '💼',
    summary: 'Hohe Gehälter und Boni, aber lange Arbeitstage.',
    color: '#ef4444',
    ramp: { years: 2, salary: 12000 },
    start: 75000,
    growth: 0.08,
    volatility: 0.04,
    workload: 92,
    security: 55,
    events: [
      { label: 'Hoher Bonus', chance: 0.45, effect: 'bonus', size: [0.15, 0.45] },
      { label: 'Beförderung (Associate → VP)', chance: 0.12, effect: 'raise', size: [0.15, 0.3], from: 3 },
      { label: 'Stellenabbau im Team', chance: 0.06, effect: 'jobloss', size: [0.3, 0.6] },
      { label: 'Erschöpfung – Auszeit', chance: 0.04, effect: 'setback', size: [0.2, 0.4] },
    ],
  },
  {
    id: 'fintech',
    name: 'Wechsel in ein FinTech/Startup',
    emoji: '🚀',
    summary: 'Spannend, schnell, unsicher – mit kleiner Chance auf einen Exit.',
    color: '#10b981',
    ramp: { years: 0, salary: 0 },
    start: 58000,
    growth: 0.05,
    volatility: 0.06,
    workload: 75,
    security: 40,
    events: [
      { label: 'Startup muss schließen – Jobsuche', chance: 0.08, effect: 'jobloss', size: [0.3, 0.6] },
      { label: 'Exit! Anteile werden verkauft', chance: 0.025, effect: 'bonus', size: [1, 6] },
      { label: 'Teamlead-Rolle', chance: 0.12, effect: 'raise', size: [0.1, 0.2], from: 2 },
    ],
  },
  {
    id: 'aufsicht',
    name: 'Aufsicht / öffentlicher Dienst',
    emoji: '🏛️',
    summary: 'Sehr sicher, geregelte Arbeitszeiten, moderate Gehälter.',
    color: '#f59e0b',
    ramp: { years: 0, salary: 0 },
    start: 52000,
    growth: 0.025,
    volatility: 0.005,
    workload: 45,
    security: 97,
    events: [{ label: 'Stufenaufstieg', chance: 0.33, effect: 'raise', size: [0.03, 0.05] }],
  },
  {
    id: 'selbst',
    name: 'Selbstständig: Honorar-Finanzberatung',
    emoji: '🧭',
    summary: 'Eigener Chef, Aufbau braucht Zeit, Einkommen schwankt.',
    color: '#ec4899',
    ramp: { years: 2, salary: 30000 },
    start: 55000,
    growth: 0.07,
    volatility: 0.12,
    workload: 80,
    security: 35,
    events: [
      { label: 'Großer Neukunde', chance: 0.15, effect: 'raise', size: [0.08, 0.2] },
      { label: 'Schwaches Jahr', chance: 0.12, effect: 'setback', size: [0.1, 0.25] },
    ],
  },
]

export interface Priorities {
  money: number // 0–10
  time: number
  safety: number
}

export interface RunYear {
  year: number
  salary: number
  wealth: number
  event?: string
}

/** Ein simulierter Lebenslauf. Netto ≈ 60 % vom Brutto (vereinfachte Annahme). */
export function simulateRun(path: CareerPath, years: number, savingsRate: number, returnPct: number, seed: number): RunYear[] {
  const r = rng(seed)
  const out: RunYear[] = []
  let salary = path.start
  let wealth = 0
  for (let y = 1; y <= years; y++) {
    let income: number
    let event: string | undefined
    if (y <= path.ramp.years) {
      income = path.ramp.salary
      event = y === 1 && path.ramp.years ? (path.ramp.salary < 20000 ? 'Studium (Werkstudent)' : 'Studium neben dem Job') : undefined
    } else {
      // Normalverteilung grob über Summe von Zufallszahlen
      const noise = (r() + r() + r() - 1.5) * path.volatility * 2
      salary *= 1 + path.growth + noise
      income = salary
      for (const e of path.events) {
        if (e.from && y - path.ramp.years < e.from) continue
        if (r() >= e.chance) continue
        const size = e.size[0] + r() * (e.size[1] - e.size[0])
        event = e.label
        if (e.effect === 'raise') salary *= 1 + size
        if (e.effect === 'setback') {
          salary *= 1 - size / 2
          income *= 1 - size
        }
        if (e.effect === 'jobloss') income *= 1 - size
        if (e.effect === 'bonus') income += salary * size
        break
      }
    }
    wealth = wealth * (1 + returnPct / 100) + income * 0.6 * (savingsRate / 100)
    out.push({ year: y, salary: Math.round(income), wealth: Math.round(wealth), event })
  }
  return out
}

export interface PathResult {
  path: CareerPath
  median: number[] // Medianeinkommen pro Jahr
  p10: number
  p90: number
  wealthMedian: number
  score: number
}

function quantile(sorted: number[], q: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}

export function comparePaths(ids: string[], years: number, savingsRate: number, returnPct: number, prio: Priorities, runs = 300): PathResult[] {
  const results = ids.map((id) => {
    const path = PATHS.find((p) => p.id === id)!
    const perYear: number[][] = Array.from({ length: years }, () => [])
    const wealth: number[] = []
    for (let i = 0; i < runs; i++) {
      const run = simulateRun(path, years, savingsRate, returnPct, 1000 + i * 31 + id.length)
      run.forEach((y, k) => perYear[k].push(y.salary))
      wealth.push(run[run.length - 1].wealth)
    }
    const last = [...perYear[years - 1]].sort((a, b) => a - b)
    wealth.sort((a, b) => a - b)
    return {
      path,
      median: perYear.map((ys) => quantile([...ys].sort((a, b) => a - b), 0.5)),
      p10: quantile(last, 0.1),
      p90: quantile(last, 0.9),
      wealthMedian: quantile(wealth, 0.5),
      score: 0,
    }
  })
  // Persönliche Bewertung: Geld relativ zum besten Pfad, Freizeit, Sicherheit
  const maxWealth = Math.max(...results.map((r) => r.wealthMedian), 1)
  const total = prio.money + prio.time + prio.safety || 1
  for (const r of results)
    r.score = Math.round(((r.wealthMedian / maxWealth) * 100 * prio.money + (100 - r.path.workload) * prio.time + r.path.security * prio.safety) / total)
  return results.sort((a, b) => b.score - a.score)
}
