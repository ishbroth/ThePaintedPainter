// supabase/functions/choose-painter/index.ts
//
// Supabase Edge Function: the customer picks one of the "next best" painters
// from the email sent after a painter declined.
//
// GET-style preview and POST-style action, both POST so link scanners can't act:
//   POST { token, painterId, preview: true }  -> what the confirm page shows
//   POST { token, painterId }                 -> sends that painter a fresh offer
//
// The token is the 72-hour fallback_token. Only painters from the stored
// suggestions can be chosen, at the price we quoted in the email, and only if they're
// still approved and available. The job returns to 'offer_sent' for the new painter
// with fresh offer links (the claim token is rotated again).
//
// Deploy:
//   supabase functions deploy choose-painter --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { evaluateAvailability } from '../_shared/availability.ts'
import { timingFromCtx } from '../_shared/painterRanking.ts'
import { estimateWorkingDays } from '../_shared/duration.ts'
import { sendPainterOffer } from '../_shared/offers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const COMMISSION_RATE = 0.10

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
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    const { token, painterId, preview } = await req.json() as { token?: string; painterId?: string; preview?: boolean }
    if (!token || !painterId) return json({ error: 'Missing token or painterId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, customer_id, customer_name, customer_email, quote_zip, fallback_expires_at, fallback_suggestions, resume_state, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, project_summary, photos, declined_painters')
      .eq('fallback_token', token)
      .maybeSingle()

    if (!job || job.status !== 'needs_new_painter') return json({ error: 'This link is no longer active.' }, 404)
    if (!job.fallback_expires_at || new Date(job.fallback_expires_at).getTime() < Date.now()) {
      return json({ error: 'This link has expired (they last 72 hours). You can start a new search any time.' }, 410)
    }

    const suggestion = ((job.fallback_suggestions ?? []) as { painterId: string; companyName: string; city: string; state: string; price: number }[])
      .find((s) => s.painterId === painterId)
    if (!suggestion) return json({ error: 'That painter isn\'t one of your suggestions.' }, 404)

    if (preview) {
      return json({ companyName: suggestion.companyName, city: suggestion.city, state: suggestion.state, price: suggestion.price, expiresAt: job.fallback_expires_at })
    }

    // Still approved, not paused, and free for the customer's dates?
    const { data: painter } = await supabase
      .from('painters')
      .select('id, user_id, email, status, verified, leads_paused, paused_until, blackout_dates')
      .eq('id', painterId)
      .maybeSingle()
    const state = (job.resume_state ?? {}) as { ctx?: Record<string, unknown> }
    const timing = {
      ...timingFromCtx(state.ctx ?? {}),
      startDate: job.customer_start_date,
      endDate: job.customer_end_date,
      flexible: !!job.dates_flexible,
      timeline: job.timeline,
    }
    const days = estimateWorkingDays(suggestion.price)
    if (!painter || painter.status !== 'approved' || !painter.verified || !evaluateAvailability(painter, timing, days).show) {
      return json({ error: `${suggestion.companyName} isn't available any more. Please pick another painter or reload your search.` }, 409)
    }

    const payout = Math.round(suggestion.price * (1 - COMMISSION_RATE) * 100) / 100
    const deposit = Math.round(suggestion.price * 0.10 * 100) / 100
    const claimToken = crypto.randomUUID()

    const { data: updated, error } = await supabase
      .from('quote_selections')
      .update({
        status: 'offer_sent',
        selection_type: 'specific_painter',
        selected_painter_id: painterId,
        selected_painter_price: suggestion.price,
        notified_painters: [painterId],
        guaranteed_price: suggestion.price,
        painter_payout_amount: payout,
        deposit_amount: deposit,
        estimated_days: days,
        offer_sent_at: new Date().toISOString(),
        claim_token: claimToken,
        accepted_by: null,
        accepted_at: null,
        date_state: 'awaiting_painter_dates',
        painter_availability: null,
        // The suggestions are used up; the search link dies with them.
        fallback_token: null,
        fallback_expires_at: null,
        fallback_suggestions: null,
      })
      .eq('id', job.id)
      .eq('status', 'needs_new_painter')
      .select('id, claim_token, quote_zip, customer_name, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, estimated_days, painter_payout_amount, project_summary, photos')
      .maybeSingle()
    if (error) throw error
    if (!updated) return json({ error: 'This request was already updated.' }, 409)

    await sendPainterOffer(supabase, { supabaseUrl, serviceRoleKey }, updated, { id: painter.id, email: painter.email, user_id: painter.user_id })

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: job.customer_email,
        type: 'claim_received',
        data: {
          customerName: String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'there',
          guaranteedPrice: suggestion.price,
          depositAmount: deposit,
          painterName: suggestion.companyName,
          projectsUrl: job.customer_id ? `${frontendUrl}/customer/dashboard/projects` : null,
        },
      }),
    }).catch((err) => console.error('confirmation email failed:', err))

    return json({ success: true, companyName: suggestion.companyName })
  } catch (error) {
    console.error('Error in choose-painter:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
