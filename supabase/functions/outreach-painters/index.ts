// supabase/functions/outreach-painters/index.ts
//
// Supabase Edge Function: invite local painting companies to take a job that has no painter yet.
//
// Called by submit-quote-claim (with the service role key) when a customer claims a price in a ZIP with no approved painter in range.
//   1. Finds painting companies near the job's ZIP with Google Places (needs GOOGLE_GEOCODING_API_KEY or GOOGLE_PLACES_API_KEY, with Places API (New) enabled).
//   2. Reads each company's own public website (home page and contact page) for a business email address.
//   3. Emails each one an invitation with the job details (no customer name, address or contact details; only the ZIP) and a button
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
// Limit: at most MAX_INVITES_PER_JOB companies per job, and no limit on how many jobs (or invitations) there are per day. A company is
// never invited twice for the same job, and anyone who unsubscribed is never emailed again.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { describeTiming } from '../_shared/offers.ts'
import { ADMIN_EMAIL } from '../_shared/adminLink.ts'
import { isServiceCaller } from '../_shared/serviceCaller.ts'

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

interface Place { name: string; website: string; phone: string; address: string; email?: string }

/** Painting companies near a ZIP, from Google Places (the company's own listing: name, website, phone). */
async function findPaintingCompanies(zip: string, apiKey: string): Promise<Place[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.businessStatus',
    },
    body: JSON.stringify({ textQuery: `house painting contractor near ${zip}`, maxResultCount: 20, regionCode: 'US' }),
  })
  if (!res.ok) {
    console.error('Places search failed:', res.status, await res.text())
    return []
  }
  const data = await res.json() as { places?: { displayName?: { text?: string }; websiteUri?: string; nationalPhoneNumber?: string; formattedAddress?: string; businessStatus?: string }[] }
  return (data.places ?? [])
    .filter((p) => p.websiteUri && (!p.businessStatus || p.businessStatus === 'OPERATIONAL'))
    .map((p) => ({ name: p.displayName?.text ?? '', website: p.websiteUri as string, phone: p.nationalPhoneNumber ?? '', address: p.formattedAddress ?? '' }))
    .filter((p) => p.name)
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
    const body = await req.json() as { jobId?: string; testPlaces?: Place[] }
    const testPlaces = Array.isArray(body.testPlaces) ? body.testPlaces : null
    if (!placesKey && !testPlaces) return json({ ok: false, reason: 'GOOGLE_GEOCODING_API_KEY (or GOOGLE_PLACES_API_KEY) is not set: no painters were looked up' })
    if (!postalAddress) return json({ ok: false, reason: 'OUTREACH_POSTAL_ADDRESS is not set: commercial email must carry a postal address, so nothing was sent' })

    const jobId = body.jobId
    if (!jobId) return json({ error: 'Missing jobId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, customer_email, quote_zip, painter_payout_amount, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, project_summary')
      .eq('id', jobId)
      .maybeSingle()
    if (!job || job.status !== 'searching_painter' || !job.quote_zip) return json({ ok: false, reason: 'Job is not waiting for a painter' })
    // a made-up customer (demonstration or test, ".invalid" address) never triggers a real search; tests pass testPlaces instead
    if (!testPlaces && /@[^@]*\.invalid$/i.test(String(job.customer_email ?? ''))) return json({ ok: false, reason: 'Demonstration job: no real companies were contacted' })


    const places = testPlaces ?? await findPaintingCompanies(job.quote_zip, placesKey as string)

    // companies already on the platform, or who asked not to be contacted, are never invited
    const { data: members } = await supabase.from('painters').select('email')
    const memberEmails = new Set((members ?? []).map((m: { email: string }) => String(m.email).toLowerCase()))
    const { data: optouts } = await supabase.from('outreach_optouts').select('email')
    const optedOut = new Set((optouts ?? []).map((o: { email: string }) => String(o.email).toLowerCase()))

    const summary = (job.project_summary ?? {}) as { qa?: { question: string; answer: string }[]; breakdown?: { description: string; amount: number; removed?: boolean }[]; timelineLabel?: string }
    const invited: string[] = []

    for (const place of places) {
      if (invited.length >= MAX_INVITES_PER_JOB) break
      const email = place.email ?? await findEmail(place.website)
      if (!email || memberEmails.has(email) || optedOut.has(email)) continue
      const { data: lead, error: leadError } = await supabase
        .from('outreach_leads')
        .insert({ job_id: job.id, company_name: place.name, email, website: place.website, phone: place.phone, zip: job.quote_zip })
        .select('invite_token')
        .single()
      if (leadError || !lead) continue // already invited for this job

      const inviteUrl = `${frontendUrl}/painter-signup?invite=${lead.invite_token}&email=${encodeURIComponent(email)}&company=${encodeURIComponent(place.name)}`
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/outreach-unsubscribe?token=${lead.invite_token}`
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          type: 'cold_job_invite',
          data: {
            subject: `A free painting job near ${job.quote_zip}: $${Math.round(Number(job.painter_payout_amount) || 0).toLocaleString('en-US')} payout, yours to claim`,
            companyName: place.name,
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
      if (res && res.ok) {
        invited.push(place.name)
      } else {
        await supabase.from('outreach_leads').delete().eq('invite_token', lead.invite_token) // not sent: try again another time
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

    return json({ ok: true, found: places.length, invited: invited.length })
  } catch (error) {
    console.error('outreach-painters failed:', error)
    return json({ error: 'failed' }, 500)
  }
})
