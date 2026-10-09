// supabase/functions/get-my-projects/index.ts
//
// Supabase Edge Function: confirmed projects for the logged-in customer
//
// Backs the customer dashboard's "My Projects" page. Deployed WITH JWT
// verification on (no --no-verify-jwt flag) — the Supabase gateway rejects
// unauthenticated requests before this code even runs, and inside we read
// the caller's identity from that same verified JWT.
//
// quote_selections has no public SELECT policy at all (by design — see the
// other job-claim functions), so this uses the service role to read it,
// after confirming which rows belong to the calling user: matched by
// customer_id when the claim was made while logged in, falling back to
// customer_email for guest claims made before they had an account.
//
// Deploy:
//   supabase functions deploy get-my-projects

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the caller's JWT and get their identity (anon-key client, not
    // service role — this is the standard way to resolve "who is calling"
    // from a bearer token).
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { id: userId, email: userEmail } = userData.user

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const orFilter = userEmail
      ? `customer_id.eq.${userId},customer_email.eq.${userEmail}`
      : `customer_id.eq.${userId}`

    const { data: rows, error } = await supabase
      .from('quote_selections')
      .select(`
        id, status, guaranteed_price, selected_painter_price, quote_zip,
        customer_street_address, customer_city, customer_state,
        scheduled_date, customer_preferred_date, phase_label, parent_quote_id,
        confirmed_at, completed_at, review_token, review_submitted_at, accepted_by,
        customer_confirm_token, offer_sent_at, accepted_at,
        scheduled_end_date, date_state, painter_availability, customer_counter, estimated_days,
        fallback_token, fallback_expires_at, fallback_suggestions
      `)
      .or(orFilter)
      .in('status', ['offer_sent', 'painter_accepted', 'confirmed', 'completed', 'needs_new_painter'])
      .order('scheduled_date', { ascending: true, nullsFirst: false })

    if (error) throw error

    const painterIds = Array.from(new Set((rows ?? []).map((r) => r.accepted_by).filter(Boolean)))
    const paintersById: Record<string, { company_name: string; owner_name: string; email: string; phone: string }> = {}
    if (painterIds.length > 0) {
      const { data: painters } = await supabase
        .from('painters')
        .select('id, company_name, owner_name, email, phone')
        .in('id', painterIds)
      for (const p of painters ?? []) {
        paintersById[p.id] = { company_name: p.company_name, owner_name: p.owner_name, email: p.email, phone: p.phone }
      }
    }

    const projects = (rows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      price: r.guaranteed_price ?? r.selected_painter_price,
      // for "Work with again" on a finished job: which painter, and the ZIP of that job
      painterId: r.status === 'completed' ? r.accepted_by : null,
      zip: r.quote_zip,
      address: [r.customer_street_address, r.customer_city, r.customer_state].filter(Boolean).join(', ') || r.quote_zip,
      scheduledDate: r.scheduled_date,
      preferredDate: r.customer_preferred_date,
      phaseLabel: r.phase_label,
      parentQuoteId: r.parent_quote_id,
      offerSentAt: r.offer_sent_at,
      acceptedAt: r.accepted_at,
      confirmedAt: r.confirmed_at,
      completedAt: r.completed_at,
      reviewToken: r.status === 'completed' && !r.review_submitted_at ? r.review_token : null,
      reviewSubmitted: !!r.review_submitted_at,
      // The customer owns this row (matched by their account), so it's safe to hand them
      // their own pay-deposit link here; only offered once a painter has set a date.
      confirmUrl: r.status === 'painter_accepted' && ['painter_offered', 'agreed', 'customer_countered'].includes(r.date_state)
        ? `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/confirm-job?token=${r.customer_confirm_token}`
        : null,
      // Painter contact details (email, phone, owner) only once the deposit is paid; before that, just the company name.
      painter: r.accepted_by
        ? (() => {
            const p = paintersById[r.accepted_by]
            if (!p) return null
            return r.status === 'confirmed' || r.status === 'completed' ? p : { company_name: p.company_name }
          })()
        : null,
      scheduledEndDate: r.scheduled_end_date,
      dateState: r.date_state,
      availability: r.painter_availability,
      counter: r.customer_counter,
      estimatedDays: r.estimated_days,
      // After a decline: pick another painter within 72 hours (link dies when it expires).
      needsNewPainter: r.status === 'needs_new_painter' && !!r.fallback_expires_at && new Date(r.fallback_expires_at).getTime() > Date.now()
        ? { expiresAt: r.fallback_expires_at, resumeUrl: `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/resume-search?token=${r.fallback_token}` }
        : null,
    }))

    return new Response(JSON.stringify({ projects }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching my projects:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
