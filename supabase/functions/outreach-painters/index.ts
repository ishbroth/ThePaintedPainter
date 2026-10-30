// supabase/functions/outreach-painters/index.ts
//
// Supabase Edge Function: invite local painting companies to take a job that has no painter yet.
//
// Called with the service role key by submit-quote-claim (a customer claims a price in a ZIP with no approved painter in range) and by
// decline-job (every painter offered a Mystery Painter job has declined, so another round of invitations goes out).
//   1. Looks at the directory of companies found so far (outreach_companies). The ZIP is searched on Google (three wordings: established,
//      affordable, professional/quality) only when it has never been searched, the list is thin, or the last search is old; every company
//      found is kept (needs GOOGLE_GEOCODING_API_KEY or GOOGLE_PLACES_API_KEY, with Places API (New) enabled).
//   2. Picks who to invite by rotation (see _shared/outreachPlan.ts): up to 12 per job. Companies already invited who have not responded come
//      first (so 12 invited, 3 sign up, leaves 9 who are invited again plus 3 new ones), then companies never invited. A company that has had
//      3 invitations with no response (it neither signed up nor unsubscribed) is rotated out, but stays in the directory and comes back
//      round once the area has nobody else left. No waiting period between invitations.
//   3. Reads each company's own public website for a business email address (once; the result is kept).
//   4. Emails each one an invitation with the job details (no customer name, address or contact details; only the ZIP) and a button
//      to claim it. Claiming means signing up as a painter (free; the application is reviewed); once approved, the job is offered to
//      them automatically (see _shared/openJobs.ts).
//
// It follows the rules for commercial email (CAN-SPAM): honest sender and subject, the message says it is an invitation, a working
// one-click unsubscribe, the business's postal address in the footer, opted-out addresses never emailed again. It refuses to send
// at all until OUTREACH_POSTAL_ADDRESS is set.
//
// Setup (once):
//   1. In Google Cloud, enable "Places API (New)" and make an API key allowed to call it.
//   2. supabase secrets set GOOGLE_PLACES_API_KEY=<key> OUTREACH_POSTAL_ADDRESS="The Painted Painter, 123 Main St, City, ST 12345"
//   3. supabase functions deploy outreach-painters --no-verify-jwt
//      supabase functions deploy outreach-unsubscribe --no-verify-jwt
//
// Limit: at most MAX_INVITES_PER_JOB companies per job, and no limit on how many jobs there are per day. A company is never invited twice
// for the same job, and a company that unsubscribed, or signed up, is never invited again.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { describeTiming } from '../_shared/offers.ts'
import { ADMIN_EMAIL } from '../_shared/adminLink.ts'
import { isServiceCaller } from '../_shared/serviceCaller.ts'
import { getZipCoords, type Coords } from '../_shared/geo.ts'
import { orderCandidates, type Candidate, type Tier } from '../_shared/outreachPlan.ts'

const MAX_INVITES_PER_JOB = 12
const PAGE_TIMEOUT_MS = 6000
const MAX_PAGE_BYTES = 300_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

interface Place { name: string; website: string; phone: string; address: string; email?: string; lat?: number; lng?: number }

/**
 * Different wordings bring back different companies: the big established firms, the budget ones, the small quality-focused shops.
 * Each is its own Google search around the customer's ZIP, run at the same time.
 */
const SEARCH_WORDINGS = [
  (zip: string) => `house painting contractor near ${zip}`,
  (zip: string) => `affordable cheap house painters near ${zip}`,
  (zip: string) => `professional quality painting company near ${zip}`,
]

type GooglePlace = { displayName?: { text?: string }; websiteUri?: string; nationalPhoneNumber?: string; formattedAddress?: string; businessStatus?: string; location?: { latitude?: number; longitude?: number } }

async function searchOnce(textQuery: string, apiKey: string, center: Coords | null): Promise<GooglePlace[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.businessStatus,places.location',
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 20,
      regionCode: 'US',
      // keep every wording local to the customer: a circle of about 25 miles around their ZIP
      ...(center ? { locationBias: { circle: { center: { latitude: center[0], longitude: center[1] }, radius: 40000 } } } : {}),
    }),
  })
  if (!res.ok) {
    console.error('Places search failed:', res.status, await res.text())
    return []
  }
  const data = await res.json() as { places?: GooglePlace[] }
  return data.places ?? []
}

const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return url.toLowerCase() }
}
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const miles = (a: Coords, b: Coords) => {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

/**
 * Painting companies near a ZIP from several Google searches, with no company listed twice (same website or same name), nearest to the
 * customer first, so the invitations go to the closest companies in every direction rather than to whichever side Google favored.
 */
async function findPaintingCompanies(zip: string, apiKey: string, center: Coords | null): Promise<Place[]> {
  const results = await Promise.all(SEARCH_WORDINGS.map((w) => searchOnce(w(zip), apiKey, center).catch(() => [])))
  const seen = new Set<string>()
  const places: Place[] = []
  for (const list of results) {
    for (const p of list) {
      if (!p.websiteUri || (p.businessStatus && p.businessStatus !== 'OPERATIONAL')) continue
      const name = p.displayName?.text ?? ''
      if (!name) continue
      const keys = [hostOf(p.websiteUri), nameKey(name)]
      if (keys.some((k) => seen.has(k))) continue
      keys.forEach((k) => seen.add(k))
      places.push({ name, website: p.websiteUri, phone: p.nationalPhoneNumber ?? '', address: p.formattedAddress ?? '', lat: p.location?.latitude, lng: p.location?.longitude })
    }
  }
  if (center) {
    const away = (p: Place) => (typeof p.lat === 'number' && typeof p.lng === 'number' ? miles(center, [p.lat, p.lng]) : Infinity)
    places.sort((x, y) => away(x) - away(y))
  }
  return places
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ThePaintedPainterBot/1.0 (+https://thepaintedpainter.com; business contact lookup)', 'Accept': 'text/html' },
    })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return ''
    const text = await res.text()
    return text.slice(0, MAX_PAGE_BYTES)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi
const JUNK_LOCAL = /^(?:noreply|no-reply|donotreply|do-not-reply|webmaster|postmaster|abuse|privacy|legal|support@wix|sentry|bounce|mailer-daemon|example)/i
const JUNK_DOMAIN = /(?:example\.|sentry\.|wixpress\.|wix\.com|squarespace\.|godaddy\.|domain\.com|yourdomain|email\.com$|\.png$|\.jpe?g$|\.gif$|\.webp$|\.svg$)/i
const GOOD_LOCAL = /^(?:info|contact|office|hello|estimates?|sales|service|quotes?|admin|painting|jobs)/i

/** The best business email on a company's own site: one on the site's own domain, preferring info@, contact@, office@, estimates@. */
function bestEmail(html: string, siteHost: string): string | null {
  const found = new Set<string>()
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase())
  for (const m of html.matchAll(EMAIL_RE)) found.add(m[0].toLowerCase())
  const root = siteHost.replace(/^www\./, '')
  const candidates = [...found].filter((e) => {
    const [local, domain] = e.split('@')
    return local && domain && !JUNK_LOCAL.test(local) && !JUNK_DOMAIN.test(e) && e.length < 80
  })
  if (candidates.length === 0) return null
  const score = (e: string) => {
    const [local, domain] = e.split('@')
    return (domain === root || domain.endsWith(`.${root}`) ? 10 : 0) + (GOOD_LOCAL.test(local) ? 3 : 0)
  }
  candidates.sort((a, b) => score(b) - score(a))
  // an address that is not on the company's own domain (and not a big mail provider) is probably someone else's: skip it
  const top = candidates[0]
  const topDomain = top.split('@')[1]
  const ownDomain = topDomain === root || topDomain.endsWith(`.${root}`)
  const mailProvider = /^(?:gmail|yahoo|outlook|hotmail|aol|icloud|msn|live|comcast|att|sbcglobal|cox|verizon)\./.test(topDomain)
  return ownDomain || mailProvider ? top : null
}

async function findEmail(website: string): Promise<string | null> {
  let base: URL
  try {
    base = new URL(website)
  } catch {
    return null
  }
  const paths = ['/', '/contact', '/contact-us', '/contact.html', '/about']
  for (const p of paths) {
    const html = await fetchPage(new URL(p, base).toString())
    if (!html) continue
    const email = bestEmail(html, base.hostname)
    if (email) return email
  }
  return null
}

// ---------------------------------------------------------------------------
// The directory of companies, and who to invite from it
// ---------------------------------------------------------------------------
const SEARCH_RADIUS_MILES = 30
/** Search Google again when the ZIP was never searched, or its stored list is shorter than this and the last search is a week old. */
const THIN_LIST = MAX_INVITES_PER_JOB * 2
const SEARCH_MAX_AGE_DAYS = 60
const THIN_RESEARCH_DAYS = 7
const EMAIL_RECHECK_DAYS = 60
const MAX_SITE_READS_PER_JOB = 25

// deno-lint-ignore no-explicit-any
type Supabase = any

interface Company {
  id: string; site_key: string; name: string; website: string | null; phone: string | null; address: string | null
  latitude: number | null; longitude: number | null; email: string | null; email_checked_at: string | null
  invite_count: number; last_invited_at: string | null; signed_up: boolean; opted_out: boolean
}

const siteKey = (url: string) => {
  try {
    const u = new URL(url)
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** Stored companies within SEARCH_RADIUS_MILES of the customer, with their distance. */
async function companiesNear(supabase: Supabase, center: Coords): Promise<(Company & { distance: number })[]> {
  const dLat = SEARCH_RADIUS_MILES / 69
  const dLng = SEARCH_RADIUS_MILES / (69 * Math.max(0.2, Math.cos((center[0] * Math.PI) / 180)))
  const { data } = await supabase
    .from('outreach_companies')
    .select('*')
    .gte('latitude', center[0] - dLat).lte('latitude', center[0] + dLat)
    .gte('longitude', center[1] - dLng).lte('longitude', center[1] + dLng)
  return ((data ?? []) as Company[])
    .map((c) => ({ ...c, distance: c.latitude != null && c.longitude != null ? miles(center, [c.latitude, c.longitude]) : Infinity }))
    .filter((c) => c.distance <= SEARCH_RADIUS_MILES)
}

/** Makes sure the directory is good enough for this ZIP, searching Google (and keeping what it finds) only when it has to. */
async function refreshDirectory(supabase: Supabase, zip: string, center: Coords, apiKey: string): Promise<void> {
  const { data: log } = await supabase.from('outreach_searches').select('searched_at').eq('zip', zip).maybeSingle()
  const ageDays = log ? (Date.now() - new Date(log.searched_at).getTime()) / 86_400_000 : Infinity
  const known = (await companiesNear(supabase, center)).filter((c) => !c.opted_out && !c.signed_up)
  const needsSearch = ageDays > SEARCH_MAX_AGE_DAYS || (known.length < THIN_LIST && ageDays > THIN_RESEARCH_DAYS)
  if (!needsSearch) return

  const found = await findPaintingCompanies(zip, apiKey, center)
  if (found.length > 0) {
    // only what Google tells us is written; email, invitations and flags already on a company are left alone
    await supabase.from('outreach_companies').upsert(
      found.map((p) => ({ site_key: siteKey(p.website), name: p.name, website: p.website, phone: p.phone, address: p.address, latitude: p.lat ?? null, longitude: p.lng ?? null, last_found_at: new Date().toISOString() })),
      { onConflict: 'site_key' },
    )
  }
  await supabase.from('outreach_searches').upsert({ zip, searched_at: new Date().toISOString(), found: found.length }, { onConflict: 'zip' })
}

/** The rotation for this ZIP: who would be invited, in order. */
async function planFor(supabase: Supabase, zip: string, center: Coords, apiKey: string) {
  await refreshDirectory(supabase, zip, center, apiKey)
  const all = (await companiesNear(supabase, center)).filter((c) => !c.opted_out && !c.signed_up)
  const byId = new Map(all.map((c) => [c.id, c]))
  const ordered = orderCandidates(all.map((c): Candidate => ({ id: c.id, inviteCount: c.invite_count, lastInvitedAt: c.last_invited_at, distance: c.distance })))
  return ordered.map((o) => ({ company: byId.get(o.id) as Company & { distance: number }, tier: o.tier as Tier }))
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Not configured' }, 500)
    // Only our own server may call this
    if (!(await isServiceCaller(req, supabaseUrl, serviceRoleKey))) return json({ error: 'Forbidden' }, 403)

    // the unrestricted server key first (the other one may be locked to website referrers for the map)
    const placesKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY') ?? Deno.env.get('GOOGLE_PLACES_API_KEY')
    const postalAddress = Deno.env.get('OUTREACH_POSTAL_ADDRESS')
    // Service-role callers (tests) may pass `testPlaces` instead of searching Google: the companies and emails given are used as they are.
    const body = await req.json() as { jobId?: string; testPlaces?: Place[]; dryRunZip?: string }
    const testPlaces = Array.isArray(body.testPlaces) ? body.testPlaces : null
    if (!placesKey && !testPlaces) return json({ ok: false, reason: 'GOOGLE_GEOCODING_API_KEY (or GOOGLE_PLACES_API_KEY) is not set: no painters were looked up' })
    if (!postalAddress) return json({ ok: false, reason: 'OUTREACH_POSTAL_ADDRESS is not set: commercial email must carry a postal address, so nothing was sent' })

    // Dry run (service role only): the rotation for this ZIP, in the order companies would be invited, with each one's history. Refreshes
    // the directory from Google if it needs it, but sends nothing and contacts no one.
    if (body.dryRunZip && placesKey) {
      const zip = String(body.dryRunZip)
      const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const c = (await getZipCoords(sb, [zip])).get(zip) ?? null
      if (!c) return json({ ok: false, reason: 'Could not place that ZIP' })
      const plan = await planFor(sb, zip, c, placesKey)
      return json({
        ok: true, dryRun: true, count: plan.length,
        companies: plan.slice(0, 40).map(({ company, tier }) => ({ name: company.name, tier, miles: Math.round(company.distance), invites: company.invite_count, lastInvited: company.last_invited_at, hasEmail: company.email ? true : company.email_checked_at ? false : null })),
      })
    }

    const jobId = body.jobId
    if (!jobId) return json({ error: 'Missing jobId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, customer_email, quote_zip, painter_payout_amount, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, project_summary')
      .eq('id', jobId)
      .maybeSingle()
    // waiting for a painter, or a Mystery Painter job whose painters have all declined (the customer is choosing; a newly approved painter can still take it)
    if (!job || !['searching_painter', 'needs_new_painter'].includes(job.status) || !job.quote_zip) return json({ ok: false, reason: 'Job is not waiting for a painter' })
    // a made-up customer (demonstration or test, ".invalid" address) never triggers a real search; tests pass testPlaces instead
    if (!testPlaces && /@[^@]*\.invalid$/i.test(String(job.customer_email ?? ''))) return json({ ok: false, reason: 'Demonstration job: no real companies were contacted' })


    const zip5 = String(job.quote_zip).slice(0, 5)
    const zipCoords = (await getZipCoords(supabase, [zip5])).get(zip5) ?? null

    // companies already on the platform, or who asked not to be contacted, are never invited
    const { data: members } = await supabase.from('painters').select('email, website')
    const memberEmails = new Set((members ?? []).map((m: { email: string }) => String(m.email).toLowerCase()))
    const memberSites = new Set((members ?? []).map((m: { website: string | null }) => (m.website ? siteKey(m.website) : '')).filter(Boolean))
    const { data: optouts } = await supabase.from('outreach_optouts').select('email')
    const optedOut = new Set((optouts ?? []).map((o: { email: string }) => String(o.email).toLowerCase()))

    const summary = (job.project_summary ?? {}) as { qa?: { question: string; answer: string }[]; breakdown?: { description: string; amount: number; removed?: boolean }[]; timelineLabel?: string }
    const invited: string[] = []
    let considered = 0
    const tiers: Record<string, number> = { in_progress: 0, fresh: 0, rotated_out: 0 }

    // One invitation: log it, send it, and report whether it went out.
    const invite = async (companyName: string, email: string, website: string | null, phone: string | null): Promise<boolean> => {
      const { data: lead, error: leadError } = await supabase
        .from('outreach_leads')
        .insert({ job_id: job.id, company_name: companyName, email, website, phone, zip: job.quote_zip })
        .select('invite_token')
        .single()
      if (leadError || !lead) return false // already invited for this job

      const inviteUrl = `${frontendUrl}/painter-signup?invite=${lead.invite_token}&email=${encodeURIComponent(email)}&company=${encodeURIComponent(companyName)}`
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/outreach-unsubscribe?token=${lead.invite_token}`
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          type: 'cold_job_invite',
          data: {
            subject: `A painting job near ${job.quote_zip}, already bid at $${Math.round(Number(job.painter_payout_amount) || 0).toLocaleString('en-US')} for you: confirm and schedule it`,
            companyName,
            zipCode: job.quote_zip,
            payoutAmount: job.painter_payout_amount,
            timelineLabel: summary.timelineLabel,
            datesText: describeTiming(job),
            qa: summary.qa ?? [],
            breakdown: summary.breakdown ?? [],
            inviteUrl,
            unsubscribeUrl,
            postalAddress,
          },
        }),
      }).catch(() => null)
      if (res && res.ok) return true
      await supabase.from('outreach_leads').delete().eq('invite_token', lead.invite_token) // not sent: try again another time
      return false
    }

    let found = 0
    if (testPlaces) {
      // tests supply their own companies and emails: no directory, no rotation
      found = testPlaces.length
      for (const place of testPlaces) {
        if (invited.length >= MAX_INVITES_PER_JOB) break
        const email = String(place.email ?? '').toLowerCase()
        if (!email || memberEmails.has(email) || optedOut.has(email)) continue
        if (await invite(place.name, email, place.website, place.phone)) invited.push(place.name)
      }
    } else {
      if (!zipCoords) return json({ ok: false, reason: 'Could not place the job ZIP' })
      const plan = await planFor(supabase, zip5, zipCoords, placesKey as string)
      found = plan.length
      let siteReads = 0
      for (const { company, tier } of plan) {
        if (invited.length >= MAX_INVITES_PER_JOB) break
        considered++
        if (company.website && memberSites.has(siteKey(company.website))) {
          await supabase.from('outreach_companies').update({ signed_up: true }).eq('id', company.id)
          continue
        }
        // the business email: read once from their own site and kept (looked at again only after a couple of months)
        let email = company.email ? company.email.toLowerCase() : null
        const stale = !company.email_checked_at || (Date.now() - new Date(company.email_checked_at).getTime()) / 86_400_000 > EMAIL_RECHECK_DAYS
        if (!email && stale && company.website && siteReads < MAX_SITE_READS_PER_JOB) {
          siteReads++
          email = (await findEmail(company.website))?.toLowerCase() ?? null
          await supabase.from('outreach_companies').update({ email, email_checked_at: new Date().toISOString() }).eq('id', company.id)
        }
        if (!email) continue
        if (memberEmails.has(email)) {
          await supabase.from('outreach_companies').update({ signed_up: true }).eq('id', company.id)
          continue
        }
        if (optedOut.has(email)) {
          await supabase.from('outreach_companies').update({ opted_out: true }).eq('id', company.id)
          continue
        }
        if (await invite(company.name, email, company.website, company.phone)) {
          invited.push(company.name)
          tiers[tier]++
          await supabase.from('outreach_companies').update({ invite_count: company.invite_count + 1, last_invited_at: new Date().toISOString() }).eq('id', company.id)
        }
      }
    }

    // tell the owner who was invited (names only), so they know what is going on (not for test runs)
    if (!testPlaces) await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: ADMIN_EMAIL(),
        type: 'new_notification',
        data: {
          title: `Invited ${invited.length} local painting compan${invited.length === 1 ? 'y' : 'ies'} for the ${job.quote_zip} job`,
          body: invited.length > 0 ? `Invited: ${invited.join(', ')}.` : 'No company with a findable business email was found near that ZIP.',
          link: frontendUrl,
        },
      }),
    }).catch(() => null)

    return json({ ok: true, found, considered, invited: invited.length, ...(testPlaces ? {} : { fromTier: tiers }) })
  } catch (error) {
    console.error('outreach-painters failed:', error)
    return json({ error: 'failed' }, 500)
  }
})
