import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import { Badge, Card, Chip } from '@/components/ui'
import { useData } from '@/data/store'
import { cn, fmtEur, fmtPct, normalize } from '@/lib/utils'
import { useQuotes } from '@/services/hooks'
import { POPULAR } from '@/features/discover/markets'
import { savingsPlan, summarize, type PortfolioSummary } from '@/features/discover/portfolio'

// Regelbasierter Börsen-Assistent: rechnet mit deinen eigenen Daten und erklärt Begriffe.
// Bewusst KEINE KI und keine Anlageberatung.

const GLOSSARY: { keys: string[]; title: string; text: string }[] = [
  { keys: ['etf', 'indexfonds'], title: 'ETF', text: 'Ein ETF (Exchange Traded Fund) ist ein börsengehandelter Fonds, der meist einen Index wie den MSCI World nachbildet. Vorteile: breite Streuung mit einer Order, niedrige Kosten (TER oft 0,1–0,3 % p. a.). Risiko: Er fällt mit dem Markt.' },
  { keys: ['kgv', 'kurs-gewinn', 'kursgewinn'], title: 'KGV', text: 'Das Kurs-Gewinn-Verhältnis = Aktienkurs ÷ Gewinn je Aktie. Ein KGV von 20 heißt: Du zahlst das 20-Fache des Jahresgewinns. Niedrig kann „günstig“ bedeuten – oder dass der Markt wenig Wachstum erwartet. Immer mit der Branche vergleichen.' },
  { keys: ['dividende', 'ausschuettung', 'ausschüttung'], title: 'Dividende', text: 'Eine Dividende ist die Gewinnausschüttung eines Unternehmens an seine Aktionäre. Die Dividendenrendite = Dividende ÷ Kurs. Achtung: Der Kurs sinkt am Ex-Tag ungefähr um die ausgeschüttete Summe.' },
  { keys: ['volatil', 'schwankung'], title: 'Volatilität', text: 'Volatilität misst, wie stark ein Kurs schwankt. Hohe Volatilität = größere Chancen, aber auch größere Rückschläge. Einzelaktien schwanken meist deutlich stärker als breite ETFs.' },
  { keys: ['diversif', 'streu'], title: 'Diversifikation', text: 'Diversifikation heißt: Geld auf viele Werte, Branchen und Länder verteilen, damit ein einzelner Absturz nicht das ganze Depot trifft. Faustregel: keine Einzelposition über 10–20 % des Depots.' },
  { keys: ['zinseszins', 'compound'], title: 'Zinseszins', text: 'Beim Zinseszins werden Erträge wieder angelegt und bringen selbst Erträge. Darum wirkt Zeit so stark: Wer früh anfängt, profitiert überproportional. Im Rechner unter Börse kannst du es ausprobieren.' },
  { keys: ['spread', 'geld-brief', 'geldbrief'], title: 'Spread', text: 'Der Spread ist die Differenz zwischen Kauf- (Brief) und Verkaufskurs (Geld). Er ist ein versteckter Kostenfaktor – bei liquiden Werten klein, bei Nebenwerten oft groß.' },
  { keys: ['limit', 'stop', 'order'], title: 'Ordertypen', text: 'Market-Order: sofort zum aktuellen Kurs. Limit-Order: nur bis zu einem Höchstpreis (Kauf) bzw. ab einem Mindestpreis (Verkauf). Stop-Loss: wird zur Market-Order, wenn ein Kurs unterschritten wird – begrenzt Verluste, garantiert aber keinen Preis.' },
  { keys: ['thesaur', 'akkumul'], title: 'Thesaurierend vs. ausschüttend', text: 'Thesaurierende Fonds legen Erträge automatisch wieder an (gut für den Zinseszins), ausschüttende zahlen sie aus. In Deutschland wird bei thesaurierenden Fonds jährlich die Vorabpauschale besteuert.' },
  { keys: ['ter', 'kosten', 'gebuehr', 'gebühr'], title: 'Kosten (TER)', text: 'Die TER (Total Expense Ratio) sind die laufenden jährlichen Fondskosten. 0,2 % vs. 1,5 % klingt klein, macht über 30 Jahre aber oft fünfstellige Beträge aus. Dazu kommen Ordergebühren und Spreads.' },
  { keys: ['drawdown', 'crash', 'absturz'], title: 'Drawdown', text: 'Der Drawdown ist der Verlust vom Höchststand bis zum Tiefpunkt. Breite Aktienmärkte hatten historisch Drawdowns von 30–50 %. Wichtig ist, solche Phasen aushalten zu können – deshalb Notgroschen und langfristiger Horizont.' },
  { keys: ['msci', 'world', 'index'], title: 'Index', text: 'Ein Index bündelt viele Aktien zu einer Kennzahl, z. B. DAX (40 deutsche Unternehmen), S&P 500 (500 US-Unternehmen) oder MSCI World (rund 1.400 Unternehmen aus Industrieländern).' },
  { keys: ['steuer', 'freibetrag', 'sparerpausch'], title: 'Steuern (vereinfacht)', text: 'Kapitalerträge werden in Deutschland pauschal mit 25 % plus Soli (und ggf. Kirchensteuer) besteuert. Der Sparerpauschbetrag von 1.000 € pro Person und Jahr bleibt steuerfrei, wenn du einen Freistellungsauftrag erteilst.' },
]

interface Msg {
  from: 'user' | 'bot'
  text: string
  lines?: string[]
}

function depotCheck(label: string, s: PortfolioSummary | null): Msg {
  if (!s || s.positions.length === 0) return { from: 'bot', text: `${label}: Noch keine Positionen – erfasse Käufe, dann kann ich dein Depot prüfen.` }
  const total = s.value + (s.cash ?? 0)
  const biggest = [...s.positions].sort((a, b) => (b.value ?? b.cost) - (a.value ?? a.cost))[0]
  const share = (biggest.value ?? biggest.cost) / Math.max(s.value, 1)
  const gain = s.value - s.invested
  const lines = [
    `${s.positions.length} Position(en), Wert ${fmtEur(s.value)}${s.cash != null ? `, Cash ${fmtEur(s.cash)}` : ''}.`,
    `Unrealisiert: ${gain >= 0 ? '+' : ''}${fmtEur(gain)} (${fmtPct(s.invested ? gain / s.invested : 0)}).`,
    `Größte Position: ${biggest.name} mit ${fmtPct(share).replace('+', '')} des investierten Werts.`,
  ]
  if (share > 0.4) lines.push('⚠️ Klumpenrisiko: Mehr als 40 % stecken in einem Wert. Ein breiter ETF könnte das Risiko streuen.')
  else if (s.positions.length < 5) lines.push('💡 Wenige Positionen – das Depot ist noch wenig gestreut.')
  else lines.push('✅ Die Streuung über Einzelwerte sieht ausgewogen aus.')
  if (s.cash != null && total > 0 && s.cash / total > 0.5) lines.push('💡 Über die Hälfte liegt noch als Cash – im Spiel bringt das keine Rendite.')
  if (s.unpriced > 0) lines.push(`ℹ️ ${s.unpriced} Position(en) ohne aktuellen Kurs – dort rechne ich mit dem Einstand.`)
  if (s.fees > 0 && s.invested > 0 && s.fees / s.invested > 0.01) lines.push(`💸 Gebühren machen ${fmtPct(s.fees / s.invested).replace('+', '')} deines Einsatzes aus – größere, seltenere Orders sparen Kosten.`)
  return { from: 'bot', text: `${label}:`, lines }
}

export function Assistant() {
  const portfolios = useData('portfolios')
  const tx = useData('transactions')
  const prices = useData('prices')
  const watch = useData('watchlist')
  const symbols = useMemo(() => [...new Set([...watch.map((w) => w.symbol), ...POPULAR.map((p) => p.symbol), ...tx.map((t) => t.symbol)])], [watch, tx])
  const q = useQuotes(symbols)
  const quotes = q.data?.quotes ?? null
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: 'Hallo! Ich bin dein Börsen-Assistent. Ich prüfe dein Depot, zeige die Tagesbewegungen und erkläre Börsenbegriffe. Wähle eine Frage oder tippe einen Begriff wie „ETF“ oder „KGV“.' },
  ])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [msgs])

  const sum = (kind: 'real' | 'virtual') => {
    const p = portfolios.find((x) => x.kind === kind)
    return p ? summarize(p, tx, prices, quotes) : null
  }

  const answer = (question: string): Msg => {
    const n = normalize(question)
    if (/spiel/.test(n) && /depot|check|pruef/.test(n)) return depotCheck('Spieldepot', sum('virtual'))
    if (/depot|portfolio|check|pruef|risiko/.test(n)) return depotCheck('Mein Depot', sum('real'))
    if (/gewinner|verlierer|beweg|heute|markt/.test(n)) {
      if (!quotes) return { from: 'bot', text: 'Für Tagesbewegungen brauche ich Kurse. Verbinde sie unter Profil → Börsenkurse über Google (kostenlos).' }
      const list = Object.values(quotes).filter((x) => x.changePct != null).sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
      const fmt = (x: (typeof list)[number]) => `${x.symbol}: ${fmtPct(x.changePct ?? 0)}`
      return { from: 'bot', text: `Tagesbewegungen deiner beobachteten Werte (${q.data?.source ?? 'Kurse'}):`, lines: [`📈 Gewinner: ${list.slice(0, 3).map(fmt).join(' · ')}`, `📉 Verlierer: ${list.slice(-3).reverse().map(fmt).join(' · ')}`] }
    }
    if (/sparplan|monatlich|sparen|vermoegen/.test(n)) {
      const rows = savingsPlan({ start: 0, monthly: 100, years: 20, ratePct: 6, dynamicPct: 0, inflationPct: 0 })
      const last = rows[rows.length - 1]
      return { from: 'bot', text: 'Beispielrechnung Sparplan:', lines: [`100 € monatlich, 20 Jahre, 6 % p. a. → etwa ${fmtEur(last.value, true)}.`, `Davon eingezahlt: ${fmtEur(last.deposits, true)}, Erträge: ${fmtEur(last.gains, true)}.`, 'Eigene Werte rechnest du unter Entdecken → Börse → Rechner.'] }
    }
    const g = GLOSSARY.find((e) => e.keys.some((k) => n.includes(normalize(k))))
    if (g) return { from: 'bot', text: `${g.title}: ${g.text}` }
    return { from: 'bot', text: 'Das kann ich als regelbasierter Assistent noch nicht beantworten. Ich kenne: Depot-Check, Tagesbewegungen, Sparplan und Begriffe wie ' + GLOSSARY.map((e) => e.title).join(', ') + '.' }
  }

  const ask = (question: string) => {
    if (!question.trim()) return
    setMsgs((m) => [...m, { from: 'user', text: question }, answer(question)])
    setInput('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="flex min-h-[480px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <span className="hero-gradient grid size-10 place-items-center rounded-2xl text-white">
            <Bot className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-display font-semibold">Börsen-Assistent</p>
            <p className="text-xs text-muted">Regelbasiert · rechnet mit deinen Daten · keine Anlageberatung</p>
          </div>
          <Badge tone="neutral">Ohne KI</Badge>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex', m.from === 'user' && 'justify-end')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', m.from === 'user' ? 'rounded-br-md bg-accent text-accent-fg' : 'rounded-bl-md bg-surface-2')}>
                <p>{m.text}</p>
                {m.lines && (
                  <ul className="mt-1.5 space-y-1">
                    {m.lines.map((l, k) => (
                      <li key={k}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="border-t border-line p-3">
          <div className="scroll-x mb-2 flex gap-2">
            {['Prüfe mein Depot', 'Prüfe mein Spieldepot', 'Gewinner & Verlierer heute', 'Was bringt ein Sparplan?', 'Was ist ein ETF?', 'Was bedeutet KGV?'].map((s) => (
              <Chip key={s} onClick={() => ask(s)}>
                {s}
              </Chip>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              ask(input)
            }}
          >
            <input className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Frage oder Begriff eingeben …" aria-label="Frage an den Assistenten" />
            <button type="submit" aria-label="Senden" className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </Card>
      <Card className="h-fit p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-5 text-accent" />
          <p className="font-display font-semibold">Das kann ich</p>
        </div>
        <ul className="space-y-2 text-sm text-muted">
          <li>📋 <b className="text-text">Depot-Check</b> – Streuung, Klumpenrisiko, Cash-Anteil, Gebühren</li>
          <li>📈 <b className="text-text">Tagesbewegungen</b> – Gewinner und Verlierer (mit Live-Kursen)</li>
          <li>💶 <b className="text-text">Sparplan</b> – was regelmäßiges Sparen bringen kann</li>
          <li>📚 <b className="text-text">Lexikon</b> – {GLOSSARY.map((e) => e.title).join(', ')}</li>
        </ul>
        <p className="mt-3 text-xs text-faint">Läuft komplett auf deinem Gerät, kostenlos und ohne Weitergabe deiner Daten.</p>
      </Card>
    </div>
  )
}
