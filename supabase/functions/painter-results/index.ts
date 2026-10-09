// supabase/functions/painter-results/index.ts
//
// Supabase Edge Function: the painters shown to a customer for their project
//
// Replaces the browser reading the painters table directly (which exposed every
// painter's email, phone, license/policy numbers and pricing answers to anyone).
// Everything sensitive stays on the server. This returns ONLY what a customer
// browsing results should see — a hotel-listing style card:
//   company name, city, how far, price, rating on The Painted Painter, ratings the
//   painter reports from Google/Yelp/Facebook (with links), portfolio photos,
//   and "available from <date>" for painters who are booked until later.
// Painters who are paused, or booked through the customer's dates, are left out
// (see _shared/availability.ts). Each price comes back signed and with an expiry,
// and a claim is only accepted for a price we signed (see submit-quote-claim).
// Fuller detail (credentials, crew, reviews…) comes from painter-detail on demand.
//
// POST { ctx: <estimator context incl. timing, and preferredPainterId for "Work with again">, baseTotal: number, resumeToken?: string }
//   resumeToken: from a "your painter declined" email — reloads the same search with
//   the declined painter removed, and the hold lasts until that email's 72 hours end.
//
// Deploy:
//   supabase functions deploy painter-results --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { rankPainters } from '../_shared/painterRanking.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

    const { ctx, baseTotal, resumeToken } = await req.json() as { ctx?: Record<string, unknown>; baseTotal?: number; resumeToken?: string }
    const zip = String(ctx?.zipCode ?? '')
    if (!ctx || !/^\d{5}$/.test(zip)) return json({ error: 'A 5-digit ZIP code is required' }, 400)
    if (typeof baseTotal !== 'number' || !isFinite(baseTotal) || baseTotal < 100 || baseTotal > 250000) return json({ error: 'Invalid price' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    let exclude: string[] = []
    let holdUntilMs: number | undefined
    if (resumeToken) {
      const { data: job } = await supabase
        .from('quote_selections')
        .select('declined_painters, fallback_expires_at, status')
        .eq('fallback_token', resumeToken)
        .maybeSingle()
      if (!job || !job.fallback_expires_at || new Date(job.fallback_expires_at).getTime() < Date.now() || job.status !== 'needs_new_painter') {
        return json({ error: 'This link has expired. Please start a new search.' }, 410)
      }
      exclude = job.declined_painters ?? []
      holdUntilMs = new Date(job.fallback_expires_at).getTime()
    }

    // "Work with again": only honored when the signed-in caller really finished a job with that painter.
    let preferredId: string | undefined
    const wantedId = typeof ctx.preferredPainterId === 'string' ? ctx.preferredPainterId : ''
    const authHeader = req.headers.get('Authorization')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (wantedId && authHeader && anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: userData } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
      const user = userData?.user
      if (user) {
        const orFilter = user.email ? `customer_id.eq.${user.id},customer_email.eq.${user.email}` : `customer_id.eq.${user.id}`
        const { data: past } = await supabase
          .from('quote_selections')
          .select('id')
          .eq('accepted_by', wantedId)
          .eq('status', 'completed')
          .or(orFilter)
          .limit(1)
        if (past && past.length > 0) preferredId = wantedId
      }
    }

    const result = await rankPainters(supabase, supabaseUrl, ctx, baseTotal, { exclude, holdUntilMs, preferredId })
    return json({
      painters: result.painters,
      mystery: result.mystery,
      holdUntil: result.holdUntil,
      duration: result.duration,
      preferred: result.preferred,
    })
  } catch (error) {
    console.error('Error in painter-results:', error)
    return json({ error: 'Could not load painters' }, 500)
  }
})
