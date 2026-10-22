import { useState, useLayoutEffect } from 'react'
import { CalendarPlus, CheckSquare, Link2, NotebookPen, Wallet } from 'lucide-react'
import { Modal } from '@/components/ui'
import { TaskEditor } from '@/features/plan/tasks'
import { EventEditor } from '@/features/plan/calendar'
import { NoteEditor } from '@/features/plan/notes'
import { ExpenseEditor } from '@/features/plan/life'
import { ItemEditor } from '@/features/collections/ItemEditor'
import { useSettings } from '@/data/store'

type Kind = 'task' | 'event' | 'note' | 'link' | 'expense'

/** Schnellerfassung von überall: Aufgabe, Termin, Notiz, Link oder Ausgabe. */
export function QuickAdd({ open, initialKind, onClose }: { open: boolean; initialKind?: string; onClose: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null)
  const { modules } = useSettings()
  useLayoutEffect(() => {
    if (open) setKind((initialKind as Kind) ?? null)
  }, [open, initialKind])

  const close = () => {
    setKind(null)
    onClose()
  }
  const options: { id: Kind; label: string; icon: React.ReactNode; hint: string; hidden?: boolean }[] = [
    { id: 'task', label: 'Aufgabe', icon: <CheckSquare className="size-6" />, hint: 'To-do mit Fälligkeit' },
    { id: 'event', label: 'Termin', icon: <CalendarPlus className="size-6" />, hint: 'Auch Prüfungen' },
    { id: 'note', label: 'Notiz', icon: <NotebookPen className="size-6" />, hint: 'Gedanken festhalten' },
    { id: 'link', label: 'Link speichern', icon: <Link2 className="size-6" />, hint: 'Instagram, YouTube …' },
    { id: 'expense', label: 'Ausgabe', icon: <Wallet className="size-6" />, hint: 'In Sekunden erfasst', hidden: !modules.finance },
  ]

  return (
    <>
      <Modal open={open && kind === null} onClose={close} title="Schnell erfassen">
        <div className="grid grid-cols-2 gap-3">
          {options
            .filter((o) => !o.hidden)
            .map((o) => (
              <button key={o.id} onClick={() => setKind(o.id)} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-line bg-surface-2 p-4 text-left transition hover:border-accent active:scale-[0.98]">
                <span className="text-accent">{o.icon}</span>
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="text-xs text-muted">{o.hint}</span>
                </span>
              </button>
            ))}
        </div>
      </Modal>
      <TaskEditor open={open && kind === 'task'} onClose={close} />
      <EventEditor open={open && kind === 'event'} onClose={close} />
      <NoteEditor open={open && kind === 'note'} onClose={close} />
      <ItemEditor open={open && kind === 'link'} onClose={close} />
      <ExpenseEditor open={open && kind === 'expense'} onClose={close} />
    </>
  )
}
