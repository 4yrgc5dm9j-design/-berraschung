// Öffentliche RSS-/Atom-Feeds je Thema. Die App zeigt nur Titel, Anriss,
// Quelle und Datum und verlinkt immer auf den Originalartikel.
export const FEEDS = {
  wirtschaft: [
    { source: 'tagesschau', url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml' },
    { source: 'Spiegel', url: 'https://www.spiegel.de/wirtschaft/index.rss' },
  ],
  finanzen: [
    { source: 'tagesschau', url: 'https://www.tagesschau.de/wirtschaft/finanzen/index~rss2.xml' },
  ],
  technologie: [
    { source: 'heise online', url: 'https://www.heise.de/rss/heise-top-atom.xml' },
    { source: 'golem', url: 'https://rss.golem.de/rss.php?feed=ATOM1.0' },
  ],
  politik: [
    { source: 'tagesschau', url: 'https://www.tagesschau.de/inland/index~rss2.xml' },
    { source: 'tagesschau', url: 'https://www.tagesschau.de/ausland/index~rss2.xml' },
  ],
  sport: [
    { source: 'sportschau', url: 'https://www.sportschau.de/index~rss2.xml' },
    { source: 'kicker', url: 'https://newsfeed.kicker.de/news/aktuell' },
  ],
  wissen: [
    { source: 'tagesschau', url: 'https://www.tagesschau.de/wissen/index~rss2.xml' },
  ],
}

const decodeEntities = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const stripTags = (s) => decodeEntities(decodeEntities(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1] : ''
}

function attr(block, tagName, attrName, filter) {
  const re = new RegExp(`<${tagName}\\b([^>]*)/?>`, 'gi')
  let m
  while ((m = re.exec(block))) {
    if (filter && !filter(m[1])) continue
    const a = m[1].match(new RegExp(`${attrName}=["']([^"']+)["']`, 'i'))
    if (a) return decodeEntities(a[1])
  }
  return ''
}

/** Minimaler, toleranter Parser für RSS 2.0 und Atom. */
export function parseFeed(xml, source, topic) {
  const items = []
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml)
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? []
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title'))
    let link = isAtom
      ? attr(b, 'link', 'href', (a) => !/rel=["'](?!alternate)/i.test(a))
      : stripTags(tag(b, 'link')) || stripTags(tag(b, 'guid'))
    const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')
    const summaryRaw = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')
    const image =
      attr(b, 'enclosure', 'url', (a) => /image/i.test(a)) ||
      attr(b, 'media:content', 'url') ||
      attr(b, 'media:thumbnail', 'url') ||
      (decodeEntities(summaryRaw).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? '')
    if (!title || !link) continue
    link = link.trim()
    if (!/^https?:\/\//i.test(link)) continue
    const parsedDate = date ? new Date(stripTags(date)) : null
    items.push({
      id: link,
      title,
      link,
      source,
      topic,
      publishedAt: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      summary: stripTags(summaryRaw).slice(0, 320),
      image: image && /^https:\/\//.test(image) ? image : null,
    })
  }
  return items
}
