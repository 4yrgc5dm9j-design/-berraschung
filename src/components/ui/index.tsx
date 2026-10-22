import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, RefreshCw, WifiOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/dates'

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode; loading?: boolean }
>(function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-[15px]',
        size === 'lg' && 'min-h-12 px-5 text-base',
        variant === 'primary' && 'bg-accent text-accent-fg shadow-md shadow-accent/25 hover:brightness-110',
        variant === 'secondary' && 'border border-line bg-surface-2 text-text hover:bg-surface-3',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-text',
        variant === 'soft' && 'bg-accent-soft text-accent hover:brightness-95',
        variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger/15',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md'; active?: boolean }
>(function IconButton({ label, size = 'md', active, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-40',
        size === 'md' ? 'size-11' : 'size-9',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

// ---------------------------------------------------------------- Card
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-lg font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------- Badges
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warn' | 'demo' | 'planned'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        tone === 'neutral' && 'bg-surface-3 text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'success' && 'bg-success/12 text-success',
        tone === 'danger' && 'bg-danger/12 text-danger',
        tone === 'warn' && 'bg-warn/14 text-warn',
        tone === 'demo' && 'border border-dashed border-warn/60 text-warn',
        tone === 'planned' && 'border border-dashed border-line-strong text-faint',
        className,
      )}
    >
      {children}
    </span>
  )
}

export const PlannedBadge = ({ label = 'Geplant' }: { label?: string }) => <Badge tone="planned">{label}</Badge>
export const DemoBadge = () => <Badge tone="demo">Demo</Badge>

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95',
        active ? 'border-transparent bg-accent text-accent-fg shadow-sm shadow-accent/25' : 'border-line bg-surface text-muted hover:text-text',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- Segmented
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="tablist" className={cn('inline-flex min-w-0 rounded-2xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex min-w-0 flex-auto items-center justify-center gap-1.5 rounded-xl px-2.5 font-semibold whitespace-nowrap transition sm:px-3',
            size === 'md' ? 'min-h-10 text-sm' : 'min-h-8 text-xs',
            value === o.value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {o.icon && <span className="hidden shrink-0 min-[420px]:inline-flex">{o.icon}</span>}
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Form
/** Beschriftetes Eingabefeld. `group` für Knopfgruppen (Segmente, Sterne), die kein <label> vertragen. */
export function Field({ label, hint, children, className, group }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={cn('block', className)} {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </Tag>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-surface-3')}
      >
        <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- Modal / Sheet
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select')
      // Nicht wegspringen, wenn schon ein Feld im Fenster aktiv ist; auf Touch-Geräten keine Tastatur erzwingen
      if (ref.current?.contains(document.activeElement)) return
      if (el && !matchMedia('(pointer: coarse)').matches) el.focus()
    }, 60)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 animate-fade bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-sheet flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-2xl sm:rounded-[28px]',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <IconButton label="Schließen" onClick={onClose} size="sm">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-safe sm:pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Löschen',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="danger"
            data-autofocus
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-muted">{message}</div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Zustände
export function EmptyState({
  icon,
  title,
  text,
  action,
  compact,
  inline,
}: {
  icon?: ReactNode
  title: string
  text?: ReactNode
  action?: ReactNode
  compact?: boolean
  /** platzsparend nebeneinander, z. B. in Widgets */
  inline?: boolean
}) {
  if (inline)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        {icon && <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-xl shadow-sm">{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {text && <p className="text-xs text-muted">{text}</p>}
          {action && <div className="mt-0.5 text-sm">{action}</div>}
        </div>
      </div>
    )
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-12')}>
      {icon && <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent">{icon}</div>}
      <div>
        <p className="font-display font-semibold">{title}</p>
        {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-3', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} />
}

/** Fehlerhinweis für externe Daten – verständlich und mit „Erneut versuchen“. */
export function ErrorNote({ error, onRetry, compact }: { error: string; onRetry?: () => void; compact?: boolean }) {
  const offline = /Internet|offline/i.test(error)
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl bg-surface-2 text-sm', compact ? 'p-3' : 'p-4')}>
      {offline ? <WifiOff className="mt-0.5 size-4 shrink-0 text-muted" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />}
      <div className="flex-1">
        <p className="font-semibold">{offline ? 'Du bist offline' : 'Daten konnten nicht geladen werden'}</p>
        <p className="text-muted">{error}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-accent">
          <RefreshCw className="size-3.5" />
          Erneut
        </button>
      )}
    </div>
  )
}

/** Quelle + Aktualisierungszeitpunkt für echte Daten. */
export function SourceLine({
  source,
  href,
  fetchedAt,
  stale,
  loading,
  onReload,
  className,
}: {
  source: string
  href?: string
  fetchedAt?: string | null
  stale?: boolean
  loading?: boolean
  onReload?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-faint', className)}>
      <span>
        Quelle:{' '}
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-muted">
            {source}
          </a>
        ) : (
          source
        )}
      </span>
      {fetchedAt && (
        <span className={cn(stale && 'text-warn')}>
          · {stale ? 'Letzter Stand ' : 'Aktualisiert '}
          {timeAgo(fetchedAt)}
        </span>
      )}
      {onReload && (
        <button onClick={onReload} aria-label="Aktualisieren" className="inline-flex size-6 items-center justify-center rounded-md hover:bg-surface-2 hover:text-muted">
          <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
        </button>
      )}
    </div>
  )
}

export function ProgressBar({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'success' | 'danger' | 'warn' }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          tone === 'accent' && 'bg-accent',
          tone === 'success' && 'bg-success',
          tone === 'danger' && 'bg-danger',
          tone === 'warn' && 'bg-warn',
        )}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  )
}

export function Stars({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center" role={onChange ? 'radiogroup' : undefined} aria-label={`Bewertung ${value} von 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={`${n} Sterne`}
          onClick={() => onChange?.(value === n ? 0 : n)}
          className={cn(
            'grid place-items-center transition disabled:cursor-default',
            size === 'md' ? 'size-10 text-2xl' : 'size-5 text-sm',
            n <= value ? 'text-warn' : 'text-surface-3',
            onChange && 'active:scale-90',
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}
