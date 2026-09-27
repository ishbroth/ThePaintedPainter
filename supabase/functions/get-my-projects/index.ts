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
    const { data: userData, error: userError } = await authClient.auth.getUser()
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
        confirmed_at, accepted_by
      `)
      .or(orFilter)
      .in('status', ['confirmed', 'painter_accepted'])
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
      address: [r.customer_street_address, r.customer_city, r.customer_state].filter(Boolean).join(', ') || r.quote_zip,
      scheduledDate: r.scheduled_date,
      preferredDate: r.customer_preferred_date,
      phaseLabel: r.phase_label,
      parentQuoteId: r.parent_quote_id,
      confirmedAt: r.confirmed_at,
      painter: r.accepted_by ? paintersById[r.accepted_by] ?? null : null,
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
