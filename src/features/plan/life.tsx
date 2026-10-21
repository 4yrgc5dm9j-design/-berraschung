import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Minus, Plus, Trash2, Pencil, Flame, Archive } from 'lucide-react'
import { Button, Card, Chip, ConfirmDialog, EmptyState, Field, IconButton, Modal, ProgressBar, Segmented, SectionTitle } from '@/components/ui'
import { actions, useApp, useData, useSettings } from '@/data/store'
import type { Expense, Habit, SavingsGoal } from '@/data/types'
import { cn, fmtEur, parseNum } from '@/lib/utils'
import { addDays, fmtDate, fromDateKey, startOfWeek, todayKey, weekdayShort } from '@/lib/dates'
import { toast } from '@/data/toasts'
import { BarList } from '@/components/ui/charts'

// ================================================================ Gewohnheiten
export function streak(h: Habit, today = todayKey()): number {
  const set = new Set(h.days)
  let n = 0
  let d = set.has(today) ? today : addDays(today, -1)
  while (set.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function toggleHabitDay(h: Habit, day = todayKey()) {
  const has = h.days.includes(day)
  actions().update('habits', h.id, { days: has ? h.days.filter((d) => d !== day) : [...h.days, day] })
}

const habitEmojis = ['💧', '📖', '🏃', '🧘', '🥗', '😴', '💪', '🚭', '📵', '🎸', '✍️', '🧹', '💶', '🌱']

export function HabitsView() {
  const habits = useData('habits').filter((h) => !h.archived)
  const archived = useData('habits').filter((h) => h.archived)
  const [edit, setEdit] = useState<Habit | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💧')
  const [target, setTarget] = useState(7)
  const today = todayKey()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  useEffect(() => {
    if (open) {
      setName(edit?.name ?? '')
      setEmoji(edit?.emoji ?? '💧')
      setTarget(edit?.targetPerWeek ?? 7)
    }
  }, [open, edit])

  const save = () => {
    if (!name.trim()) return
    if (edit) actions().update('habits', edit.id, { name: name.trim(), emoji, targetPerWeek: target })
    else actions().add('habits', { name: name.trim(), emoji, targetPerWeek: target, days: [], archived: false })
    setOpen(false)
    setEdit(null)
  }

  const weekStart = startOfWeek(today)
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => { setEdit(null); setOpen(true) }}>
          Gewohnheit
        </Button>
      </div>
      {habits.length === 0 ? (
        <Card>
          <EmptyState icon="🌱" title="Keine Gewohnheiten" text="Kleine Routinen, jeden Tag abgehakt – mit Serien-Zähler." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_repeat(7,minmax(36px,44px))] items-center gap-y-1 p-3 sm:p-4">
            <span />
            {days.map((d) => (
              <span key={d} className={cn('text-center text-[11px] font-bold uppercase', d === today ? 'text-accent' : 'text-faint')}>
                {weekdayShort[fromDateKey(d).getDay()]}
                <span className="block text-xs font-semibold normal-case">{fromDateKey(d).getDate()}</span>
              </span>
            ))}
            {habits.map((h) => {
              const s = streak(h)
              const thisWeek = h.days.filter((d) => d >= weekStart && d <= today).length
              return (
                <div key={h.id} className="contents">
                  <button onClick={() => { setEdit(h); setOpen(true) }} className="flex min-w-0 items-center gap-2 rounded-xl py-2 pr-2 text-left hover:bg-surface-2">
                    <span className="text-2xl">{h.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{h.name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <span className={cn('inline-flex items-center gap-0.5', s > 0 && 'font-bold text-warn')}>
                          <Flame className="size-3" />
                          {s}
                        </span>
                        <span>
                          {thisWeek}/{h.targetPerWeek} diese Woche
                        </span>
                      </span>
                    </span>
                  </button>
                  {days.map((d) => {
                    const done = h.days.includes(d)
                    return (
                      <button
                        key={d}
                        onClick={() => toggleHabitDay(h, d)}
                        aria-label={`${h.name} am ${fmtDate(d)} ${done ? 'erledigt' : 'offen'}`}
                        aria-pressed={done}
                        className="grid h-11 place-items-center"
                      >
                        <span
                          className={cn(
                            'grid size-8 place-items-center rounded-xl transition',
                            done ? 'animate-pop bg-success text-white' : 'bg-surface-2 hover:bg-surface-3',
                            d === today && !done && 'ring-2 ring-accent/40',
                          )}
                        >
                          {done && <Check className="size-4" strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Card>
      )}
      {archived.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Archiviert:{' '}
          {archived.map((h) => (
            <button key={h.id} className="mr-2 underline" onClick={() => actions().update('habits', h.id, { archived: false })}>
              {h.emoji} {h.name}
            </button>
          ))}
        </p>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={edit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}
        footer={
          <>
            {edit && (
              <>
                <IconButton label="Löschen" className="text-danger" onClick={() => { actions().remove('habits', edit.id, 'Gewohnheit gelöscht'); setOpen(false) }}>
                  <Trash2 className="size-5" />
                </IconButton>
                <IconButton label="Archivieren" className="mr-auto" onClick={() => { actions().update('habits', edit.id, { archived: true }); setOpen(false) }}>
                  <Archive className="size-5" />
                </IconButton>
              </>
            )}
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 20 Minuten lesen" />
          </Field>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Symbol</span>
            <div className="flex flex-wrap gap-1.5">
              {habitEmojis.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={cn('grid size-11 place-items-center rounded-xl text-xl', emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <Field label={`Ziel: ${target}× pro Woche`}>
            <input type="range" min={1} max={7} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

// ================================================================ Einkaufslisten
export function ShoppingView() {
  const lists = useData('shoppingLists')
  const items = useData('shoppingItems')
  const [params, setParams] = useSearchParams()
  const activeId = params.get('list') ?? lists[0]?.id
  const active = lists.find((l) => l.id === activeId) ?? lists[0]
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [newList, setNewList] = useState(false)
  const [listName, setListName] = useState('')
  const [confirm, setConfirm] = useState(false)

  const listItems = items.filter((i) => i.listId === active?.id)
  const open = listItems.filter((i) => !i.done)
  const done = listItems.filter((i) => i.done)

  const add = () => {
    if (!name.trim() || !active) return
    // mehrere Artikel auf einmal: „Milch, Brot, Eier“
    for (const part of name.split(',').map((s) => s.trim()).filter(Boolean)) actions().add('shoppingItems', { listId: active.id, name: part, qty: qty.trim(), done: false })
    setName('')
    setQty('')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="scroll-x -mx-1 mb-4 flex gap-2 px-1">
        {lists.map((l) => (
          <Chip key={l.id} active={l.id === active?.id} onClick={() => setParams({ list: l.id })}>
            {l.emoji} {l.name}
            <span className="opacity-60">{items.filter((i) => i.listId === l.id && !i.done).length}</span>
          </Chip>
        ))}
        <Chip onClick={() => setNewList(true)}>
          <Plus className="size-4" /> Liste
        </Chip>
      </div>
      {!active ? (
        <Card>
          <EmptyState icon="🛒" title="Keine Einkaufsliste" action={<Button variant="soft" onClick={() => setNewList(true)}>Liste anlegen</Button>} />
        </Card>
      ) : (
        <Card className="p-3 sm:p-4">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Artikel (mehrere mit Komma)" aria-label="Artikel" />
            <input className="field w-24" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Menge" aria-label="Menge" />
            <Button variant="primary" type="submit" aria-label="Hinzufügen" disabled={!name.trim()}>
              <Plus className="size-5" />
            </Button>
          </form>
          {listItems.length === 0 && <EmptyState compact icon="🧺" title="Liste ist leer" text="Was brauchst du?" />}
          {[...open, ...done].map((i) => (
            <div key={i.id} className="group flex items-center gap-2 rounded-xl px-1 hover:bg-surface-2">
              <button onClick={() => actions().update('shoppingItems', i.id, { done: !i.done })} className="flex min-h-12 flex-1 items-center gap-3 text-left" aria-pressed={i.done}>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-lg border-2', i.done ? 'border-success bg-success text-white' : 'border-line-strong')}>
                  {i.done && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className={cn('flex-1 font-medium', i.done && 'text-faint line-through')}>{i.name}</span>
                {i.qty && <span className="text-sm text-muted">{i.qty}</span>}
              </button>
              <IconButton label="Entfernen" size="sm" onClick={() => actions().remove('shoppingItems', i.id, `„${i.name}“ entfernt`)}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {done.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => actions().removeMany('shoppingItems', done.map((d) => d.id), `${done.length} erledigte Artikel entfernt`)}>
                Erledigte entfernen
              </Button>
            )}
            <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => setConfirm(true)}>
              Liste löschen
            </Button>
          </div>
        </Card>
      )}
      <Modal
        open={newList}
        onClose={() => setNewList(false)}
        title="Neue Liste"
        footer={
          <Button
            variant="primary"
            disabled={!listName.trim()}
            onClick={() => {
              const l = actions().add('shoppingLists', { name: listName.trim(), emoji: '🛍️' })
              setListName('')
              setNewList(false)
              setParams({ list: l.id })
            }}
          >
            Anlegen
          </Button>
        }
      >
        <Field label="Name">
          <input className="field" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="z. B. Drogerie, Grillabend" />
        </Field>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Liste löschen?"
        message={`„${active?.name}“ mit ${listItems.length} Artikeln wird gelöscht.`}
        onConfirm={() => {
          if (active) actions().remove('shoppingLists', active.id, 'Liste gelöscht')
          setParams({})
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}

// ================================================================ Ausgaben & Sparziele
type ExpDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>

export function ExpenseEditor({ open, expense, onClose }: { open: boolean; expense?: Expense | null; onClose: () => void }) {
  const settings = useSettings()
  const [d, setD] = useState<ExpDraft>({ date: todayKey(), amount: 0, type: 'expense', category: settings.expenseCategories[0], note: '' })
  const [amount, setAmount] = useState('')
  useEffect(() => {
    if (open) {
      const init = expense ?? { date: todayKey(), amount: 0, type: 'expense' as const, category: settings.expenseCategories[0], note: '' }
      setD(init)
      setAmount(init.amount ? String(init.amount).replace('.', ',') : '')
    }
  }, [open, expense, settings.expenseCategories])
  const value = parseNum(amount)
  const valid = Number.isFinite(value) && value > 0
  const save = () => {
    if (!valid) return
    const v = { ...d, amount: Math.round(value * 100) / 100 }
    if (expense) actions().update('expenses', expense.id, v)
    else {
      actions().add('expenses', v)
      toast(d.type === 'expense' ? 'Ausgabe erfasst' : 'Einnahme erfasst', 'success')
    }
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Buchung bearbeiten' : 'Neue Buchung'}
      footer={
        <>
          {expense && (
            <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={() => { actions().remove('expenses', expense.id, 'Buchung gelöscht'); onClose() }}>
              Löschen
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={!valid}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented className="w-full" value={d.type} onChange={(v) => setD({ ...d, type: v })} options={[{ value: 'expense', label: 'Ausgabe' }, { value: 'income', label: 'Einnahme' }]} />
        <Field label="Betrag in €">
          <input className="field font-display text-2xl font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategorie">
            <select className="field" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
              {(d.type === 'income' ? ['Gehalt', 'Nebenjob', 'BAföG', 'Geschenk', 'Sonstiges'] : settings.expenseCategories).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Datum">
            <input type="date" className="field" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </Field>
        </div>
        <Field label="Notiz">
          <input className="field" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="optional" />
        </Field>
      </div>
    </Modal>
  )
}

export function monthStats(expenses: Expense[], month: string) {
  const inMonth = expenses.filter((e) => e.date.startsWith(month))
  const spent = inMonth.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0)
  const income = inMonth.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0)
  const byCat = new Map<string, number>()
  for (const e of inMonth.filter((x) => x.type === 'expense')) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
  return { inMonth, spent, income, byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]) }
}

export function FinanceView() {
  const expenses = useData('expenses')
  const goals = useData('goals')
  const budget = useApp((s) => s.settings.monthlyBudget)
  const [month, setMonth] = useState(todayKey().slice(0, 7))
  const [edit, setEdit] = useState<Expense | null>(null)
  const [creating, setCreating] = useState(false)
  const [goalEdit, setGoalEdit] = useState<SavingsGoal | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const stats = useMemo(() => monthStats(expenses, month), [expenses, month])
  const shiftMonth = (n: number) => {
    const d = fromDateKey(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthLabel = fromDateKey(`${month}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <IconButton label="Vorheriger Monat" onClick={() => shiftMonth(-1)}>
              ‹
            </IconButton>
            <h3 className="font-display text-lg font-semibold capitalize">{monthLabel}</h3>
            <IconButton label="Nächster Monat" onClick={() => shiftMonth(1)}>
              ›
            </IconButton>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-faint">Ausgaben</p>
              <p className="font-display text-xl font-bold tabular sm:text-2xl">{fmtEur(stats.spent)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-faint">Einnahmen</p>
              <p className="font-display text-xl font-bold tabular text-success sm:text-2xl">{fmtEur(stats.income)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-faint">Saldo</p>
              <p className={cn('font-display text-xl font-bold tabular sm:text-2xl', stats.income - stats.spent < 0 && 'text-danger')}>{fmtEur(stats.income - stats.spent)}</p>
            </div>
          </div>
          {budget > 0 && (
            <div className="mt-5">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">Budget</span>
                <span className="text-muted tabular">
                  {fmtEur(stats.spent, true)} / {fmtEur(budget, true)}
                </span>
              </div>
              <ProgressBar value={stats.spent / budget} tone={stats.spent > budget ? 'danger' : stats.spent > budget * 0.8 ? 'warn' : 'success'} />
            </div>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <SectionTitle action={<Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Buchung</Button>}>Buchungen</SectionTitle>
          {stats.inMonth.length === 0 ? (
            <EmptyState compact icon="💶" title="Keine Buchungen in diesem Monat" text="Erfasse Ausgaben in Sekunden – auch über das Plus oben." />
          ) : (
            [...stats.inMonth]
              .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
              .map((e) => (
                <button key={e.id} onClick={() => setEdit(e)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2">
                  <span className="w-12 shrink-0 text-xs text-muted">{fmtDate(e.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.note || e.category}</span>
                    {e.note && <span className="text-xs text-muted">{e.category}</span>}
                  </span>
                  <span className={cn('font-semibold tabular', e.type === 'income' ? 'text-success' : '')}>
                    {e.type === 'income' ? '+' : '−'}
                    {fmtEur(e.amount)}
                  </span>
                </button>
              ))
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <SectionTitle>Nach Kategorie</SectionTitle>
          {stats.byCat.length === 0 ? <p className="text-sm text-muted">Noch keine Ausgaben.</p> : <BarList rows={stats.byCat.map(([label, value]) => ({ label, value }))} format={(v) => fmtEur(v, true)} />}
        </Card>
        <Card className="p-4 sm:p-5">
          <SectionTitle action={<Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => { setGoalEdit(null); setGoalOpen(true) }}>Ziel</Button>}>Sparziele</SectionTitle>
          {goals.length === 0 ? (
            <p className="text-sm text-muted">Lege ein Sparziel an – z. B. Urlaub, Laptop oder Notgroschen.</p>
          ) : (
            goals.map((g) => <GoalRow key={g.id} goal={g} onEdit={() => { setGoalEdit(g); setGoalOpen(true) }} />)
          )}
        </Card>
      </div>
      <ExpenseEditor open={creating || !!edit} expense={edit} onClose={() => { setCreating(false); setEdit(null) }} />
      <GoalEditor open={goalOpen} goal={goalEdit} onClose={() => setGoalOpen(false)} />
    </div>
  )
}

function GoalRow({ goal, onEdit }: { goal: SavingsGoal; onEdit: () => void }) {
  const [amount, setAmount] = useState('')
  const p = goal.target > 0 ? goal.saved / goal.target : 0
  const change = (sign: 1 | -1) => {
    const v = parseNum(amount)
    if (!Number.isFinite(v) || v <= 0) return toast('Bitte einen Betrag eingeben')
    actions().update('goals', goal.id, { saved: Math.max(0, Math.round((goal.saved + sign * v) * 100) / 100) })
    setAmount('')
    if (sign === 1 && goal.saved + v >= goal.target && goal.saved < goal.target) toast(`🎉 Ziel „${goal.name}“ erreicht!`, 'success')
  }
  return (
    <div className="border-b border-line py-3 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{goal.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{goal.name}</p>
          <p className="text-xs text-muted tabular">
            {fmtEur(goal.saved, true)} von {fmtEur(goal.target, true)}
            {goal.deadline && ` · bis ${fmtDate(goal.deadline, { month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <span className="font-display font-bold tabular">{Math.round(p * 100)} %</span>
        <IconButton label="Bearbeiten" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
      </div>
      <ProgressBar value={p} tone={p >= 1 ? 'success' : 'accent'} className="mt-2" />
      <div className="mt-2 flex gap-2">
        <input className="field min-h-9 flex-1 py-1.5 text-sm" inputMode="decimal" placeholder="Betrag" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Betrag für ${goal.name}`} />
        <IconButton label="Abziehen" size="sm" onClick={() => change(-1)} className="border border-line">
          <Minus className="size-4" />
        </IconButton>
        <IconButton label="Einzahlen" size="sm" onClick={() => change(1)} className="bg-accent-soft text-accent">
          <Plus className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

function GoalEditor({ open, goal, onClose }: { open: boolean; goal: SavingsGoal | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (open) {
      setName(goal?.name ?? '')
      setEmoji(goal?.emoji ?? '🎯')
      setTarget(goal ? String(goal.target).replace('.', ',') : '')
      setDeadline(goal?.deadline ?? '')
    }
  }, [open, goal])
  const t = parseNum(target)
  const valid = name.trim() && Number.isFinite(t) && t > 0
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={goal ? 'Sparziel bearbeiten' : 'Neues Sparziel'}
        footer={
          <>
            {goal && (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}>
                Löschen
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!valid}
              onClick={() => {
                const v = { name: name.trim(), emoji, target: t, deadline: deadline || null }
                if (goal) actions().update('goals', goal.id, v)
                else actions().add('goals', { ...v, saved: 0 })
                onClose()
              }}
            >
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Symbol">
              <select className="field text-xl" value={emoji} onChange={(e) => setEmoji(e.target.value)}>
                {['🎯', '✈️', '💻', '🚗', '🏠', '🛟', '🎓', '💍', '📱', '🎮'].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Japan-Reise" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zielbetrag (€)">
              <input className="field" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Bis (optional)">
              <input type="date" className="field" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Sparziel löschen?"
        message={`„${goal?.name}“ wird gelöscht.`}
        onConfirm={() => {
          if (goal) actions().remove('goals', goal.id, 'Sparziel gelöscht')
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
