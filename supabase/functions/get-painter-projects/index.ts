// supabase/functions/get-painter-projects/index.ts
//
// Supabase Edge Function: the painter-side "My Projects" dashboard
//
// Backs the painter dashboard's "My Projects" page — the painter-side
// mirror of get-my-projects. Deployed WITH JWT verification on; the
// calling painter is resolved from their verified JWT, then matched to
// their `painters` row via user_id.
//
// Returns everything the page needs in one call:
//   - offers:    incoming job offers not yet accepted by anyone
//   - confirmed: accepted jobs with a paid deposit, awaiting completion
//   - completed: jobs this painter has marked done
//   - totalEarnings: sum of payouts across completed jobs
//   - rating: { avgRating, reviewCount } from the reviews table
//
// Deploy:
//   supabase functions deploy get-painter-projects

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { describeTiming } from '../_shared/offers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const JOB_COLUMNS = `
  id, status, quote_zip, guaranteed_price, selected_painter_price, painter_payout_amount,
  customer_name, customer_email, customer_phone,
  customer_street_address, customer_city, customer_state,
  scheduled_date, customer_preferred_date, phase_label, parent_quote_id,
  completed_at, confirmed_at, accepted_at, offer_sent_at, project_summary, photos, claim_token,
  scheduled_end_date, date_state, painter_availability, customer_counter, estimated_days,
  customer_start_date, customer_end_date, dates_flexible, timeline
`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return jsonError('Method not allowed', 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Missing Authorization header', 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonError('Not authenticated', 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: painter, error: painterError } = await supabase
      .from('painters')
      .select('id, company_name, status, verified')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (painterError || !painter) return jsonError('No painter profile found for this account', 403)

    const [offersRes, acceptedRes, ratingRes] = await Promise.all([
      supabase
        .from('quote_selections')
        .select(JOB_COLUMNS)
        .eq('status', 'offer_sent')
        .or(`selected_painter_id.eq.${painter.id},notified_painters.cs.{${painter.id}}`)
        .order('offer_sent_at', { ascending: false }),
      supabase
        .from('quote_selections')
        .select(JOB_COLUMNS)
        .eq('accepted_by', painter.id)
        .in('status', ['painter_accepted', 'confirmed', 'completed'])
        .order('scheduled_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('painter_ratings')
        .select('avg_rating, review_count')
        .eq('painter_id', painter.id)
        .maybeSingle(),
    ])

    if (offersRes.error) throw offersRes.error
    if (acceptedRes.error) throw acceptedRes.error

    const shapeOffer = (r: Record<string, unknown>) => ({
      id: r.id,
      zip: r.quote_zip,
      payoutAmount: r.painter_payout_amount,
      timelineLabel: (r.project_summary as { timelineLabel?: string } | null)?.timelineLabel ?? null,
      preferredDate: r.customer_preferred_date,
      customerTiming: describeTiming(r as never),
      estimatedDays: r.estimated_days,
      phaseLabel: r.phase_label,
      offerSentAt: r.offer_sent_at,
      photos: r.photos ?? [],
      // The painter is authenticated and already filtered to offers sent to them,
      // so they can accept straight from the dashboard.
      acceptUrl: `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/painter/accept-job?token=${r.claim_token}&painter_id=${painter.id}`,
    })

    // Customer contact details (and the full address) are released only once the deposit is paid. Until then the painter
    // sees first name and city/ZIP, enough to plan, not enough to go around the platform.
    const shapeJob = (r: Record<string, unknown>) => {
      const revealed = r.status === 'confirmed' || r.status === 'completed'
      const firstName = String(r.customer_name ?? '').trim().split(/\s+/)[0] || null
      return {
      id: r.id,
      status: r.status,
      price: r.guaranteed_price ?? r.selected_painter_price,
      payoutAmount: r.painter_payout_amount,
      customerName: revealed ? r.customer_name : firstName,
      customerEmail: revealed ? r.customer_email : null,
      customerPhone: revealed ? r.customer_phone : null,
      address: revealed
        ? ([r.customer_street_address, r.customer_city, r.customer_state].filter(Boolean).join(', ') || r.quote_zip)
        : ([r.customer_city, r.quote_zip].filter(Boolean).join(' ') || r.quote_zip),
      scheduledDate: r.scheduled_date,
      preferredDate: r.customer_preferred_date,
      phaseLabel: r.phase_label,
      parentQuoteId: r.parent_quote_id,
      completedAt: r.completed_at,
      confirmedAt: r.confirmed_at,
      acceptedAt: r.accepted_at,
      photos: r.photos ?? [],
      setDateUrl: r.status === 'painter_accepted'
        ? `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/painter/availability?token=${r.claim_token}&painter_id=${painter.id}`
        : null,
      scheduledEndDate: r.scheduled_end_date,
      dateState: r.date_state,
      estimatedDays: r.estimated_days,
      customerCounter: r.customer_counter,
      availability: r.painter_availability,
    };
    }

    const accepted = (acceptedRes.data ?? []).map(shapeJob)
    const confirmed = accepted.filter((j) => j.status === 'painter_accepted' || j.status === 'confirmed')
    const completed = accepted.filter((j) => j.status === 'completed')

    const totalEarnings = completed.reduce((sum, j) => sum + (Number(j.payoutAmount) || 0), 0)

    return new Response(
      JSON.stringify({
        companyName: painter.company_name,
        // Paused / unapproved painters see no new offers.
        offers: painter.status === 'approved' && painter.verified ? (offersRes.data ?? []).map(shapeOffer) : [],
        confirmed,
        completed,
        totalEarnings,
        rating: {
          avgRating: ratingRes.data?.avg_rating ?? 0,
          reviewCount: ratingRes.data?.review_count ?? 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error fetching painter projects:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonError(message, 500)
  }
})
