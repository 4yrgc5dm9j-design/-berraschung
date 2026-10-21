import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Kategoriale Reihenfolge (fest, nie zyklisch neu vergeben) – hell/dunkel abgestimmt.
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const OTHER = 'var(--faint)'

export function seriesColor(i: number) {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return (dark ? SERIES_DARK : SERIES_LIGHT)[i] ?? OTHER
}

// ---------------------------------------------------------------- Balkenliste (eine Reihe)
export function BarList({ rows, format }: { rows: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-muted tabular">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Donut (Anteile)
export function Donut({
  slices,
  format,
  centerLabel,
  centerValue,
}: {
  slices: { label: string; value: number }[]
  format: (v: number) => string
  centerLabel: string
  centerValue: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  // Ab 8 Positionen: Rest unter „Sonstige“ bündeln
  const data = useMemo(() => {
    const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
    if (sorted.length <= 8) return sorted
    const rest = sorted.slice(7).reduce((a, s) => a + s.value, 0)
    return [...sorted.slice(0, 7), { label: 'Sonstige', value: rest }]
  }, [slices])
  const total = data.reduce((a, s) => a + s.value, 0)
  const R = 70
  const W = 22
  const C = 2 * Math.PI * R
  const gap = data.length > 1 ? 2 : 0
  let acc = 0
  const active = hover != null ? data[hover] : null

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-[180px] shrink-0">
        <svg viewBox="0 0 180 180" className="-rotate-90" role="img" aria-label="Verteilung">
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={W} />
          {data.map((s, i) => {
            const len = (s.value / total) * C
            const el = (
              <circle
                key={s.label}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={s.label === 'Sonstige' ? OTHER : seriesColor(i)}
                strokeWidth={hover === i ? W + 6 : W}
                strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                strokeDashoffset={-acc}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
                className="cursor-pointer transition-[stroke-width]"
              />
            )
            acc += len
            return el
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[110px]">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-faint">{active ? active.label : centerLabel}</p>
            <p className="font-display text-lg font-bold tabular">{active ? format(active.value) : centerValue}</p>
            {active && <p className="text-xs text-muted tabular">{((active.value / total) * 100).toFixed(1).replace('.', ',')} %</p>}
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-1', hover === i && 'bg-surface-2')}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.label === 'Sonstige' ? OTHER : seriesColor(i) }} />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="text-muted tabular">{((s.value / total) * 100).toFixed(1).replace('.', ',')} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- Flächen-/Liniendiagramm
export interface SeriesDef {
  key: string
  label: string
  color: string
}

/**
 * Gestapelte Flächen (z. B. Einzahlungen + Zinsen) oder eine einzelne Linie.
 * Mit Fadenkreuz und Tooltip.
 */
export function AreaChart({
  points,
  series,
  xLabel,
  format,
  stacked = true,
  height = 220,
}: {
  points: Record<string, number | string>[]
  series: SeriesDef[]
  xLabel: (p: Record<string, number | string>) => string
  format: (v: number) => string
  stacked?: boolean
  height?: number
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = height
  const pad = { l: 8, r: 8, t: 12, b: 24 }
  const n = points.length
  const totals = points.map((p) => (stacked ? series.reduce((a, s) => a + Number(p[s.key] ?? 0), 0) : Math.max(...series.map((s) => Number(p[s.key] ?? 0)))))
  const max = Math.max(...totals, 1) * 1.08
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b)

  const layers = useMemo(() => {
    const base = new Array(n).fill(0)
    return series.map((s) => {
      const lower = [...base]
      const upper = points.map((p, i) => (stacked ? lower[i] : 0) + Number(p[s.key] ?? 0))
      if (stacked) upper.forEach((v, i) => (base[i] = v))
      const top = upper.map((v, i) => `${x(i)},${y(v)}`).join(' L')
      const bottom = lower
        .map((v, i) => `${x(i)},${y(stacked ? v : 0)}`)
        .reverse()
        .join(' L')
      return { s, area: `M${top} L${bottom} Z`, line: `M${top}` }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, series, stacked, max])

  const onMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || n === 0) return
    const rel = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const ticks = [0, 0.5, 1].map((f) => (max / 1.08) * f)
  const hp = hover != null ? points[hover] : null

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        preserveAspectRatio="none"
        style={{ height: H }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Diagramm"
      >
        {ticks.map((t) => (
          <line key={t} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '3 4'} vectorEffect="non-scaling-stroke" />
        ))}
        {layers.map(({ s, area, line }) => (
          <g key={s.key}>
            <path d={area} fill={s.color} opacity={stacked ? 0.85 : 0.15} />
            <path d={line} fill="none" stroke={stacked ? 'var(--surface)' : s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        <text x={pad.l} y={H - 6} fontSize="11" fill="var(--faint)">
          {n ? xLabel(points[0]) : ''}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="11" fill="var(--faint)" textAnchor="end">
          {n ? xLabel(points[n - 1]) : ''}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {hp && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-line bg-surface p-3 text-xs shadow-xl"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 80px), calc(100% - 170px))` }}
        >
          <p className="mb-1 font-bold">{xLabel(hp)}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold tabular">{format(Number(hp[s.key] ?? 0))}</span>
            </p>
          ))}
          {stacked && series.length > 1 && (
            <p className="mt-1 flex justify-between border-t border-line pt-1 font-bold">
              <span>Gesamt</span>
              <span className="tabular">{format(totals[hover])}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
