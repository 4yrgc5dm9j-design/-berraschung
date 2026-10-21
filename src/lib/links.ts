import type { LinkSource } from '@/data/types'

export function normalizeUrl(input: string): string | null {
  const v = input.trim()
  if (!v) return null
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withProto)
    if (!['http:', 'https:'].includes(u.protocol)) return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

export function detectSource(url: string): LinkSource {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'web'
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') return 'instagram'
  if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube'
  if (host.endsWith('tiktok.com')) return 'tiktok'
  if (host.endsWith('spotify.com') || host === 'spotify.link') return 'spotify'
  if (host.startsWith('maps.') || host === 'goo.gl' || host === 'maps.app.goo.gl' || url.includes('google.com/maps')) return 'maps'
  return 'web'
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/)
    return m ? m[2] : null
  } catch {
    return null
  }
}

/** Bezeichnung für Instagram-Links, ohne Daten von Instagram abzurufen */
export function instagramLabel(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    if (parts[0] === 'reel' || parts[0] === 'reels') return 'Instagram-Reel'
    if (parts[0] === 'p') return 'Instagram-Beitrag'
    if (parts[0] === 'stories') return `Story von @${parts[1] ?? ''}`
    if (parts[0] === 'explore') return 'Instagram Entdecken'
    if (parts[0]) return `@${parts[0]}`
  } catch {
    /* ignore */
  }
  return 'Instagram'
}

export const sourceLabel: Record<LinkSource, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  maps: 'Karte',
  web: 'Web',
}

export function firstUrlIn(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"]+/i)
  return m ? m[0] : null
}
