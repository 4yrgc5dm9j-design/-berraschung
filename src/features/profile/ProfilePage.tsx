import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link } from 'react-router-dom'
import { Check, Download, LocateFixed, Monitor, Moon, Sun, Upload, X, Cloud, Server, Database, Smartphone, Plus } from 'lucide-react'
import { Badge, Button, Card, Chip, ConfirmDialog, ErrorNote, Field, PlannedBadge, Segmented, SectionTitle, Spinner, Toggle } from '@/components/ui'
import { PageHeader } from '@/components/layout/AppShell'
import { actions, useApp, useSettings } from '@/data/store'
import type { AccentId, ModuleId, NewsTopic, ThemeMode, WeatherLocation } from '@/data/types'
import { cn, parseNum } from '@/lib/utils'
import { searchPlaces } from '@/services/weather'
import { useServerStatus } from '@/services/hooks'
import { TOPICS } from '@/features/discover/news'
import { TeamLogo, ClubPicker } from '@/features/discover/sport'
import { exportData, importData } from './backup'
import { toast, useToasts } from '@/data/toasts'

const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'ozean', label: 'Ozean', color: '#2f5fe3' },
  { id: 'raute', label: 'Rautenblau', color: '#0b5aa8' },
  { id: 'smaragd', label: 'Smaragd', color: '#0f8a62' },
  { id: 'violett', label: 'Violett', color: '#7045d8' },
  { id: 'koralle', label: 'Koralle', color: '#d4483b' },
  { id: 'bernstein', label: 'Bernstein', color: '#b86e00' },
]

const MODULES: { id: ModuleId; label: string; description: string }[] = [
  { id: 'news', label: 'News', description: 'Nachrichten zu deinen Interessen' },
  { id: 'markets', label: 'Börse', description: 'Watchlist, Depot, Rechner, Spieldepot' },
  { id: 'sport', label: 'Sport', description: 'Spiele, Ergebnisse & Tabellen' },
  { id: 'flashcards', label: 'Lernkarten', description: 'Karteikasten fürs Studium' },
  { id: 'focus', label: 'Fokus-Timer', description: 'Pomodoro-Lerneinheiten' },
  { id: 'habits', label: 'Gewohnheiten', description: 'Tägliche Routinen mit Serien' },
  { id: 'shopping', label: 'Einkaufslisten', description: 'Mehrere Listen, abhaken' },
  { id: 'finance', label: 'Finanzen', description: 'Ausgaben, Budget & Sparziele' },
]

function WeatherPicker() {
  const { weather } = useSettings()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<WeatherLocation[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const search = async () => {
    if (q.trim().length < 2) return
    setLoading(true)
    setError(null)
    try {
      setResults(await searchPlaces(q.trim()))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  const locate = () => {
    if (!navigator.geolocation) return toast('Standort wird von diesem Browser nicht unterstützt.', 'error')
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoading(false)
        actions().setSettings({ weather: { name: 'Mein Standort', region: '', lat: p.coords.latitude, lon: p.coords.longitude } })
        toast('Standort übernommen', 'success')
      },
      () => {
        setLoading(false)
        toast('Standort nicht verfügbar – bitte Ort suchen.', 'error')
      },
      { timeout: 10000 },
    )
  }
  return (
    <div>
      <p className="mb-2 text-sm">
        Aktuell: <b>{weather ? `${weather.name}${weather.region ? `, ${weather.region}` : ''}` : 'kein Ort'}</b>
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ort suchen, z. B. Lüneburg" aria-label="Ort suchen" />
        <Button type="submit" variant="secondary" loading={loading}>
          Suchen
        </Button>
        <Button type="button" variant="secondary" onClick={locate} aria-label="Aktuellen Standort verwenden" title="Aktuellen Standort verwenden">
          <LocateFixed className="size-5" />
        </Button>
      </form>
      {error && <div className="mt-2"><ErrorNote error={error} compact /></div>}
      {results && (
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          {results.length === 0 && <p className="p-3 text-sm text-muted">Kein Ort gefunden.</p>}
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lon}`}
              onClick={() => {
                actions().setSettings({ weather: r })
                setResults(null)
                setQ('')
                toast(`Wetter für ${r.name}`, 'success')
              }}
              className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-surface-2"
            >
              <span className="font-semibold">{r.name}</span>
              <span className="text-muted">{r.region}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-faint">Wetterdaten: Open-Meteo (kostenlos, ohne Konto).</p>
    </div>
  )
}

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState('')
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">{label}</span>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((c) => (
          <span key={c} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1 text-sm font-semibold">
            {c}
            <button aria-label={`${c} entfernen`} disabled={values.length <= 1} onClick={() => onChange(values.filter((x) => x !== c))} className="grid size-6 place-items-center rounded-full hover:bg-surface-3 disabled:opacity-30">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (v.trim() && !values.includes(v.trim())) onChange([...values, v.trim()])
          setV('')
        }}
      >
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
        <Button type="submit" variant="secondary" aria-label="Hinzufügen">
          <Plus className="size-4" />
        </Button>
      </form>
    </div>
  )
}

function DataSources() {
  const status = useServerStatus()
  const row = (icon: React.ReactNode, name: string, state: React.ReactNode, note: string) => (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-muted">{note}</p>
      </div>
      {state}
    </div>
  )
  const serverOk = !!status.data && !status.error
  return (
    <div className="divide-y divide-line">
      {row(<Cloud className="size-4" />, 'Wetter · Open-Meteo', <Badge tone="success">Direkt</Badge>, 'Kostenlos, ohne Schlüssel. Direkt aus dem Browser.')}
      {row(<Cloud className="size-4" />, 'Fußball · OpenLigaDB', <Badge tone="success">Direkt</Badge>, 'Freie Community-Daten für 1.–3. Liga.')}
      {row(
        <Server className="size-4" />,
        'Dailybase-Server',
        status.loading && !status.data ? <Spinner className="size-4" /> : serverOk ? <Badge tone="success">Verbunden</Badge> : <Badge tone="warn">Nicht erreichbar</Badge>,
        'Lädt News-Feeds und Link-Vorschauen, hält API-Schlüssel geheim.',
      )}
      {row(
        <Server className="size-4" />,
        'News · öffentliche RSS-Feeds',
        serverOk ? <Badge tone="success">Aktiv</Badge> : <Badge tone="warn">Server nötig</Badge>,
        status.data ? status.data.news.sources.join(', ') : 'tagesschau, heise, golem, Spiegel, sportschau, kicker',
      )}
      {row(
        <Server className="size-4" />,
        'Börsenkurse · Finnhub',
        status.data?.quotes.provider ? <Badge tone="success">Verbunden</Badge> : <Badge>Manuell</Badge>,
        status.data?.quotes.provider ? 'Live-Kurse (v. a. US-Werte, in USD).' : 'Optional: kostenloser Schlüssel in .env (FINNHUB_API_KEY). Bis dahin pflegst du Kurse selbst.',
      )}
      {row(<Database className="size-4" />, 'Deine Daten', <Badge tone="accent">Lokal</Badge>, 'IndexedDB in diesem Browser. Nichts verlässt dein Gerät.')}
    </div>
  )
}

export default function ProfilePage() {
  const settings = useSettings()
  const set = actions().setSettings
  const counts = useApp(useShallow((s) => ({ tasks: s.data.tasks.length, notes: s.data.notes.length, items: s.data.items.length })))
  const fileRef = useRef<HTMLInputElement>(null)
  const [reset, setReset] = useState(false)
  const [picker, setPicker] = useState(false)
  const [budget, setBudget] = useState(String(settings.monthlyBudget))

  const toggleInterest = (t: NewsTopic) => set({ interests: settings.interests.includes(t) ? settings.interests.filter((x) => x !== t) : [...settings.interests, t] })

  return (
    <div>
      <PageHeader title="Profil" subtitle="Einstellungen, Module und deine Daten." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle>Über dich</SectionTitle>
            <Field label="Wie dürfen wir dich nennen?">
              <input className="field" value={settings.name} onChange={(e) => set({ name: e.target.value })} placeholder="Vorname" />
            </Field>
            <p className="mt-2 text-xs text-faint">
              {counts.tasks} Aufgaben · {counts.notes} Notizen · {counts.items} gespeicherte Einträge
            </p>
          </Card>

          <Card className="p-5">
            <SectionTitle>Darstellung</SectionTitle>
            <Field label="Farbschema" group>
              <Segmented<ThemeMode>
                className="w-full"
                value={settings.theme}
                onChange={(theme) => set({ theme })}
                options={[
                  { value: 'system', label: 'System', icon: <Monitor className="size-4" /> },
                  { value: 'light', label: 'Hell', icon: <Sun className="size-4" /> },
                  { value: 'dark', label: 'Dunkel', icon: <Moon className="size-4" /> },
                ]}
              />
            </Field>
            <div className="mt-4">
              <span className="mb-1.5 block text-[13px] font-semibold text-muted">Akzentfarbe</span>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => set({ accent: a.id })}
                    aria-label={a.label}
                    aria-pressed={settings.accent === a.id}
                    className={cn('flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold', settings.accent === a.id ? 'border-text' : 'border-line')}
                  >
                    <span className="grid size-5 place-items-center rounded-full text-white" style={{ background: a.color }}>
                      {settings.accent === a.id && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              Widgets der Startseite ordnest du direkt auf <Link to="/" className="font-semibold text-accent">Heute</Link> über das Zahnrad – getrennt für Arbeit, Uni und Freizeit.
            </p>
          </Card>

          <Card className="p-5">
            <SectionTitle>Interessen für News</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <Chip key={t.id} active={settings.interests.includes(t.id)} onClick={() => toggleInterest(t.id)}>
                  {t.emoji} {t.label}
                </Chip>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle action={<Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => setPicker(true)}>Verein</Button>}>Lieblingsvereine</SectionTitle>
            {settings.clubs.length === 0 ? (
              <p className="text-sm text-muted">Noch kein Verein gewählt.</p>
            ) : (
              <div className="space-y-1">
                {settings.clubs.map((c, i) => (
                  <div key={c.id} className="flex min-h-12 items-center gap-3">
                    <TeamLogo src={c.icon} name={c.shortName || c.name} className="size-8" />
                    <div className="flex-1">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-muted">{i === 0 ? 'Auf der Startseite' : 'Weiterer Verein'}{c.league ? ` · ${c.league.toUpperCase()}` : ''}</p>
                    </div>
                    {i > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => set({ clubs: [c, ...settings.clubs.filter((x) => x.id !== c.id)] })}>
                        Als Hauptverein
                      </Button>
                    )}
                    <button
                      aria-label={`${c.name} entfernen`}
                      className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2"
                      onClick={() => {
                        const before = settings.clubs
                        set({ clubs: before.filter((x) => x.id !== c.id) })
                        useToasts.getState().push({ message: `${c.name} entfernt`, action: { label: 'Rückgängig', run: () => actions().setSettings({ clubs: before }) } })
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ClubPicker open={picker} onClose={() => setPicker(false)} />
          </Card>

          <Card className="p-5">
            <SectionTitle>Wetter-Ort</SectionTitle>
            <WeatherPicker />
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle>Module</SectionTitle>
            <p className="mb-2 text-sm text-muted">Blende aus, was du nicht brauchst – Daten bleiben erhalten.</p>
            <div className="divide-y divide-line">
              {MODULES.map((m) => (
                <Toggle key={m.id} label={m.label} description={m.description} checked={settings.modules[m.id]} onChange={(v) => set({ modules: { ...settings.modules, [m.id]: v } })} />
              ))}
            </div>
          </Card>

          <Card className="space-y-5 p-5">
            <SectionTitle className="mb-0">Planen</SectionTitle>
            <ListEditor label="Aufgaben-Kategorien" values={settings.taskCategories} onChange={(taskCategories) => set({ taskCategories })} placeholder="Neue Kategorie" />
            <ListEditor label="Ausgaben-Kategorien" values={settings.expenseCategories} onChange={(expenseCategories) => set({ expenseCategories })} placeholder="Neue Kategorie" />
            <Field label="Monatsbudget (€)" hint="0 = kein Budget">
              <input
                className="field"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                onBlur={() => {
                  const n = parseNum(budget)
                  if (Number.isFinite(n) && n >= 0) set({ monthlyBudget: n })
                  else setBudget(String(settings.monthlyBudget))
                }}
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-muted">Fokus-Timer (Minuten)</span>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['work', 'Fokus'],
                    ['short', 'Kurz'],
                    ['long', 'Lang'],
                    ['rounds', 'Runden'],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="text-xs text-muted">
                    {l}
                    <input
                      type="number"
                      min={1}
                      max={k === 'rounds' ? 10 : 120}
                      className="field mt-1"
                      value={settings.focus[k]}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(k === 'rounds' ? 10 : 120, Number(e.target.value) || 1))
                        set({ focus: { ...settings.focus, [k]: n } })
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>Deine Daten</SectionTitle>
            <p className="mb-4 text-sm text-muted">Alles wird lokal auf diesem Gerät gespeichert. Mit dem Export sicherst du deine Daten oder überträgst sie auf ein anderes Gerät.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Download className="size-4" />} onClick={() => exportData()}>
                Exportieren
              </Button>
              <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                Importieren
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setReset(true)}>
                Alles zurücksetzen
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) await importData(f)
              }}
            />
          </Card>

          <Card className="p-5">
            <SectionTitle>Datenquellen</SectionTitle>
            <DataSources />
          </Card>

          <Card className="p-5">
            <SectionTitle>Auf dem Homescreen</SectionTitle>
            <div className="flex gap-3 text-sm text-muted">
              <Smartphone className="mt-0.5 size-5 shrink-0" />
              <p>
                <b className="text-text">iPhone/iPad:</b> In Safari auf „Teilen“ → „Zum Home-Bildschirm“. <br />
                <b className="text-text">Android/Desktop:</b> Im Browser-Menü „App installieren“. Dailybase startet dann ohne Browserleiste und funktioniert auch offline.
              </p>
            </div>
          </Card>

          <Card className="border-dashed p-5">
            <SectionTitle action={<PlannedBadge />}>Konto & Synchronisation</SectionTitle>
            <p className="text-sm text-muted">Später optional: Anmeldung, Synchronisation zwischen iPhone, iPad und Desktop sowie gemeinsame Sammlungen. Die Datenstruktur ist dafür bereits vorbereitet.</p>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={reset}
        title="Alles zurücksetzen?"
        message="Alle Aufgaben, Notizen, Sammlungen und Einstellungen auf diesem Gerät werden gelöscht. Exportiere vorher deine Daten, wenn du sie behalten möchtest."
        confirmLabel="Zurücksetzen"
        onConfirm={() => {
          const snap = { data: actions().data, settings: actions().settings }
          actions().resetAll()
          useToasts.getState().push({ message: 'Alles zurückgesetzt', action: { label: 'Rückgängig', run: () => actions().replaceAll(snap.data, snap.settings) } }, 10000)
        }}
        onClose={() => setReset(false)}
      />
    </div>
  )
}
