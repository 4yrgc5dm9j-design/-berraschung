import { useEffect, useRef, useState } from 'react'
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
import { STATIC_HOSTING } from '@/services/server'
import { testFinnhubKey } from '@/services/quotes'
import { fetchSheet, templateCsv } from '@/services/googleSheet'
import { INSTRUMENTS } from '@/data/instruments'
import { timeAgo } from '@/lib/dates'
import { TOPICS } from '@/features/discover/news'
import { TeamLogo, ClubPicker } from '@/features/discover/sport'
import { exportData, importData } from './backup'
import { toast, useToasts } from '@/data/toasts'

const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'ozean', label: 'Ozean', color: '#4361ee' },
  { id: 'raute', label: 'Rautenblau', color: '#0b63ce' },
  { id: 'smaragd', label: 'Smaragd', color: '#0e9f6e' },
  { id: 'violett', label: 'Violett', color: '#7c4dff' },
  { id: 'koralle', label: 'Koralle', color: '#f0533f' },
  { id: 'bernstein', label: 'Bernstein', color: '#c47500' },
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

function GoogleSheetCard() {
  const { googleSheetUrl } = useSettings()
  const extra = useApp(useShallow((s) => [...new Set([...s.data.watchlist.map((w) => w.symbol), ...s.data.transactions.map((t) => t.symbol)].map((x) => x.toUpperCase()))]))
  const [value, setValue] = useState(googleSheetUrl)
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ kind: 'idle' })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (location.hash === '#kurse') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const download = () => {
    const blob = new Blob([templateCsv(extra)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'dailybase-kurse.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const save = async () => {
    const url = value.trim()
    if (!url) {
      actions().setSettings({ googleSheetUrl: '' })
      setState({ kind: 'idle' })
      return toast('Google-Tabelle getrennt')
    }
    setState({ kind: 'testing' })
    try {
      const d = await fetchSheet(url)
      actions().setSettings({ googleSheetUrl: url })
      const n = Object.keys(d.quotes).length
      const hist = Object.keys(d.history).length
      setState({ kind: 'ok', text: `Verbunden – ${n} Kurse gefunden${hist ? `, Wochenverlauf für ${hist} Werte` : ''}.` })
      toast('Börsenkurse verbunden', 'success')
    } catch (e) {
      setState({ kind: 'error', text: (e as Error).message })
    }
  }
  const step = 'rounded-xl bg-surface-2 p-3'
  return (
    <div ref={ref} id="kurse" className="card scroll-mt-6 p-5">
      <SectionTitle action={googleSheetUrl ? <Badge tone="success">Verbunden</Badge> : <Badge>Aus</Badge>}>Börsenkurse über Google</SectionTitle>
      <p className="mb-3 text-sm text-muted">
        Google Tabellen liefert mit der Funktion GOOGLEFINANCE kostenlos Kurse für alle {INSTRUMENTS.length} Aktien und ETFs in Dailybase – auch Xetra. Einmal einrichten, ca. 3 Minuten:
      </p>
      <ol className="mb-4 space-y-2 text-sm">
        <li className={step}>
          <b>1. Vorlage laden.</b> Enthält alle Werte plus deine Watchlist und dein Depot.
          <div className="mt-2">
            <Button size="sm" variant="soft" icon={<Download className="size-4" />} onClick={download}>
              Vorlage herunterladen
            </Button>
          </div>
        </li>
        <li className={step}>
          <b>2. In Google Tabellen öffnen.</b>{' '}
          <a href="https://sheets.new" target="_blank" rel="noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">
            sheets.new
          </a>{' '}
          öffnen (mit Google-Konto) → <i>Datei → Importieren → Hochladen</i> → die Vorlage wählen → „Tabelle ersetzen“. Unter <i>Datei → Einstellungen</i> muss das Gebietsschema „Deutschland“ sein.
        </li>
        <li className={step}>
          <b>3. Im Web veröffentlichen.</b> <i>Datei → Freigeben → Im Web veröffentlichen</i> → „Gesamtes Dokument“ und „Kommagetrennte Werte (.csv)“ → Veröffentlichen → Link kopieren.
        </li>
        <li className={step}>
          <b>4. Link hier einfügen</b> und „Verbinden“ tippen.
        </li>
      </ol>
      <div className="flex gap-2">
        <input
          className="field text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="url"
          aria-label="Link der veröffentlichten Google-Tabelle"
        />
        <Button variant="primary" onClick={save} loading={state.kind === 'testing'}>
          {value.trim() ? 'Verbinden' : 'Speichern'}
        </Button>
      </div>
      {state.kind === 'ok' && <p className="mt-2 text-sm font-semibold text-success">{state.text}</p>}
      {state.kind === 'error' && <p className="mt-2 text-sm font-semibold text-danger">{state.text}</p>}
      <p className="mt-3 text-xs text-faint">
        Kurse sind laut Google bis zu 20 Minuten verzögert; veröffentlichte Tabellen aktualisiert Google etwa alle 5 Minuten. Dailybase liest nur diese eine Tabelle, rechnet Dollar-Kurse mit dem EZB-Referenzkurs in Euro um und merkt sich jeden Tag einen Kurs für Charts und Depot-Analyse. Wer den Link kennt, sieht die Kurstabelle – sie enthält nur Kurse, keine Depotdaten.
      </p>
    </div>
  )
}

function LiveQuotesCard() {
  const { finnhubKey } = useSettings()
  const [value, setValue] = useState(finnhubKey)
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ kind: 'idle' })
  const save = async () => {
    const key = value.trim()
    if (!key) {
      actions().setSettings({ finnhubKey: '' })
      setState({ kind: 'idle' })
      return toast('Live-Kurse ausgeschaltet')
    }
    setState({ kind: 'testing' })
    try {
      const price = await testFinnhubKey(key)
      actions().setSettings({ finnhubKey: key })
      setState({ kind: 'ok', text: `Verbunden – Apple steht gerade bei ${price.toLocaleString('de-DE', { style: 'currency', currency: 'USD' })}.` })
      toast('Live-Kurse eingeschaltet', 'success')
    } catch (e) {
      setState({ kind: 'error', text: (e as Error).message })
    }
  }
  return (
    <div id="live" className="card scroll-mt-6 p-5">
      <SectionTitle action={finnhubKey ? <Badge tone="success">Live aktiv</Badge> : <Badge>Aus</Badge>}>Optional: Echtzeit für US-Werte</SectionTitle>
      <p className="mb-3 text-sm text-muted">Wer US-Aktien sekundengenau statt verzögert sehen will, kann zusätzlich einen kostenlosen Finnhub-Schlüssel hinterlegen.</p>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>
          Kostenlos registrieren bei{' '}
          <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">
            finnhub.io
          </a>{' '}
          (nur E-Mail, keine Zahlungsdaten).
        </li>
        <li>Im Dashboard den „API Key“ kopieren.</li>
        <li>Hier einfügen und „Verbinden“ tippen.</li>
      </ol>
      <div className="flex gap-2">
        <input
          className="field font-mono text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="API-Schlüssel"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Finnhub-API-Schlüssel"
        />
        <Button variant="primary" onClick={save} loading={state.kind === 'testing'}>
          {value.trim() ? 'Verbinden' : 'Speichern'}
        </Button>
      </div>
      {state.kind === 'ok' && <p className="mt-2 text-sm font-semibold text-success">{state.text}</p>}
      {state.kind === 'error' && <p className="mt-2 text-sm font-semibold text-danger">{state.text}</p>}
      <p className="mt-3 text-xs text-faint">
        Der Schlüssel bleibt nur auf diesem Gerät und wird nicht exportiert. Live verfügbar sind im kostenlosen Plan Aktien und ETFs an US-Börsen (auch SAP, Deutsche Bank u. a. über ihr US-Listing), aktualisiert jede Minute. Dollar-Kurse rechnet Dailybase mit dem EZB-Referenzkurs in Euro um. Xetra-Werte kommen weiter aus der Google-Tabelle.
      </p>
    </div>
  )
}

function DataSources() {
  const status = useServerStatus()
  const settings = useSettings()
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
      {status.data?.mode === 'static' || STATIC_HOSTING ? (
        row(
          <Server className="size-4" />,
          'News · öffentliche RSS-Feeds',
          status.loading && !status.data ? <Spinner className="size-4" /> : status.data?.news.sources.length ? <Badge tone="success">Aktiv</Badge> : <Badge tone="warn">Nicht erreichbar</Badge>,
          `Werden alle 30 Minuten automatisch abgerufen${status.data?.dataAt ? ` (zuletzt ${timeAgo(status.data.dataAt)})` : ''}. ${status.data?.news.sources.join(', ') ?? ''}`,
        )
      ) : (
        <>
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
        </>
      )}
      {row(
        <Server className="size-4" />,
        'Börsenkurse · Google Finanzen',
        settings.googleSheetUrl ? <Badge tone="success">Verbunden</Badge> : <Badge>Manuell</Badge>,
        settings.googleSheetUrl ? 'Über deine veröffentlichte Google-Tabelle, bis zu 20 Min. verzögert, alle 2 Minuten neu gelesen.' : 'Einmalig unter „Börsenkurse über Google“ einrichten. Bis dahin pflegst du Kurse selbst.',
      )}
      {row(
        <Server className="size-4" />,
        'Echtzeit US · Finnhub',
        status.data?.quotes.provider || settings.finnhubKey ? <Badge tone="success">Live</Badge> : <Badge>Aus</Badge>,
        settings.finnhubKey ? 'Direkt mit deinem Schlüssel, jede Minute aktualisiert (US-Börsen, in € umgerechnet).' : status.data?.quotes.provider ? 'Live-Kurse über den Dailybase-Server (v. a. US-Werte).' : 'Optional mit kostenlosem Schlüssel.',
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

          <GoogleSheetCard />
          <LiveQuotesCard />

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
