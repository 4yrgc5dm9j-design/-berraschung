import { Building2, Globe, GraduationCap, Mail, MapPin, MessageCircle, Newspaper } from 'lucide-react'
import type { LinkSource, QuickLinkIcon } from '@/data/types'
import { cn } from '@/lib/utils'

// Vereinfachte, eigene Symbole – bewusst keine Original-Logos.
const InstagramGlyph = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={p.className} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)
const PlayGlyph = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="4.5" fill="currentColor" />
    <path d="M10 9.2v5.6l5-2.8z" fill="white" />
  </svg>
)
const WavesGlyph = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M7 9.3c3.6-1 7.3-.7 10.3.9M7.6 12.4c3-.8 6-.5 8.4.8M8.2 15.3c2.4-.6 4.6-.4 6.6.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
)
const NoteGlyph = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} aria-hidden>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M10 7.5v7.2a2 2 0 1 1-1.4-1.9M10 7.5l5-1.2v6.8a2 2 0 1 1-1.4-1.9" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </svg>
)

const styles: Record<QuickLinkIcon, { bg: string; fg: string }> = {
  instagram: { bg: 'linear-gradient(135deg,#f9a03f 0%,#e8336b 45%,#8a3ab9 100%)', fg: '#fff' },
  spotify: { bg: '#121212', fg: '#1ed760' },
  youtube: { bg: '#fff1f1', fg: '#e62117' },
  mail: { bg: '#e8f0ff', fg: '#2f5fe3' },
  bank: { bg: '#e6f6ef', fg: '#0f8a62' },
  uni: { bg: '#f1ebff', fg: '#7045d8' },
  news: { bg: '#fff3e2', fg: '#b86e00' },
  web: { bg: 'var(--surface-3)', fg: 'var(--text)' },
  maps: { bg: '#e7f7f3', fg: '#11806b' },
  chat: { bg: '#e8f7ec', fg: '#16a34a' },
}

export function QuickIcon({ icon, className }: { icon: QuickLinkIcon; className?: string }) {
  const s = styles[icon]
  const inner = 'size-6'
  return (
    <span className={cn('grid size-12 place-items-center rounded-2xl', className)} style={{ background: s.bg, color: s.fg }}>
      {icon === 'instagram' && <InstagramGlyph className={inner} />}
      {icon === 'youtube' && <PlayGlyph className={inner} />}
      {icon === 'spotify' && <WavesGlyph className={inner} />}
      {icon === 'mail' && <Mail className={inner} />}
      {icon === 'bank' && <Building2 className={inner} />}
      {icon === 'uni' && <GraduationCap className={inner} />}
      {icon === 'news' && <Newspaper className={inner} />}
      {icon === 'web' && <Globe className={inner} />}
      {icon === 'maps' && <MapPin className={inner} />}
      {icon === 'chat' && <MessageCircle className={inner} />}
    </span>
  )
}

export function SourceIcon({ source, className }: { source: LinkSource; className?: string }) {
  const c = cn('size-4', className)
  if (source === 'instagram') return <InstagramGlyph className={c} />
  if (source === 'youtube') return <PlayGlyph className={c} />
  if (source === 'spotify') return <WavesGlyph className={c} />
  if (source === 'tiktok') return <NoteGlyph className={c} />
  if (source === 'maps') return <MapPin className={c} />
  return <Globe className={c} />
}

export const sourceColor: Record<LinkSource, string> = {
  instagram: '#d6336c',
  youtube: '#e62117',
  tiktok: '#111111',
  spotify: '#1db954',
  maps: '#11806b',
  web: 'var(--muted)',
}

export function guessIcon(url: string): QuickLinkIcon {
  const h = url.toLowerCase()
  if (h.includes('instagram')) return 'instagram'
  if (h.includes('spotify')) return 'spotify'
  if (h.includes('youtube') || h.includes('youtu.be')) return 'youtube'
  if (h.includes('mail') || h.includes('outlook')) return 'mail'
  if (h.includes('bank') || h.includes('sparkasse') || h.includes('volksbank') || h.includes('depot')) return 'bank'
  if (h.includes('uni') || h.includes('moodle') || h.includes('ilias') || h.includes('campus') || h.includes('hochschule')) return 'uni'
  if (h.includes('maps')) return 'maps'
  if (h.includes('whatsapp') || h.includes('telegram') || h.includes('signal')) return 'chat'
  if (h.includes('news') || h.includes('tagesschau') || h.includes('spiegel') || h.includes('zeit.de')) return 'news'
  return 'web'
}
