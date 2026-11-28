// The painting news feed: articles about painting from free public feeds (RSS), cleaned into a title, a snippet and a picture, each linking back to the
// article on its own site. Plain TypeScript with no Deno-only APIs, so the same code is tested in Node (scripts/feedChecks.ts) and run by the news-feed function.
//
// Only a short snippet of each article is shown, with the source named and a link to read the rest there: the same thing a news aggregator does.

export interface FeedSource {
  id: string
  name: string
  url: string
  /** The feed is about everything (home improvement): keep only the items about painting. A painting search feed needs no filter. */
  filter: boolean
}

export const FEEDS: FeedSource[] = [
  { id: 'fh-painting', name: 'Family Handyman', url: 'https://www.familyhandyman.com/?s=painting&feed=rss2', filter: false },
  { id: 'fh-paint', name: 'Family Handyman', url: 'https://www.familyhandyman.com/?s=paint&feed=rss2', filter: false },
  { id: 'fh-exterior', name: 'Family Handyman', url: 'https://www.familyhandyman.com/?s=exterior+paint&feed=rss2', filter: false },
  { id: 'fh-interior', name: 'Family Handyman', url: 'https://www.familyhandyman.com/?s=interior+paint&feed=rss2', filter: false },
  { id: 'fh-primer', name: 'Family Handyman', url: 'https://www.familyhandyman.com/?s=primer&feed=rss2', filter: false },
  { id: 'fh-cabinets', name: 'Family Handyman', url: 'https://www.familyhandyman.com/?s=paint+cabinets&feed=rss2', filter: false },
  { id: 'bobvila', name: 'Bob Vila', url: 'https://www.bobvila.com/feed/', filter: true },
  { id: 'hometalk', name: 'Hometalk', url: 'https://www.hometalk.com/rss', filter: true },
  { id: 'hunker', name: 'Hunker', url: 'https://www.hunker.com/rss', filter: true },
  { id: 'remodelaholic', name: 'Remodelaholic', url: 'https://www.remodelaholic.com/?s=paint&feed=rss2', filter: true },
  { id: 'artofdoingstuff', name: 'The Art of Doing Stuff', url: 'https://www.theartofdoingstuff.com/?s=paint&feed=rss2', filter: true },
]

export interface Article {
  id: string
  title: string
  /** A few sentences from the article (about eight lines on screen). */
  snippet: string
  url: string
  source: string
  image: string | null
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...', ndash: '-', mdash: '-' }

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n.toLowerCase()] ?? m)
}

/** HTML (or double-encoded HTML, as some feeds send it) to plain text. */
export function stripHtml(input: string): string {
  let s = input.replace(/<!\[CDATA\[|\]\]>/g, '')
  // some feeds send their HTML escaped (&lt;p&gt;...): decode once so the tags can be removed
  if (!/<[a-z][^>]*>/i.test(s) && /&lt;[a-z]/i.test(s)) s = decodeEntities(s)
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|li|h[1-6]|br)\s*>|<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
  return decodeEntities(s).replace(/\s+/g, ' ').trim()
}

function tag(item: string, name: string): string | null {
  const m = new RegExp('<' + name.replace(':', '\\:') + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name.replace(':', '\\:') + '>', 'i').exec(item)
  return m ? m[1].trim() : null
}

function attr(item: string, name: string, attribute: string): string | null {
  const m = new RegExp('<' + name.replace(':', '\\:') + '\\s[^>]*?' + attribute + '="([^"]+)"', 'i').exec(item)
  return m ? decodeEntities(m[1]) : null
}

const httpUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\//i.test(u.trim()) ? decodeEntities(u.trim()) : null)

export interface RawItem {
  title: string
  link: string
  description: string
  content: string
  image: string | null
}

/** The items of an RSS feed. */
export function parseFeed(xml: string): RawItem[] {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((chunk) => {
      const description = tag(chunk, 'description') ?? ''
      const content = tag(chunk, 'content:encoded') ?? ''
      const image =
        httpUrl(attr(chunk, 'media:content', 'url')) ??
        httpUrl(attr(chunk, 'media:thumbnail', 'url')) ??
        httpUrl(attr(chunk, 'enclosure', 'url')) ??
        httpUrl(/<img[^>]*?\ssrc=["']?([^"'\s>]+)/i.exec(decodeEntities(content + ' ' + description))?.[1])
      return {
        title: stripHtml(tag(chunk, 'title') ?? ''),
        link: stripHtml(tag(chunk, 'link') ?? ''),
        description,
        content,
        image,
      }
    })
    .filter((i) => i.title && i.link)
}

/** Whether an item is about painting (a home-improvement feed has all kinds of things in it). */
export function isAboutPainting(title: string, text: string): boolean {
  // the start of the article counts, not a "you might also like..." footer that happens to name a painted something
  const body = text.replace(/\b(?:if you like this post )?you might also like\b.*$/i, ' ').replace(/\bThe post .{3,160}? appeared first on .{2,80}/gi, ' ')
  const t = `${title} ${body.slice(0, 450)}`
  return /\bpaint(?:s|ed|er|ers|ing)?\b|\bprimer\b|\bcaulk(?:ing)?\b|\bfaux finish\b|\bwallpaper\b|\bcolor palette\b|\bsheen\b|\bsatin\b|\beggshell\b/i.test(t) && !/\bpaint(?:ing)? (?:the town|your nails)\b|\bnail polish\b/i.test(t)
}

/** A few sentences of the article for the feed: not the whole thing. About eight lines of a feed card. */
export function makeSnippet(title: string, description: string, content: string, max = 700): string {
  const clean = (html: string) =>
    stripHtml(html)
      .replace(/\bThe post .{3,160}? appeared first on .{2,80}?\.?(?=\s|$)/gi, ' ')
      .replace(/\b(?:Continue reading|Read more|Read the full (?:article|post)|Click here)\b.*$/i, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const fromContent = clean(content)
  const fromDescription = clean(description)
  let text = fromContent.length > fromDescription.length ? fromContent : fromDescription
  // the article often opens by repeating its own title
  if (text.toLowerCase().startsWith(title.toLowerCase())) text = text.slice(title.length).replace(/^[\s:.\-–—]+/, '')
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (sentence > max * 0.55 ? cut.slice(0, sentence + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '...').trim()
}

export function toArticle(item: RawItem, source: FeedSource): Article | null {
  const url = httpUrl(item.link)
  if (!url) return null
  const snippet = makeSnippet(item.title, item.description, item.content)
  if (source.filter && !isAboutPainting(item.title, stripHtml(item.content || item.description))) return null
  if (snippet.length < 70) return null
  return { id: source.id + ':' + url, title: item.title, snippet, url, source: source.name, image: item.image }
}

/** Fisher-Yates, so the feed is a different mix each time. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function getText(url: string, ms: number): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThePaintedPainterBot/1.0; +https://thepaintedpainter.com)' }, redirect: 'follow', signal: AbortSignal.timeout(ms) })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

/** Every feed, in parallel; one that is down or slow is just missing. One article per link, in no particular order. */
export async function fetchArticles(feeds: FeedSource[] = FEEDS): Promise<Article[]> {
  const results = await Promise.all(
    feeds.map(async (f) => {
      const xml = await getText(f.url, 9000)
      return xml ? parseFeed(xml).map((i) => toArticle(i, f)).filter((a): a is Article => !!a) : []
    }),
  )
  const seen = new Set<string>()
  const out: Article[] = []
  for (const a of results.flat()) {
    const key = a.url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

/** A picture for an article whose feed item had none: the page's own social-share image. */
export async function findPageImage(url: string): Promise<string | null> {
  const html = await getText(url, 5000)
  if (!html) return null
  const head = html.slice(0, 60000)
  const m = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(head) ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(head)
  return httpUrl(m?.[1])
}

/** "Jane Doe" becomes "Jane D.": first name and last initial only. */
export function reviewerLabel(name: unknown): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A customer'
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

/** A review's words cut to about this many characters at a word boundary. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return t.slice(0, t.lastIndexOf(' ', max)).replace(/[,;:\s]+$/, '') + '...'
}
