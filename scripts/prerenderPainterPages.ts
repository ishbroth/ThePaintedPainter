// Generates one static, crawlable HTML page per real (non-demo) painter, plus a sitemap.xml that lists every one of
// them, so a search for a painter's own business name has an actual indexable page to find — with that painter's own
// title, meta description, Open Graph tags and visible content — instead of every URL on the site serving the
// identical homepage meta tags. This is what CLAUDE.md's SEO treatment looks like for a database-backed marketplace
// on a fully static host (GitHub Pages): no server to render per-request, so the pages are written once at build
// time instead. A real visitor gets the exact same page; React mounts into it immediately and replaces this static
// shell with the live, interactive profile (see PainterPublicProfile.tsx) — a crawler that never runs the JS still
// sees real, unique text and structured data.
//
// Run AFTER `vite build` (it reads dist/index.html as its template, for the already-hashed asset filenames):
//
//   npm run build && npm run prerender:painters
//
// Safe to run again any time — it only reads public, already-safe-to-show data (the same map_painters list and
// painter-detail function the results page and profile page already use), and fully regenerates dist/painters/ and
// dist/sitemap.xml from scratch each time, so a painter who is removed simply isn't written into the next build.

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { supabaseUrl, supabaseAnonKey } from '../src/lib/supabase.ts'

const SITE = 'https://www.thepaintedpainter.com'
const DIST = join(process.cwd(), 'dist')
const CONCURRENCY = 6

// The hand-maintained part of the sitemap (every static route) — kept here, not re-read from public/sitemap.xml,
// so there is exactly one place this list needs updating when a new static page is added.
const STATIC_URLS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact', changefreq: 'monthly', priority: '0.9' },
  { path: '/painters-map', changefreq: 'daily', priority: '0.9' },
  { path: '/support', changefreq: 'monthly', priority: '0.6' },
  { path: '/painter-signup', changefreq: 'monthly', priority: '0.7' },
  { path: '/gallery', changefreq: 'weekly', priority: '0.5' },
  { path: '/auth/customer-sign-in', changefreq: 'monthly', priority: '0.6' },
  { path: '/auth/customer-sign-up', changefreq: 'monthly', priority: '0.6' },
]

interface MapPainterRow {
  id: string
  company_name: string
  city: string | null
  state: string | null
  service_types: string[] | null
  avg_rating: number
  review_count: number
  years_in_business: number | null
  is_licensed: boolean
  is_insured: boolean
  is_bonded: boolean
}

interface PainterDetail {
  companyName: string
  city: string
  state: string
  bio: string | null
  services: string[]
  credentials: {
    license: { has: boolean }
    insurance: { has: boolean }
    bond: { has: boolean }
  }
  photos: { url: string; caption: string }[]
  rating: { average: number | null; count: number }
  reviews: { reviewer: string; rating: number; title: string | null; body: string | null; date: string }[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Runs `fn` over `items` with at most `limit` in flight at once — a per-painter network call (painter-detail) for
 * every painter at once would otherwise hammer the edge function on a network with many painters. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function painterPage(template: string, row: MapPainterRow, detail: PainterDetail | null): string {
  const name = detail?.companyName || row.company_name
  const city = detail?.city || row.city || ''
  const state = detail?.state || row.state || ''
  const place = [city, state].filter(Boolean).join(', ')
  const rating = detail?.rating.average ?? (row.avg_rating > 0 ? row.avg_rating : null)
  const reviewCount = detail?.rating.count ?? row.review_count
  const services = detail?.services ?? row.service_types ?? []
  const licensed = detail?.credentials.license.has ?? row.is_licensed
  const insured = detail?.credentials.insurance.has ?? row.is_insured
  const bonded = detail?.credentials.bond.has ?? row.is_bonded
  const url = `${SITE}/painters/${row.id}/`
  const bio = detail?.bio ?? ''
  const photos = detail?.photos ?? []
  const reviews = detail?.reviews ?? []

  const credBits = [licensed && 'licensed', insured && 'insured', bonded && 'bonded'].filter(Boolean).join(', ')
  const ratingBit = rating != null && reviewCount > 0 ? `, rated ${rating.toFixed(1)} stars from ${reviewCount} review${reviewCount === 1 ? '' : 's'}` : ''
  const title = `${name} — House Painter in ${place || 'the USA'} | The Painted Painter`
  const description = `${name} is a${credBits ? ` ${credBits}` : ''} house painter serving ${place || 'their local area'}${ratingBit}. Get a free instant estimate and book ${name}, or compare other verified local painters, on The Painted Painter.`.replace(/\s+/g, ' ')
  const ogImage = photos[0]?.url || `${SITE}/IMG_7201.PNG`

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name,
    url,
    image: ogImage,
    ...(place ? { address: { '@type': 'PostalAddress', addressLocality: city || undefined, addressRegion: state || undefined, addressCountry: 'US' } } : {}),
    ...(place ? { areaServed: place } : {}),
    ...(rating != null && reviewCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating, reviewCount } } : {}),
  }

  const body: string[] = []
  body.push(`<h1>${esc(name)}</h1>`)
  if (place) body.push(`<p>${esc(place)}</p>`)
  if (rating != null && reviewCount > 0) body.push(`<p>${rating.toFixed(1)} stars (${reviewCount} review${reviewCount === 1 ? '' : 's'})</p>`)
  if (credBits) body.push(`<p>${esc(credBits.charAt(0).toUpperCase() + credBits.slice(1))}</p>`)
  if (bio) body.push(`<p>${esc(bio)}</p>`)
  if (services.length > 0) body.push(`<p>Services: ${esc(services.join(', '))}</p>`)
  if (photos.length > 0) {
    body.push('<div>' + photos.slice(0, 6).map((p) => `<img src="${esc(p.url)}" alt="${esc(p.caption || `${name} project photo`)}" width="300" loading="lazy" />`).join('') + '</div>')
  }
  if (reviews.length > 0) {
    body.push('<div>' + reviews.slice(0, 5).map((r) => `<p><strong>${esc(r.reviewer)}</strong> — ${r.rating}/5${r.title ? `: ${esc(r.title)}` : ''}${r.body ? `<br>${esc(r.body)}` : ''}</p>`).join('') + '</div>')
  }
  body.push('<p><a href="/">Get a free painting estimate</a> or <a href="/painters-map">browse more painters</a>.</p>')

  let html = template
  // the homepage's own structured data (WebApplication/Service/FAQ) describes the SITE, not this painter — each
  // page's schema should describe what's actually on it, so those (and the comment introducing each) are dropped
  // in favor of this painter's own
  html = html.replace(/\s*<!--[^\n]*-->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
  const before = html
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${esc(description)}" />`)
  html = html.replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${url}" />`)
  html = html.replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${esc(title)}" />`)
  html = html.replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${esc(description)}" />`)
  html = html.replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${url}" />`)
  html = html.replace(/<meta property="og:image"[^>]*\/>/, `<meta property="og:image" content="${esc(ogImage)}" />`)
  html = html.replace(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${esc(title)}" />`)
  html = html.replace(/<meta name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${esc(description)}" />`)
  html = html.replace(/<meta name="twitter:image"[^>]*\/>/, `<meta name="twitter:image" content="${esc(ogImage)}" />`)
  if (html === before) console.warn(`  (!) none of the per-page tag replacements matched for ${row.id} — index.html's <head> may have changed shape`)
  html = html.replace('<div id="root"></div>', `<div id="root">${body.join('\n')}</div>`)
  html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`)
  return html
}

function buildSitemap(painters: MapPainterRow[]): string {
  const entry = (loc: string, changefreq: string, priority: string) =>
    `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  const urls = [
    ...STATIC_URLS.map((u) => entry(`${SITE}${u.path}`, u.changefreq, u.priority)),
    ...painters.map((p) => entry(`${SITE}/painters/${p.id}/`, 'monthly', '0.6')),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase
    .from('map_painters')
    .select('id, company_name, city, state, service_types, avg_rating, review_count, years_in_business, is_licensed, is_insured, is_bonded')
    .eq('is_demo', false)
  if (error) throw error
  const painters = (data ?? []).map((r) => ({ ...r, avg_rating: Number(r.avg_rating) || 0 })) as MapPainterRow[]
  console.log(`Prerendering ${painters.length} painter page(s)...`)

  const template = readFileSync(join(DIST, 'index.html'), 'utf8')

  const details = await mapWithConcurrency(painters, CONCURRENCY, async (p): Promise<PainterDetail | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('painter-detail', { body: { painterId: p.id } })
      if (error || !data || (data as { error?: string }).error) return null
      return data as PainterDetail
    } catch {
      return null
    }
  })

  for (let i = 0; i < painters.length; i++) {
    const row = painters[i]
    const dir = join(DIST, 'painters', row.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), painterPage(template, row, details[i]))
  }

  writeFileSync(join(DIST, 'sitemap.xml'), buildSitemap(painters))
  console.log(`Wrote ${painters.length} painter page(s) and sitemap.xml`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
