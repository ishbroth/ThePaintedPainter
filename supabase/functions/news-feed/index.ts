// supabase/functions/news-feed/index.ts
//
// Supabase Edge Function: the public painting feed. One call returns everything the feed page mixes together:
//   - articles   about painting, from free public feeds (title, a snippet, a picture, a link to the article on its own site)
//   - painters   featured painters: a painter with 5-star reviews, one of their gallery photos, and one of those reviews
//   - reviews    random good reviews of painters, from the customers who wrote them (first name and last initial only)
//
// Browsers cannot read other sites' feeds directly (CORS), which is why articles come through here. The article pool is re-read from the feeds at least every hour
// (and on each cold start of the function): the painting searches give a steady pool of older articles, and the sites' own newest-first feeds, filtered to painting, bring
// in each new painting article the day it is published. Every visit gets a different mix, with a few of the newest on top. Painters and reviews are read live.
//
// DEMONSTRATION DATA: for now the painters and reviews are the demonstration painters (painters.is_demo = true) and their made-up reviews, as asked. This is the
// one place that shows demo painters to the public. Set the secret FEED_INCLUDE_DEMO to "false" to switch to real, approved painters only the day real
// painters and reviews exist:   supabase secrets set FEED_INCLUDE_DEMO=false
//
// GET or POST, no body.
//
// Deploy:
//   supabase functions deploy news-feed --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { clip, fetchArticles, findPageImage, pickArticles, reviewerLabel, shuffle, type Article } from '../_shared/newsFeed.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ARTICLE_TTL_MS = 60 * 60 * 1000
const ARTICLES_RETURNED = 16
const PAINTERS_RETURNED = 6
const REVIEWS_RETURNED = 8

let articleCache: { at: number; items: Article[] } | null = null
const imageCache = new Map<string, string | null>()

async function articles(): Promise<Article[]> {
  if (articleCache && Date.now() - articleCache.at < ARTICLE_TTL_MS) return articleCache.items
  const fresh = await fetchArticles()
  // every feed down: keep showing what was fetched last time
  if (fresh.length === 0 && articleCache) return articleCache.items
  articleCache = { at: Date.now(), items: fresh }
  return fresh
}

async function withPictures(list: Article[]): Promise<Article[]> {
  return await Promise.all(
    list.map(async (a) => {
      if (a.image) return a
      if (!imageCache.has(a.url)) imageCache.set(a.url, await findPageImage(a.url))
      return { ...a, image: imageCache.get(a.url) ?? null }
    }),
  )
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // a public page that fetches other sites and reads the database: a generous per-visitor limit keeps it from being used as a pump
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { data: allowed, error: limitError } = await supabase.rpc('check_chat_rate_limit', { p_client_key: `feed:${ip}`, p_window_seconds: 600, p_max_requests: 60 })
    if (!limitError && allowed === false) return json({ error: 'rate_limited' }, 429)

    const includeDemo = (Deno.env.get('FEED_INCLUDE_DEMO') ?? 'true').toLowerCase() !== 'false'

    // ---- painters and their reviews ----
    let painterQuery = supabase.from('painters').select('id, user_id, company_name, city, state').eq('status', 'approved').eq('verified', true).not('user_id', 'is', null).limit(300)
    if (!includeDemo) painterQuery = painterQuery.eq('is_demo', false)
    const { data: painterRows } = await painterQuery
    const painters = (painterRows ?? []) as { id: string; user_id: string; company_name: string; city: string | null; state: string | null }[]
    const byUser = new Map(painters.map((p) => [p.user_id, p]))

    const userIds = painters.map((p) => p.user_id)
    const { data: reviewRows } = userIds.length
      ? await supabase.from('reviews').select('id, painter_id, rating, title, body, customer_name').in('painter_id', userIds).gte('rating', 4).not('body', 'is', null).limit(1500)
      : { data: [] as never[] }
    const reviews = (reviewRows ?? []) as { id: string; painter_id: string; rating: number; title: string | null; body: string | null; customer_name: string | null }[]

    const painterIds = painters.map((p) => p.id)
    const { data: photoRows } = painterIds.length
      ? await supabase.from('painter_portfolio').select('painter_id, storage_path, caption').in('painter_id', painterIds).limit(2000)
      : { data: [] as never[] }
    const photosBy = new Map<string, { url: string; caption: string | null }[]>()
    for (const row of (photoRows ?? []) as { painter_id: string; storage_path: string; caption: string | null }[]) {
      const url = /^https?:\/\//.test(row.storage_path) ? row.storage_path : `${supabaseUrl}/storage/v1/object/public/painter-portfolio/${row.storage_path}` // full URLs are demonstration photos
      photosBy.set(row.painter_id, [...(photosBy.get(row.painter_id) ?? []), { url, caption: row.caption }])
    }

    // featured: painters with at least one 5-star review and a gallery photo, a different few each time
    const fiveBy = new Map<string, typeof reviews>()
    for (const r of reviews) if (r.rating === 5 && (r.body ?? '').trim().length > 20) fiveBy.set(r.painter_id, [...(fiveBy.get(r.painter_id) ?? []), r])
    const featured = shuffle(painters.filter((p) => (fiveBy.get(p.user_id)?.length ?? 0) > 0 && (photosBy.get(p.id)?.length ?? 0) > 0))
      .slice(0, PAINTERS_RETURNED)
      .map((p) => {
        const mine = reviews.filter((r) => r.painter_id === p.user_id)
        const average = mine.length ? Math.round((mine.reduce((s, r) => s + r.rating, 0) / mine.length) * 10) / 10 : 5
        const quote = shuffle(fiveBy.get(p.user_id) ?? [])[0]
        const photo = shuffle(photosBy.get(p.id) ?? [])[0]
        return {
          id: p.id,
          companyName: p.company_name,
          city: p.city,
          state: p.state,
          photo,
          rating: { average, count: mine.length },
          quote: quote ? { text: clip(quote.body ?? '', 220), reviewer: reviewerLabel(quote.customer_name) } : null,
        }
      })

    // random reviews from customers (4 and 5 stars; a promotional feed does not lead with a complaint)
    const randomReviews = shuffle(reviews.filter((r) => (r.body ?? '').trim().length > 30 && byUser.has(r.painter_id)))
      .slice(0, REVIEWS_RETURNED)
      .map((r) => {
        const p = byUser.get(r.painter_id)!
        return {
          id: r.id,
          rating: r.rating,
          title: r.title,
          text: clip(r.body ?? '', 360),
          reviewer: reviewerLabel(r.customer_name),
          painter: { id: p.id, companyName: p.company_name, city: p.city, state: p.state },
        }
      })

    // ---- articles ----
    // (the newest painting articles are on top; the date itself is never sent)
    const picked = pickArticles(await articles(), ARTICLES_RETURNED)
    const withImages = (await withPictures(picked)).map(({ published: _published, ...rest }) => rest)

    return json({ articles: withImages, painters: featured, reviews: randomReviews })
  } catch (error) {
    console.error('Error in news-feed:', error)
    return json({ error: 'Could not load the feed' }, 500)
  }
})
