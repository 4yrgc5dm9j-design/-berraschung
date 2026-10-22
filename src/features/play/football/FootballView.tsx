import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRightLeft, Dumbbell, ListOrdered, Play, RotateCcw, Shirt, Sparkles, Trophy } from 'lucide-react'
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, Field, Modal, ProgressBar, Segmented, SectionTitle } from '@/components/ui'
import { useGames } from '@/data/games'
import { useSettings } from '@/data/store'
import { toast } from '@/data/toasts'
import { cn, fmtEur } from '@/lib/utils'
import { normalize } from '@/lib/utils'
import { useRemote } from '@/services/remote'
import { fetchTeams } from '@/services/sport'
import { staticData } from '@/services/server'
import { timeAgo } from '@/lib/dates'
import {
  FORMATIONS,
  POS_LABEL,
  bestLineup,
  buyPlayer,
  lineupStrength,
  newGame,
  nextSeason,
  playMatchday,
  seasonOver,
  sellPlayer,
  table,
  type Formation,
  type ManagerState,
  type MatchResult,
  type Player,
  type RealClub,
  type Pos,
  type Tactic,
  type TrainingFocus,
} from './engine'

const FALLBACK_CLUBS = [
  ['FC Bayern München', 'FCB'], ['Borussia Dortmund', 'BVB'], ['Bayer 04 Leverkusen', 'B04'], ['RB Leipzig', 'RBL'], ['VfB Stuttgart', 'VFB'],
  ['Eintracht Frankfurt', 'SGE'], ['SC Freiburg', 'SCF'], ['VfL Wolfsburg', 'WOB'], ['Borussia Mönchengladbach', 'BMG'], ['Werder Bremen', 'SVW'],
  ['1. FSV Mainz 05', 'M05'], ['TSG Hoffenheim', 'TSG'], ['FC Augsburg', 'FCA'], ['1. FC Union Berlin', 'FCU'], ['1. FC Heidenheim', 'FCH'],
  ['FC St. Pauli', 'STP'], ['1. FC Köln', 'KOE'], ['Hamburger SV', 'HSV'],
].map(([name, short]) => ({ name, short }))

const mio = (v: number) => `${(v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`
/** weißer Knopf auf farbigem Hintergrund */
export const heroBtn = 'inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-semibold text-[var(--accent-strong)] shadow-lg transition active:scale-[0.97]'
const posColor: Record<Pos, string> = { TW: '#f59e0b', AB: '#3b82f6', MF: '#10b981', ST: '#ef4444' }

function PosBadge({ pos }: { pos: Pos }) {
  return (
    <span className="inline-grid w-8 shrink-0 place-items-center rounded-md py-0.5 text-[11px] font-bold text-white" style={{ background: posColor[pos] }}>
      {pos}
    </span>
  )
}

/** kleines Kennzeichen: an EA FC angelehnt oder geschätzt */
function SourceMark({ p }: { p: Player }) {
  if (p.source === 'ea') return <span title="Wert an EA-FC-Rating angelehnt (ungefähr)" className="mr-1 align-middle text-[9px] font-bold text-accent">EA</span>
  if (p.source === 'schaetzung') return <span title="Wert geschätzt" className="mr-1 align-middle text-[10px] font-bold text-faint">≈</span>
  return null
}

// ---------------------------------------------------------------- Start
/** Echte Kader aus der Web-Version (data/squads.json, täglich von der GitHub Action erzeugt) */
export function useSquads() {
  return useRemote('squads', () => staticData<{ fetchedAt: string; clubs: RealClub[] }>('squads.json', 15000), 6 * 3600e3)
}

function NewGame({ onStart }: { onStart: (s: ManagerState) => void }) {
  const { clubs: favs } = useSettings()
  const teams = useRemote('teams:bl1', () => fetchTeams('bl1'), 24 * 3600e3)
  const squads = useSquads()
  const real = squads.data?.clubs.filter((c) => c.players.length >= 11) ?? []
  const list = useMemo(() => {
    if (squads.data && squads.data.clubs.length === 18) return squads.data.clubs.map((c) => ({ name: c.name, short: c.short }))
    const t = teams.data ?? []
    return t.length === 18 ? t.map((x) => ({ name: x.teamName, short: x.shortName || x.teamName.slice(0, 3).toUpperCase() })) : FALLBACK_CLUBS
  }, [teams.data, squads.data])
  const fav = favs[0] ? list.findIndex((c) => normalize(c.name).includes(normalize(favs[0].name))) : -1
  const [choice, setChoice] = useState(-1)
  const sel = choice >= 0 ? choice : fav >= 0 ? fav : 0
  return (
    <Card className="overflow-hidden">
      <div className="hero-gradient relative p-6 text-white">
        <Trophy className="absolute -right-4 -top-4 size-32 opacity-15" />
        <h2 className="font-display text-2xl font-bold">Fußballmanager</h2>
        <p className="mt-1 max-w-lg text-white/85">Übernimm einen Verein, stell die Elf auf, wähle Taktik und Training, kauf Spieler – und führ dein Team durch die Saison.</p>
      </div>
      <div className="p-5">
        <Field label="Dein Verein">
          <select className="field" value={sel} onChange={(e) => setChoice(Number(e.target.value))}>
            {list.map((c, i) => (
              <option key={c.name} value={i}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {real.length > 0 ? (
          <p className="mt-3 rounded-xl bg-success/10 p-3 text-xs text-muted">
            <b className="text-success">Echte Kader</b> von {real.length} Vereinen aus Wikidata (Stand {timeAgo(squads.data!.fetchedAt)}, kann Wechseln etwas hinterherhinken). Stärken angelehnt an EA-FC-Ratings (ungefähr, nicht offiziell) bzw. geschätzt.
          </p>
        ) : (
          <p className="mt-3 text-xs text-faint">{squads.loading ? 'Echte Kader werden geladen …' : 'Echte Kader sind gerade nicht verfügbar – du spielst mit erfundenen Spielern.'} Ergebnisse werden simuliert.</p>
        )}
        <Button variant="primary" size="lg" className="mt-4 w-full sm:w-auto" icon={<Play className="size-5" />} disabled={squads.loading && !squads.data} onClick={() => onStart(newGame(list, sel, Date.now(), real))}>
          Karriere starten
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Live-Ticker
function Ticker({ result, state, onClose }: { result: MatchResult | null; state: ManagerState; onClose: () => void }) {
  const [minute, setMinute] = useState(0)
  useEffect(() => {
    if (!result) return
    setMinute(0)
    const i = setInterval(() => setMinute((m) => (m >= 90 ? 90 : m + 1)), 55)
    return () => clearInterval(i)
  }, [result])
  if (!result) return null
  const home = state.clubs.find((c) => c.id === result.home)!
  const away = state.clubs.find((c) => c.id === result.away)!
  const shown = result.events.filter((e) => e.minute <= minute)
  const score = [shown.filter((e) => e.type === 'tor' && e.team === 'home').length, shown.filter((e) => e.type === 'tor' && e.team === 'away').length]
  const done = minute >= 90
  return (
    <Modal
      open
      onClose={onClose}
      title="Live-Ticker"
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Weiter
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setMinute(90)}>
            Überspringen
          </Button>
        )
      }
    >
      <div className="rounded-3xl bg-[#0f1a14] p-5 text-white">
        <div className="mb-2 text-center text-xs font-semibold text-white/60">{done ? 'Abpfiff' : `${minute}. Minute`}</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <span className={cn('font-semibold', home.isUser && 'text-emerald-300')}>{home.name}</span>
          <span className="font-display text-4xl font-bold tabular">
            {score[0]}:{score[1]}
          </span>
          <span className={cn('font-semibold', away.isUser && 'text-emerald-300')}>{away.name}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${(minute / 90) * 100}%` }} />
        </div>
      </div>
      <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
        {[...shown].reverse().map((e, i) => (
          <li key={i} className={cn('flex gap-3 rounded-xl px-3 py-2 text-sm', e.type === 'tor' ? 'bg-success/12 font-semibold' : 'bg-surface-2')}>
            <span className="w-8 shrink-0 text-muted tabular">{e.minute}'</span>
            <span>{e.type === 'tor' ? '⚽ ' : e.type === 'karte' ? '🟨 ' : ''}{e.text}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="py-4 text-center text-sm text-muted">Anpfiff!</li>}
      </ul>
    </Modal>
  )
}

// ---------------------------------------------------------------- Bereiche
function Overview({ s, rows }: { s: ManagerState; rows: ReturnType<typeof table> }) {
  const next = s.schedule[s.matchday]?.find((f) => f.home === s.clubId || f.away === s.clubId)
  const opp = next ? s.clubs.find((c) => c.id === (next.home === s.clubId ? next.away : next.home)) : null
  const str = lineupStrength(s)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle>Nächstes Spiel</SectionTitle>
        {opp && next ? (
          <div>
            <p className="text-sm text-muted">
              {s.matchday + 1}. Spieltag · {next.home === s.clubId ? 'Heimspiel' : 'Auswärtsspiel'}
            </p>
            <p className="mt-1 font-display text-xl font-bold">gegen {opp.name}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-24 text-muted">Deine Elf</span>
                <ProgressBar value={(str.overall - 50) / 40} className="flex-1" />
                <span className="w-8 text-right font-semibold tabular">{Math.round(str.overall)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-muted">Gegner</span>
                <ProgressBar value={(opp.strength - 50) / 40} tone="warn" className="flex-1" />
                <span className="w-8 text-right font-semibold tabular">{opp.strength}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted">Die Saison ist beendet.</p>
        )}
      </Card>
      <Card className="p-5">
        <SectionTitle>Vereinsnachrichten</SectionTitle>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {s.log.slice(0, 12).map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-10 shrink-0 text-xs text-faint">{l.matchday ? `ST ${l.matchday}` : ''}</span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5 lg:col-span-2">
        <SectionTitle>Tabelle (Ausschnitt)</SectionTitle>
        <TableView s={s} rows={rows} compact />
      </Card>
    </div>
  )
}

function TableView({ s, rows, compact }: { s: ManagerState; rows: ReturnType<typeof table>; compact?: boolean }) {
  const own = rows.findIndex((r) => r.clubId === s.clubId)
  const visible = compact ? rows.filter((_, i) => Math.abs(i - own) <= 2 || i < 1) : rows
  return (
    <table className="w-full text-sm tabular">
      <thead className="text-xs uppercase tracking-wider text-faint">
        <tr>
          <th className="py-2 text-left">#</th>
          <th className="py-2 text-left">Verein</th>
          <th className="py-2 text-right">Sp</th>
          <th className="hidden py-2 text-right sm:table-cell">S-U-N</th>
          <th className="py-2 text-right">Tore</th>
          <th className="py-2 text-right">Pkt</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((r) => {
          const i = rows.indexOf(r)
          const c = s.clubs.find((x) => x.id === r.clubId)!
          return (
            <tr key={r.clubId} className={cn('border-t border-line', c.isUser && 'bg-accent-soft font-bold')}>
              <td className={cn('py-2', i < 4 && 'text-success', i >= 15 && 'text-danger')}>{i + 1}</td>
              <td className="max-w-40 truncate py-2">{c.name}</td>
              <td className="py-2 text-right">{r.played}</td>
              <td className="hidden py-2 text-right sm:table-cell">
                {r.won}-{r.draw}-{r.lost}
              </td>
              <td className="py-2 text-right">
                {r.gf}:{r.ga}
              </td>
              <td className="py-2 text-right font-bold">{r.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Squad({ s, update }: { s: ManagerState; update: (n: ManagerState) => void }) {
  const [confirm, setConfirm] = useState<Player | null>(null)
  const need = { TW: 1, ...FORMATIONS[s.formation] }
  const counts = (pos: Pos) => s.lineup.filter((id) => s.squad.find((p) => p.id === id)?.pos === pos).length
  const toggle = (p: Player) => {
    if (p.injuredDays > 0) return toast(`${p.name} ist verletzt.`)
    if (s.lineup.includes(p.id)) update({ ...s, lineup: s.lineup.filter((x) => x !== p.id) })
    else if (s.lineup.length >= 11) toast('Schon 11 Spieler aufgestellt – erst jemanden herausnehmen.')
    else update({ ...s, lineup: [...s.lineup, p.id] })
  }
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-display text-lg font-semibold">Kader · {s.lineup.length}/11 aufgestellt</h3>
        <Button size="sm" variant="soft" icon={<Sparkles className="size-4" />} onClick={() => update({ ...s, lineup: bestLineup(s.squad, s.formation) })}>
          Beste Elf
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(['TW', 'AB', 'MF', 'ST'] as Pos[]).map((pos) => (
          <span key={pos} className={cn('rounded-full px-2.5 py-1 font-semibold', counts(pos) === need[pos] ? 'bg-success/12 text-success' : 'bg-warn/14 text-warn')}>
            {POS_LABEL[pos]} {counts(pos)}/{need[pos]}
          </span>
        ))}
      </div>
      <div className="divide-y divide-line">
        {(['TW', 'AB', 'MF', 'ST'] as Pos[]).flatMap((pos) =>
          s.squad
            .filter((p) => p.pos === pos)
            .sort((a, b) => b.rating - a.rating)
            .map((p) => {
              const on = s.lineup.includes(p.id)
              return (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <button onClick={() => toggle(p)} aria-pressed={on} aria-label={`${p.name} ${on ? 'aus der Startelf nehmen' : 'aufstellen'}`} className={cn('grid size-8 shrink-0 place-items-center rounded-lg border-2 text-xs font-bold', on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong text-faint')}>
                    {on ? '✓' : ''}
                  </button>
                  <PosBadge pos={p.pos} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-semibold', p.injuredDays > 0 && 'text-danger')}>
                      {p.name} {p.injuredDays > 0 && '🚑'}
                    </p>
                    <p className="text-xs text-muted">
                      {p.age} J. · Form {p.form > 0 ? `+${p.form}` : p.form} · {p.games} Sp. · {p.goals} Tore
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold leading-none tabular">
                      <SourceMark p={p} />
                      {p.rating}
                    </p>
                    <p className="text-[11px] text-faint">{mio(p.value)}</p>
                  </div>
                  <button className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2" onClick={() => setConfirm(p)}>
                    Verkaufen
                  </button>
                </div>
              )
            }),
        )}
      </div>
      <ConfirmDialog
        open={!!confirm}
        title="Spieler verkaufen?"
        message={confirm ? `${confirm.name} für ca. ${mio(confirm.value * 0.9)} verkaufen?` : ''}
        confirmLabel="Verkaufen"
        onConfirm={() => {
          if (!confirm) return
          const r = sellPlayer(s, confirm.id)
          if (typeof r === 'string') toast(r, 'error')
          else update(r)
        }}
        onClose={() => setConfirm(null)}
      />
    </Card>
  )
}

function TacticsView({ s, update }: { s: ManagerState; update: (n: ManagerState) => void }) {
  const str = lineupStrength(s)
  const trainings: { v: TrainingFocus; label: string; hint: string }[] = [
    { v: 'technik', label: 'Technik', hint: 'Junge Spieler entwickeln sich schneller' },
    { v: 'taktik', label: 'Taktik', hint: 'Ausgewogene Entwicklung' },
    { v: 'kondition', label: 'Kondition', hint: 'Weniger Verletzungen' },
    { v: 'erholung', label: 'Erholung', hint: 'Bessere Form, kaum Entwicklung' },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <Field label="Formation" group>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
              <Chip key={f} active={s.formation === f} onClick={() => update({ ...s, formation: f, lineup: bestLineup(s.squad, f) })}>
                {f}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Spielweise" group>
          <Segmented<Tactic>
            className="w-full"
            value={s.tactic}
            onChange={(tactic) => update({ ...s, tactic })}
            options={[
              { value: 'defensiv', label: 'Defensiv' },
              { value: 'ausgewogen', label: 'Ausgewogen' },
              { value: 'offensiv', label: 'Offensiv' },
            ]}
          />
        </Field>
        <Field label="Trainingsschwerpunkt" group>
          <div className="grid grid-cols-2 gap-2">
            {trainings.map((t) => (
              <button key={t.v} onClick={() => update({ ...s, training: t.v })} className={cn('rounded-2xl border p-3 text-left text-sm', s.training === t.v ? 'border-accent bg-accent-soft' : 'border-line')}>
                <span className="block font-semibold">{t.label}</span>
                <span className="text-xs text-muted">{t.hint}</span>
              </button>
            ))}
          </div>
        </Field>
      </Card>
      <Card className="space-y-3 p-5">
        <SectionTitle>Teamstärke</SectionTitle>
        {[
          ['Angriff', str.attack],
          ['Abwehr', str.defense],
          ['Gesamt', str.overall],
        ].map(([l, v]) => (
          <div key={l as string} className="flex items-center gap-3 text-sm">
            <span className="w-20 text-muted">{l}</span>
            <ProgressBar value={((v as number) - 50) / 40} className="flex-1" />
            <span className="w-8 text-right font-semibold tabular">{Math.round(v as number)}</span>
          </div>
        ))}
        <p className="pt-2 text-xs text-faint">Offensiv stärkt den Angriff, schwächt aber die Abwehr. Spieler auf falschen oder leeren Positionen kosten Stärke.</p>
      </Card>
    </div>
  )
}

function Transfers({ s, update }: { s: ManagerState; update: (n: ManagerState) => void }) {
  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle action={<Badge tone="accent">Budget {mio(s.budget)}</Badge>}>Transfermarkt</SectionTitle>
      <p className="mb-3 text-sm text-muted">Neue Angebote alle 3 Spieltage. Kader: {s.squad.length}/28 Spieler.</p>
      {s.market.length === 0 ? (
        <EmptyState inline title="Keine Spieler auf dem Markt" text="Nach dem nächsten Spieltag gibt es neue Angebote." />
      ) : (
        <div className="divide-y divide-line">
          {s.market.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <PosBadge pos={p.pos} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {p.age} J. · Potenzial {p.potential}
                  {p.club && ` · ${p.club}`}
                </p>
              </div>
              <span className="font-display text-lg font-bold tabular">
                <SourceMark p={p} />
                {p.rating}
              </span>
              <Button
                size="sm"
                variant={p.value <= s.budget ? 'primary' : 'secondary'}
                disabled={p.value > s.budget}
                onClick={() => {
                  const r = buyPlayer(s, p.id)
                  if (typeof r === 'string') toast(r, 'error')
                  else {
                    update(r)
                    toast(`${p.name} verpflichtet`, 'success')
                  }
                }}
              >
                {mio(p.value)}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function RealSquadsHint({ onRestart }: { onRestart: () => void }) {
  const squads = useSquads()
  if (!squads.data?.clubs.some((c) => c.players.length >= 11)) return null
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
      <Sparkles className="size-5 text-accent" />
      <p className="flex-1 text-muted">
        <b className="text-text">Jetzt mit echten Kadern:</b> Starte ein neues Spiel, um mit den echten Spielern deines Vereins zu spielen.
      </p>
      <Button size="sm" variant="soft" onClick={onRestart}>
        Neues Spiel
      </Button>
    </Card>
  )
}

// ---------------------------------------------------------------- Haupt
type Tab = 'start' | 'kader' | 'taktik' | 'transfers' | 'tabelle'

export function FootballView() {
  const s = useGames((g) => g.football)
  const set = useGames((g) => g.setFootball)
  const [tab, setTab] = useState<Tab>('start')
  const [ticker, setTicker] = useState<{ result: MatchResult; state: ManagerState } | null>(null)
  const [reset, setReset] = useState(false)
  const hydrated = useGames((g) => g.hydrated)
  const rows = useMemo(() => (s ? table(s) : []), [s])

  if (!hydrated) return null
  if (!s) return <NewGame onStart={(n) => set(n)} />

  const club = s.clubs.find((c) => c.id === s.clubId)!
  const rank = rows.findIndex((r) => r.clubId === s.clubId) + 1
  const over = seasonOver(s)

  const play = () => {
    if (s.lineup.length < 11) {
      toast('Bitte 11 Spieler aufstellen (oder „Beste Elf“).', 'error')
      setTab('kader')
      return
    }
    const { state, own } = playMatchday(s)
    set(state)
    if (own) setTicker({ result: own, state })
  }

  return (
    <div className="space-y-4">
      <div className="hero-gradient relative overflow-hidden rounded-[28px] p-5 text-white">
        <Shirt className="pointer-events-none absolute -right-6 -top-6 size-36 opacity-10" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/75">
              Saison {s.season} · {over ? 'beendet' : `${s.matchday + 1}. von ${s.schedule.length} Spieltagen`}
            </p>
            <h2 className="font-display text-3xl font-bold">{club.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/18 px-3 py-1 font-semibold">Platz {rank}</span>
              <span className="rounded-full bg-white/18 px-3 py-1 font-semibold">{mio(s.budget)}</span>
              <span className="rounded-full bg-white/18 px-3 py-1 font-semibold">Ziel: {s.objective.label}</span>
            </div>
          </div>
          {over ? (
            <button className={heroBtn} onClick={() => set(nextSeason(s))}>
              <Trophy className="size-5" /> Nächste Saison
            </button>
          ) : (
            <button className={heroBtn} onClick={play}>
              <Play className="size-5" /> Spieltag spielen
            </button>
          )}
        </div>
      </div>

      {!s.realSquads && <RealSquadsHint onRestart={() => setReset(true)} />}

      {over && (
        <Card className="p-5">
          <p className="font-display text-xl font-bold">{rank <= s.objective.maxRank ? '🏆 Saisonziel erreicht!' : '😬 Saisonziel verpasst'}</p>
          <p className="text-muted">
            Platz {rank} mit {rows[rank - 1].points} Punkten. Prämie zur neuen Saison: {fmtEur(Math.max(0, (19 - rank) * 600_000), true)}.
          </p>
        </Card>
      )}

      <div className="scroll-x -mx-1 flex gap-2 px-1">
        {(
          [
            ['start', 'Übersicht', Activity],
            ['kader', 'Kader', Shirt],
            ['taktik', 'Taktik & Training', Dumbbell],
            ['transfers', 'Transfers', ArrowRightLeft],
            ['tabelle', 'Tabelle', ListOrdered],
          ] as const
        ).map(([v, l, Icon]) => (
          <Chip key={v} active={tab === v} onClick={() => setTab(v)}>
            <Icon className="size-4" /> {l}
          </Chip>
        ))}
      </div>

      <div key={tab} className="animate-rise">
        {tab === 'start' && <Overview s={s} rows={rows} />}
        {tab === 'kader' && <Squad s={s} update={set} />}
        {tab === 'taktik' && <TacticsView s={s} update={set} />}
        {tab === 'transfers' && <Transfers s={s} update={set} />}
        {tab === 'tabelle' && (
          <Card className="p-4 sm:p-5">
            <TableView s={s} rows={rows} />
            {s.history.length > 0 && <p className="mt-3 text-xs text-muted">Bisher: {s.history.map((h) => `Saison ${h.season}: Platz ${h.rank}`).join(' · ')}</p>}
          </Card>
        )}
      </div>

      <Button variant="ghost" className="text-danger" icon={<RotateCcw className="size-4" />} onClick={() => setReset(true)}>
        Spiel neu starten
      </Button>
      {ticker && <Ticker result={ticker.result} state={ticker.state} onClose={() => setTicker(null)} />}
      <ConfirmDialog open={reset} title="Spiel neu starten?" message="Der aktuelle Spielstand wird gelöscht." confirmLabel="Neu starten" onConfirm={() => set(null)} onClose={() => setReset(false)} />
    </div>
  )
}
