import { useEffect, useState } from 'react'
import { MapPin, Plus, Trash2, Trophy, Users } from 'lucide-react'
import { Badge, Button, Card, Chip, EmptyState, ErrorNote, Field, IconButton, Modal, PlannedBadge, Skeleton, SourceLine } from '@/components/ui'
import { actions, useSettings } from '@/data/store'
import { useToasts } from '@/data/toasts'
import type { Club } from '@/data/types'
import { cn, uid } from '@/lib/utils'
import { relativeDay, toDateKey } from '@/lib/dates'
import { useClub } from '@/services/hooks'
import { useRemote } from '@/services/remote'
import { LEAGUES, fetchTeams, finalScore, resultFor, type Match, type TableRow } from '@/services/sport'

const OLDB = { source: 'OpenLigaDB', href: 'https://www.openligadb.de' }

export function TeamLogo({ src, name, className = 'size-8' }: { src?: string | null; name: string; className?: string }) {
  const [err, setErr] = useState(false)
  if (!src || err)
    return <span className={cn('grid shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-bold', className)}>{name.slice(0, 3).toUpperCase()}</span>
  return <img src={src} alt="" className={cn('shrink-0 object-contain', className)} onError={() => setErr(true)} referrerPolicy="no-referrer" />
}

export function matchTime(m: Match) {
  const d = new Date(m.matchDateTimeUTC)
  return { day: relativeDay(toDateKey(d)), time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }
}

export function MatchHero({ m, teamId }: { m: Match; teamId: number }) {
  const { day, time } = matchTime(m)
  const score = finalScore(m)
  const started = new Date(m.matchDateTimeUTC).getTime() <= Date.now()
  const live = started && !m.matchIsFinished
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted">
        <span>
          {m.leagueName} · {m.group.groupName}
        </span>
        {live ? <Badge tone="danger">Läuft</Badge> : <span>{day}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {[m.team1, m.team2].map((t, i) => (
          <div key={t.teamId} className={cn('flex flex-col items-center gap-2 text-center', i === 1 && 'order-3')}>
            <TeamLogo src={t.teamIconUrl} name={t.shortName || t.teamName} className="size-14" />
            <span className={cn('text-sm font-semibold leading-tight', t.teamId === teamId && 'text-accent')}>{t.shortName || t.teamName}</span>
          </div>
        ))}
        <div className="order-2 text-center">
          {score && (m.matchIsFinished || live) ? (
            <p className="font-display text-3xl font-bold tabular">
              {score[0]}:{score[1]}
            </p>
          ) : live ? (
            <p className="font-display text-2xl font-bold text-danger">Live</p>
          ) : (
            <p className="font-display text-2xl font-bold tabular">{time}</p>
          )}
          <p className="text-xs text-muted">{m.matchIsFinished ? 'Endstand' : live ? 'Zwischenstand' : 'Anstoß'}</p>
        </div>
      </div>
      {m.location?.locationStadium && (
        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted">
          <MapPin className="size-3" /> {m.location.locationStadium}
          {m.location.locationCity && `, ${m.location.locationCity}`}
        </p>
      )}
    </div>
  )
}

function FormDots({ matches, teamId }: { matches: Match[]; teamId: number }) {
  return (
    <div className="flex gap-1">
      {matches.slice(-5).map((m) => {
        const r = resultFor(m, teamId)
        return (
          <span
            key={m.matchID}
            title={`${m.team1.shortName} ${finalScore(m)?.join(':')} ${m.team2.shortName}`}
            className={cn('grid size-7 place-items-center rounded-lg text-xs font-bold text-white', r === 'S' ? 'bg-success' : r === 'N' ? 'bg-danger' : 'bg-faint')}
          >
            {r}
          </span>
        )
      })}
    </div>
  )
}

function Table({ rows, teamId }: { rows: TableRow[]; teamId: number | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular">
        <thead className="text-xs uppercase tracking-wider text-faint">
          <tr>
            <th className="py-2 pr-2 text-left">#</th>
            <th className="py-2 text-left">Verein</th>
            <th className="px-1 py-2 text-right">Sp</th>
            <th className="hidden px-1 py-2 text-right sm:table-cell">S</th>
            <th className="hidden px-1 py-2 text-right sm:table-cell">U</th>
            <th className="hidden px-1 py-2 text-right sm:table-cell">N</th>
            <th className="px-1 py-2 text-right">Tore</th>
            <th className="py-2 pl-2 text-right">Pkt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamInfoId} className={cn('border-t border-line', r.teamInfoId === teamId && 'bg-accent-soft font-bold')}>
              <td className="py-2 pr-2 text-muted">{i + 1}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <TeamLogo src={r.teamIconUrl} name={r.shortName || r.teamName} className="size-5" />
                  <span className="truncate">{r.teamName}</span>
                </span>
              </td>
              <td className="px-1 py-2 text-right">{r.matches}</td>
              <td className="hidden px-1 py-2 text-right sm:table-cell">{r.won}</td>
              <td className="hidden px-1 py-2 text-right sm:table-cell">{r.draw}</td>
              <td className="hidden px-1 py-2 text-right sm:table-cell">{r.lost}</td>
              <td className="px-1 py-2 text-right">
                {r.goals}:{r.opponentGoals}
              </td>
              <td className="py-2 pl-2 text-right font-bold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ClubPanel({ club }: { club: Club }) {
  const { resolving, notFound, resolveError, matches, table, derived } = useClub(club)
  const [view, setView] = useState<'spiele' | 'tabelle'>('spiele')

  if (resolving || (!club.league && !notFound && !resolveError))
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  if (resolveError && !club.league) return <ErrorNote error={resolveError} />
  if (notFound)
    return (
      <Card>
        <EmptyState compact icon="🔎" title={`„${club.name}“ nicht gefunden`} text="Der Verein wurde in 1. Liga, 2. Liga und 3. Liga dieser Saison nicht gefunden. Füge ihn über „Verein“ aus der Liste hinzu." />
      </Card>
    )
  if (matches.error && !matches.data) return <ErrorNote error={matches.error} onRetry={matches.reload} />
  if (!derived || !club.teamId)
    return (
      <Card className="p-5">
        <Skeleton className="h-24 w-full" />
      </Card>
    )

  const leagueName = LEAGUES.find((l) => l.id === club.league)?.name
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <Card className="p-5" style={{ background: 'linear-gradient(160deg, var(--accent-soft), var(--surface) 60%)' }}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent">{derived.live ? 'Live' : 'Nächstes Spiel'}</p>
          {derived.live ?? derived.next ? (
            <MatchHero m={(derived.live ?? derived.next)!} teamId={club.teamId} />
          ) : (
            <p className="text-sm text-muted">Kein weiteres Spiel in dieser Saison im Spielplan.</p>
          )}
        </Card>
        {derived.past.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold">Form</p>
              <FormDots matches={derived.past} teamId={club.teamId} />
            </div>
          </Card>
        )}
        <SourceLine source={OLDB.source} href={OLDB.href} fetchedAt={matches.fetchedAt} stale={matches.stale} loading={matches.loading} onReload={() => { matches.reload(); table.reload() }} />
      </div>
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Chip active={view === 'spiele'} onClick={() => setView('spiele')}>
              Spielplan
            </Chip>
            <Chip active={view === 'tabelle'} onClick={() => setView('tabelle')}>
              Tabelle
            </Chip>
          </div>
          <span className="text-xs text-muted">{leagueName}</span>
        </div>
        {view === 'spiele' ? (
          <MatchList matches={derived.all} teamId={club.teamId} />
        ) : table.data ? (
          <Table rows={table.data} teamId={club.teamId} />
        ) : table.error ? (
          <ErrorNote error={table.error} onRetry={table.reload} compact />
        ) : (
          <Skeleton className="h-60 w-full" />
        )}
      </Card>
    </div>
  )
}

function MatchList({ matches, teamId }: { matches: Match[]; teamId: number }) {
  const [showAll, setShowAll] = useState(false)
  const nextIdx = matches.findIndex((m) => !m.matchIsFinished)
  const from = showAll ? 0 : Math.max(0, (nextIdx === -1 ? matches.length : nextIdx) - 3)
  const list = showAll ? matches : matches.slice(from, from + 8)
  return (
    <div>
      {!showAll && from > 0 && (
        <button onClick={() => setShowAll(true)} className="mb-2 min-h-9 w-full rounded-lg text-sm font-semibold text-accent hover:bg-accent-soft">
          Ganze Saison anzeigen
        </button>
      )}
      <div className="divide-y divide-line">
        {list.map((m) => {
          const s = finalScore(m)
          const r = resultFor(m, teamId)
          const { day, time } = matchTime(m)
          return (
            <div key={m.matchID} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted">
                {m.group.groupName.replace('. Spieltag', '. ST')}
                <span className="block">{m.matchIsFinished ? new Date(m.matchDateTimeUTC).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : `${day}, ${time}`}</span>
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                <span className={cn('truncate', m.team1.teamId === teamId && 'font-bold')}>{m.team1.shortName || m.team1.teamName}</span>
                <TeamLogo src={m.team1.teamIconUrl} name={m.team1.shortName} className="size-5" />
              </span>
              <span className={cn('w-12 shrink-0 rounded-md py-0.5 text-center font-bold tabular', r === 'S' && 'bg-success/15 text-success', r === 'N' && 'bg-danger/15 text-danger', r === 'U' && 'bg-surface-3')}>
                {m.matchIsFinished && s ? `${s[0]}:${s[1]}` : '–:–'}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <TeamLogo src={m.team2.teamIconUrl} name={m.team2.shortName} className="size-5" />
                <span className={cn('truncate', m.team2.teamId === teamId && 'font-bold')}>{m.team2.shortName || m.team2.teamName}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ClubPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [league, setLeague] = useState('bl1')
  const teams = useRemote(open ? `teams:${league}` : null, () => fetchTeams(league), 24 * 3600 * 1000)
  const settings = useSettings()
  useEffect(() => {
    if (!open) setLeague('bl1')
  }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Verein hinzufügen">
      <Field label="Liga" group>
        <div className="flex gap-2">
          {LEAGUES.map((l) => (
            <Chip key={l.id} active={league === l.id} onClick={() => setLeague(l.id)}>
              {l.name}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="mt-4">
        {teams.loading && !teams.data ? (
          <Skeleton className="h-40 w-full" />
        ) : teams.error && !teams.data ? (
          <ErrorNote error={teams.error} onRetry={teams.reload} compact />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[...(teams.data ?? [])]
              .sort((a, b) => a.teamName.localeCompare(b.teamName, 'de'))
              .map((t) => {
                const has = settings.clubs.some((c) => c.teamId === t.teamId)
                return (
                  <button
                    key={t.teamId}
                    disabled={has}
                    onClick={() => {
                      actions().setSettings({ clubs: [...settings.clubs, { id: uid(), name: t.teamName, shortName: t.shortName, teamId: t.teamId, league, icon: t.teamIconUrl }] })
                      onClose()
                    }}
                    className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-2 text-left text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
                  >
                    <TeamLogo src={t.teamIconUrl} name={t.shortName} className="size-6" />
                    <span className="truncate">{t.teamName}</span>
                  </button>
                )
              })}
          </div>
        )}
        <SourceLine className="mt-3" source={OLDB.source} href={OLDB.href} />
      </div>
    </Modal>
  )
}

export function SportView() {
  const settings = useSettings()
  const [active, setActive] = useState(settings.clubs[0]?.id ?? null)
  const [picker, setPicker] = useState(false)
  const club = settings.clubs.find((c) => c.id === active) ?? settings.clubs[0]

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="scroll-x -mx-1 flex flex-1 gap-2 px-1">
          {settings.clubs.map((c) => (
            <Chip key={c.id} active={c.id === club?.id} onClick={() => setActive(c.id)}>
              {c.icon && <TeamLogo src={c.icon} name={c.shortName} className="size-4" />}
              {c.shortName || c.name}
            </Chip>
          ))}
          <Chip onClick={() => setPicker(true)}>
            <Plus className="size-4" /> Verein
          </Chip>
        </div>
        {club && (
          <IconButton
            label={`${club.name} entfernen`}
            size="sm"
            onClick={() => {
              const before = settings.clubs
              actions().setSettings({ clubs: before.filter((c) => c.id !== club.id) })
              useToasts.getState().push({ message: `${club.shortName || club.name} entfernt`, action: { label: 'Rückgängig', run: () => actions().setSettings({ clubs: before }) } })
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        )}
      </div>
      {club ? (
        <ClubPanel key={club.id} club={club} />
      ) : (
        <Card>
          <EmptyState icon={<Trophy className="size-6" />} title="Kein Lieblingsverein" text="Wähle deinen Verein – Spielplan, Ergebnisse und Tabelle kommen von OpenLigaDB." action={<Button variant="primary" onClick={() => setPicker(true)}>Verein wählen</Button>} />
        </Card>
      )}
      <Card className="mt-5 flex items-center gap-3 border-dashed p-4 text-sm">
        <Users className="size-5 text-muted" />
        <div className="flex-1">
          <p className="font-semibold">Tippspiel mit Freunden</p>
          <p className="text-muted">Spieltage tippen und gegeneinander antreten – braucht Benutzerkonten.</p>
        </div>
        <PlannedBadge />
      </Card>
      <ClubPicker open={picker} onClose={() => setPicker(false)} />
    </div>
  )
}
