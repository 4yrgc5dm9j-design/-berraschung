import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { useToasts } from '@/data/toasts'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-md animate-rise items-center gap-3 rounded-2xl bg-text py-2 pl-4 pr-2 text-bg shadow-2xl"
        >
          {t.tone === 'error' ? (
            <XCircle className="size-5 shrink-0 text-danger" />
          ) : t.tone === 'success' ? (
            <CheckCircle2 className="size-5 shrink-0 text-success" />
          ) : (
            <Info className="size-5 shrink-0 opacity-60" />
          )}
          <p className="flex-1 py-1.5 text-sm font-medium">{t.message}</p>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
              className="min-h-10 rounded-xl bg-bg/15 px-3 text-sm font-bold hover:bg-bg/25"
            >
              {t.action.label}
            </button>
          )}
          <button aria-label="Schließen" onClick={() => dismiss(t.id)} className={cn('grid size-9 place-items-center rounded-xl opacity-60 hover:opacity-100')}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
