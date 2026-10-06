// "Reviews elsewhere": a painter can link their Google / Yelp / Facebook reviews
// and say what rating and review count those pages show. We can't verify the
// numbers automatically, so they're shown as painter-reported next to a link the
// customer can follow. Everything here is untrusted input (it's typed by the
// painter and rendered to the public), so links are limited to https URLs on the
// right domain for that source, and ratings/counts are range-checked.

export type ExternalSource = 'google' | 'yelp' | 'facebook'

export interface ExternalReview {
  source: ExternalSource
  url: string
  rating: number | null
  count: number | null
}

const HOSTS: Record<ExternalSource, string[]> = {
  google: ['google.com', 'g.page', 'goo.gl', 'g.co'],
  yelp: ['yelp.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
}

export const SOURCES: ExternalSource[] = ['google', 'yelp', 'facebook']

function hostMatches(host: string, allowed: string[]): boolean {
  return allowed.some((h) => host === h || host.endsWith(`.${h}`))
}

/** Returns a cleaned, safe list; anything invalid is dropped rather than rejected. */
export function cleanExternalReviews(input: unknown): ExternalReview[] {
  const out: ExternalReview[] = []
  if (!input || typeof input !== 'object') return out
  const obj = input as Record<string, unknown>

  for (const source of SOURCES) {
    const raw = obj[source]
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>

    let url: URL
    try {
      url = new URL(String(entry.url ?? '').trim())
    } catch {
      continue
    }
    if (url.protocol !== 'https:' || !hostMatches(url.hostname.toLowerCase(), HOSTS[source]) || url.href.length > 400) continue

    const ratingNum = Number(entry.rating)
    const rating = entry.rating !== null && entry.rating !== undefined && entry.rating !== '' && isFinite(ratingNum) && ratingNum >= 0 && ratingNum <= 5
      ? Math.round(ratingNum * 10) / 10
      : null
    const countNum = Number(entry.count)
    const count = entry.count !== null && entry.count !== undefined && entry.count !== '' && Number.isInteger(countNum) && countNum >= 0 && countNum <= 1_000_000
      ? countNum
      : null

    out.push({ source, url: url.href, rating, count })
  }
  return out
}

/** The stored shape (object keyed by source) for a cleaned list. */
export function toStored(list: ExternalReview[]): Record<string, { url: string; rating: number | null; count: number | null }> {
  const stored: Record<string, { url: string; rating: number | null; count: number | null }> = {}
  for (const r of list) stored[r.source] = { url: r.url, rating: r.rating, count: r.count }
  return stored
}
