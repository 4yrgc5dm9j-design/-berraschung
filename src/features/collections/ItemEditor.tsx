import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, ImagePlus, Loader2, Trash2, X, CheckSquare } from 'lucide-react'
import { Button, ConfirmDialog, Field, Modal, Segmented, Stars } from '@/components/ui'
import { SourceIcon } from '@/components/ui/LinkIcon'
import { actions, useData } from '@/data/store'
import type { CollectionItem, ItemKind } from '@/data/types'
import { detectSource, firstUrlIn, instagramLabel, normalizeUrl, sourceLabel, youtubeId } from '@/lib/links'
import { compressImage } from '@/lib/image'
import { parseTags } from '@/lib/utils'
import { fetchPreview } from '@/services/server'
import { toast } from '@/data/toasts'
import { emptyTask } from '@/features/plan/tasks'

type Draft = Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>

export const emptyItem = (collectionId: string): Draft => ({
  collectionId,
  kind: 'link',
  title: '',
  url: '',
  source: 'web',
  note: '',
  image: null,
  preview: null,
  rating: 0,
  tags: [],
  favorite: false,
  done: false,
})

/** Vorschau laden – nur wo technisch & rechtlich zulässig (siehe Server). */
export async function loadPreview(url: string): Promise<{ preview: CollectionItem['preview']; message?: string }> {
  const source = detectSource(url)
  if (source === 'instagram') return { preview: null, message: 'Instagram stellt ohne registrierte Meta-App keine Vorschau bereit. Der Link öffnet direkt in Instagram.' }
  try {
    const p = await fetchPreview(url)
    if (p.unsupported) return { preview: null, message: p.reason }
    return { preview: { title: p.title, description: p.description, image: p.image || undefined, siteName: p.siteName, fetchedAt: new Date().toISOString() } }
  } catch (e) {
    // YouTube-Vorschaubild ist auch ohne Server bekannt
    const yt = youtubeId(url)
    if (yt) return { preview: { image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, siteName: 'YouTube', fetchedAt: new Date().toISOString() } }
    return { preview: null, message: (e as Error).message }
  }
}

export function ItemEditor({
  open,
  item,
  collectionId,
  initialUrl,
  onClose,
}: {
  open: boolean
  item?: CollectionItem | null
  collectionId?: string
  initialUrl?: string
  onClose: () => void
}) {
  const collections = useData('collections')
  const [d, setD] = useState<Draft>(emptyItem(''))
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastFetched = useRef('')

  useEffect(() => {
    if (!open) return
    const init = item ? { ...item } : { ...emptyItem(collectionId ?? collections[0]?.id ?? ''), url: initialUrl ?? '' }
    setD(init)
    setTags(item ? item.tags.join(', ') : '')
    setHint(null)
    lastFetched.current = item?.url ?? ''
    if (!item && initialUrl) void onUrl(initialUrl, init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const onUrl = async (raw: string, base: Draft = d) => {
    const url = normalizeUrl(raw)
    if (!url || url === lastFetched.current) return
    lastFetched.current = url
    const source = detectSource(url)
    setD((x) => ({ ...x, url, source, title: x.title || (source === 'instagram' ? instagramLabel(url) : '') }))
    setLoading(true)
    setHint(null)
    const { preview, message } = await loadPreview(url)
    setLoading(false)
    if (message) setHint(message)
    if (preview) setD((x) => ({ ...x, preview, title: x.title && x.title !== base.title ? x.title : preview.title || x.title }))
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const url = firstUrlIn(text) ?? text
      setD((x) => ({ ...x, url }))
      await onUrl(url)
    } catch {
      toast('Zugriff auf die Zwischenablage nicht möglich – bitte manuell einfügen.')
    }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const image = await compressImage(f)
      setD((x) => ({ ...x, image, kind: x.kind === 'link' && !x.url ? 'image' : x.kind }))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const urlValid = d.kind !== 'link' || !!normalizeUrl(d.url)
  const canSave = !!d.collectionId && urlValid && (d.title.trim() || d.url.trim() || d.note.trim() || d.image)

  const save = () => {
    if (!canSave) return
    const url = d.kind === 'link' ? normalizeUrl(d.url) ?? '' : d.url
    const v: Draft = { ...d, url, source: url ? detectSource(url) : 'web', tags: parseTags(tags), title: d.title.trim() || d.preview?.title || (url ? new URL(url).hostname : 'Ohne Titel') }
    if (item) actions().update('items', item.id, v)
    else {
      actions().add('items', v)
      const c = collections.find((x) => x.id === v.collectionId)
      toast(`In „${c?.name}“ gespeichert`, 'success')
    }
    onClose()
  }

  const makeTask = () => {
    const title = d.title.trim() || d.preview?.title || 'Aus Sammlung'
    actions().add('tasks', { ...emptyTask('Privat'), title, notes: [d.note, d.url].filter(Boolean).join('\n'), due: null, sourceItemId: item?.id ?? null })
    toast('Aufgabe erstellt', 'success')
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        wide
        title={item ? 'Eintrag bearbeiten' : 'Speichern'}
        footer={
          <>
            {item && (
              <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                <span className="hidden sm:inline">Löschen</span>
              </Button>
            )}
            <Button variant="ghost" icon={<CheckSquare className="size-4" />} onClick={makeTask} title="Aus diesem Eintrag eine Aufgabe machen">
              <span className="hidden sm:inline">Als Aufgabe</span>
            </Button>
            <Button variant="primary" onClick={save} disabled={!canSave}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented
            className="w-full"
            value={d.kind}
            onChange={(k: ItemKind) => set('kind', k)}
            options={[
              { value: 'link', label: 'Link' },
              { value: 'note', label: 'Notiz' },
              { value: 'image', label: 'Bild' },
            ]}
          />
          {d.kind === 'link' && (
            <Field
              label="Link"
              hint={
                d.url && !urlValid ? (
                  <span className="text-danger">Das sieht nicht wie ein gültiger Link aus.</span>
                ) : (
                  'Instagram-Reels, YouTube, Rezepte, Restaurants, Produkte … einfach einfügen.'
                )
              }
            >
              <div className="flex gap-2">
                <input
                  className="field"
                  value={d.url}
                  inputMode="url"
                  onChange={(e) => set('url', e.target.value)}
                  onBlur={() => onUrl(d.url)}
                  onPaste={(e) => {
                    const t = e.clipboardData.getData('text')
                    const u = firstUrlIn(t) ?? t
                    setTimeout(() => onUrl(u), 0)
                  }}
                  placeholder="https://www.instagram.com/reel/…"
                />
                <Button type="button" variant="secondary" onClick={pasteFromClipboard} aria-label="Aus Zwischenablage einfügen" title="Aus Zwischenablage einfügen">
                  <ClipboardPaste className="size-5" />
                </Button>
              </div>
            </Field>
          )}

          {d.kind === 'link' && (loading || d.preview || hint || d.url) && normalizeUrl(d.url) && (
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-3">
              {loading ? (
                <Loader2 className="size-5 animate-spin text-muted" />
              ) : d.preview?.image ? (
                <img src={d.preview.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface">
                  <SourceIcon source={detectSource(d.url)} className="size-7" />
                </span>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{loading ? 'Vorschau wird geladen …' : d.preview?.title || sourceLabel[detectSource(d.url)]}</p>
                {d.preview?.description && <p className="line-clamp-2 text-muted">{d.preview.description}</p>}
                {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
              </div>
              {d.preview && (
                <button aria-label="Vorschau entfernen" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface" onClick={() => set('preview', null)}>
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titel">
              <input className="field" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Pasta mit Salsiccia" />
            </Field>
            <Field label="Sammlung">
              <select className="field" value={d.collectionId} onChange={(e) => set('collectionId', e.target.value)}>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notiz">
            <textarea className="field min-h-24" value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="Warum hast du das gespeichert? Zutaten, Adresse, Preis …" />
          </Field>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Bild</span>
            {d.image ? (
              <div className="relative inline-block">
                <img src={d.image} alt="" className="max-h-48 rounded-2xl" />
                <button aria-label="Bild entfernen" onClick={() => set('image', null)} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="secondary" icon={<ImagePlus className="size-4" />} onClick={() => fileRef.current?.click()}>
                Foto oder Screenshot hinzufügen
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bewertung" group>
              <Stars value={d.rating} onChange={(v) => set('rating', v)} />
            </Field>
            <Field label="Tags" hint="Mit Komma trennen">
              <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vegetarisch, schnell" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex min-h-10 items-center gap-2 font-semibold">
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={d.favorite} onChange={(e) => set('favorite', e.target.checked)} />
              Favorit
            </label>
            <label className="flex min-h-10 items-center gap-2 font-semibold">
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={d.done} onChange={(e) => set('done', e.target.checked)} />
              Ausprobiert / erledigt
            </label>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Eintrag löschen?"
        message="Der Eintrag wird aus der Sammlung entfernt."
        onConfirm={() => {
          if (item) actions().remove('items', item.id, 'Eintrag gelöscht')
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
