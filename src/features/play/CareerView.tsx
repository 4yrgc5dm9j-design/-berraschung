import { useMemo, useState } from 'react'
import { Dices, Info } from 'lucide-react'
import { Button, Card, Chip, Field, Modal, SectionTitle } from '@/components/ui'
import { AreaChart } from '@/components/ui/charts'
import { cn, fmtEur, parseNum } from '@/lib/utils'
import { PATHS, comparePaths, simulateRun, type Priorities } from './career'

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted tabular">{value}/10</span>
      </span>
      <input type="range" min={0} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
    </label>
  )
}

export function CareerView() {
  const [selected, setSelected] = useState<string[]>(['bank-privat', 'bank-firmen', 'ib'])
  const [years, setYears] = useState(15)
  const [savings, setSavings] = useState('20')
  const [ret, setRet] = useState('5')
  const [prio, setPrio] = useState<Priorities>({ money: 6, time: 5, safety: 5 })
  const [story, setStory] = useState<{ id: string; seed: number } | null>(null)

  const savingsRate = Math.min(80, Math.max(0, parseNum(savings) || 0))
  const returnPct = parseNum(ret) || 0
  const results = useMemo(() => comparePaths(selected, years, savingsRate, returnPct, prio), [selected, years, savingsRate, returnPct, prio])

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : s.length >= 4 ? [...s.slice(1), id] : [...s, id]))
  const points = Array.from({ length: years }, (_, i) => Object.fromEntries([['year', i + 1], ...results.map((r) => [r.path.id, r.median[i]])]))
  const storyPath = story ? PATHS.find((p) => p.id === story.id)! : null
  const storyRun = story && storyPath ? simulateRun(storyPath, years, savingsRate, returnPct, story.seed) : []

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-3 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>Modellrechnung mit stark vereinfachten Annahmen – keine echten Gehaltsdaten und keine Karriereberatung. Jeder Weg wird 300-mal mit Zufallsereignissen durchgespielt; gezeigt wird der Median.</p>
      </div>

      <Card className="p-4 sm:p-5">
        <SectionTitle>Karrierewege vergleichen (bis zu 4)</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PATHS.map((p) => {
            const on = selected.includes(p.id)
            return (
              <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={on} className={cn('flex items-start gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-transparent bg-accent-soft ring-2 ring-accent' : 'border-line hover:bg-surface-2')}>
                <span className="text-2xl">{p.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug">{p.name}</span>
                  <span className="block text-xs text-muted">{p.summary}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="space-y-4 p-4 sm:p-5">
          <h3 className="font-display text-lg font-semibold">Deine Annahmen</h3>
          <Field label={`Zeitraum: ${years} Jahre`}>
            <input type="range" min={5} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sparquote (% netto)">
              <input className="field" inputMode="decimal" value={savings} onChange={(e) => setSavings(e.target.value)} />
            </Field>
            <Field label="Rendite p. a. (%)">
              <input className="field" inputMode="decimal" value={ret} onChange={(e) => setRet(e.target.value)} />
            </Field>
          </div>
          <p className="pt-2 text-sm font-semibold">Was ist dir wichtig?</p>
          <Slider label="💶 Geld" value={prio.money} onChange={(money) => setPrio({ ...prio, money })} />
          <Slider label="🌴 Freizeit" value={prio.time} onChange={(time) => setPrio({ ...prio, time })} />
          <Slider label="🛟 Sicherheit" value={prio.safety} onChange={(safety) => setPrio({ ...prio, safety })} />
        </Card>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((r, i) => (
              <Card key={r.path.id} className={cn('p-4', i === 0 && 'ring-2 ring-accent')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">
                    {r.path.emoji} {r.path.name}
                  </p>
                  {i === 0 && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg">Passt am besten</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted">Gehalt in Jahr {years}</p>
                    <p className="font-display text-lg font-bold tabular">{fmtEur(r.median[years - 1], true)}</p>
                    <p className="text-[11px] text-faint tabular">
                      {fmtEur(r.p10, true)} – {fmtEur(r.p90, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Erspartes</p>
                    <p className="font-display text-lg font-bold tabular">{fmtEur(r.wealthMedian, true)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  <span>Arbeitslast {r.path.workload}</span>
                  <span>Sicherheit {r.path.security}</span>
                  <span className="ml-auto font-bold text-text">Passung {r.score}</span>
                </div>
                <Button size="sm" variant="soft" className="mt-3 w-full" icon={<Dices className="size-4" />} onClick={() => setStory({ id: r.path.id, seed: Math.floor(Math.random() * 1e9) })}>
                  Lebenslauf durchspielen
                </Button>
              </Card>
            ))}
          </div>
          <Card className="p-4 sm:p-5">
            <SectionTitle>Bruttogehalt im Verlauf (Median)</SectionTitle>
            <AreaChart
              points={points}
              series={results.map((r) => ({ key: r.path.id, label: r.path.name, color: r.path.color }))}
              stacked={false}
              xLabel={(p) => `Jahr ${p.year}`}
              format={(v) => fmtEur(v, true)}
            />
          </Card>
        </div>
      </div>

      <Modal open={!!story} onClose={() => setStory(null)} title={storyPath ? `${storyPath.emoji} Ein möglicher Lebenslauf` : ''} wide>
        {storyPath && (
          <>
            <p className="mb-3 text-sm text-muted">{storyPath.name} – ein zufälliger Durchlauf. Jeder Klick auf „Nochmal“ erzählt eine andere Geschichte.</p>
            <ol className="space-y-1.5">
              {storyRun.map((y) => (
                <li key={y.year} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', y.event ? 'bg-accent-soft' : 'bg-surface-2')}>
                  <span className="w-14 shrink-0 font-semibold text-muted">Jahr {y.year}</span>
                  <span className="min-w-0 flex-1">{y.event ?? '–'}</span>
                  <span className="shrink-0 font-semibold tabular">{fmtEur(y.salary, true)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm">
              Erspartes nach {years} Jahren: <b className="tabular">{fmtEur(storyRun[storyRun.length - 1]?.wealth ?? 0, true)}</b>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" icon={<Dices className="size-4" />} onClick={() => setStory({ id: storyPath.id, seed: Math.floor(Math.random() * 1e9) })}>
                Nochmal
              </Button>
              {PATHS.filter((p) => p.id !== storyPath.id && selected.includes(p.id)).map((p) => (
                <Chip key={p.id} onClick={() => setStory({ id: p.id, seed: Math.floor(Math.random() * 1e9) })}>
                  {p.emoji} {p.name.split(':')[0]}
                </Chip>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
