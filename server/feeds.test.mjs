import { expect, it } from 'vitest'
import { parseFeed } from './feeds.mjs'

it('liest RSS und Atom inkl. CDATA und Entities', () => {
  const rss = `<rss><channel><item><title><![CDATA[DAX &amp; Co.]]></title><link>https://a.de/1</link><pubDate>Tue, 20 Oct 2026 10:00:00 +0200</pubDate><description>&lt;p&gt;Text&lt;/p&gt;</description></item></channel></rss>`
  const atom = `<feed><entry><title>Chip</title><link rel="alternate" href="https://b.de/2"/><updated>2026-10-21T08:00:00Z</updated></entry></feed>`
  const [a] = parseFeed(rss, 'x', 'wirtschaft')
  const [b] = parseFeed(atom, 'y', 'technologie')
  expect(a).toMatchObject({ title: 'DAX & Co.', link: 'https://a.de/1', summary: 'Text', publishedAt: '2026-10-20T08:00:00.000Z' })
  expect(b).toMatchObject({ title: 'Chip', link: 'https://b.de/2' })
  expect(parseFeed('<rss><item><title>x</title><link>javascript:1</link></item></rss>', 'z', 'w')).toHaveLength(0)
})
