// supabase/functions/decline-job/index.ts
//
// Supabase Edge Function: a painter declines a job offer
//
// POST { token, painterId, reason? }   (token = the offer's claim_token)
//
// Until now a painter could only accept or ignore an offer. A decline:
//   * records the painter as having declined (they can no longer accept it);
//   * for a specific-painter job, or once EVERY painter offered a Mystery job has
//     declined, moves the job to 'needs_new_painter' and emails the customer: the
//     painter can't take it, here are the next 3 matches you can pick from right in
//     the email, a link back to your search results, and a way to cancel. The links
//     and suggestions all expire 72 hours later (the daily job closes them out);
//   * for a Mystery job with painters still deciding, just records it.
// The old offer links die (the claim token is rotated) so a declined offer can't be
// accepted by someone holding the email.
//
// Deploy:
//   supabase functions deploy decline-job --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { rankPainters } from '../_shared/painterRanking.ts'
import { notify } from '../_shared/notify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FALLBACK_HOURS = 72
const SUGGESTION_COUNT = 3

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

    const { token, painterId } = await req.json() as { token?: string; painterId?: string }
    if (!token || !painterId) return json({ error: 'Missing token or painterId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, selection_type, selected_painter_id, notified_painters, declined_painters, customer_id, customer_name, customer_email, quote_zip, guaranteed_price, resume_state')
      .eq('claim_token', token)
      .maybeSingle()
    if (!job) return json({ error: 'This offer link is invalid or has expired.' }, 404)

    const eligible = job.selection_type === 'specific_painter'
      ? job.selected_painter_id === painterId
      : (job.notified_painters ?? []).includes(painterId)
    if (!eligible) return json({ error: 'This offer was not sent to this painter account.' }, 403)
    if (job.status !== 'offer_sent') return json({ error: 'This job is no longer open.' }, 409)
    if ((job.declined_painters ?? []).includes(painterId)) return json({ success: true, alreadyDeclined: true })

    const declined: string[] = [...(job.declined_painters ?? []), painterId]
    const offered: string[] = job.selection_type === 'specific_painter' ? [job.selected_painter_id] : (job.notified_painters ?? [])
    const everyoneDeclined = offered.every((id) => declined.includes(id))

    if (!everyoneDeclined) {
      // Mystery job, other painters still deciding: just record this one.
      await supabase.from('quote_selections').update({ declined_painters: declined }).eq('id', job.id)
      return json({ success: true, waitingOnOthers: true })
    }

    // ---- Everyone offered this job has said no: find the customer's next best painters ----
    const state = (job.resume_state ?? {}) as { ctx?: Record<string, unknown>; estimate?: { total?: number } }
    const baseTotal = Number(state.estimate?.total)
    const expiresAt = new Date(Date.now() + FALLBACK_HOURS * 3600 * 1000)

    let suggestions: Record<string, unknown>[] = []
    if (state.ctx && isFinite(baseTotal) && baseTotal > 0) {
      const ranked = await rankPainters(supabase, supabaseUrl, state.ctx, baseTotal, {
        exclude: [...declined, ...offered],
        holdUntilMs: expiresAt.getTime(),
        limit: SUGGESTION_COUNT,
      })
      suggestions = ranked.painters.map((p) => ({
        painterId: p.id,
        companyName: p.companyName,
        city: p.city,
        state: p.state,
        distanceMiles: p.distanceMiles,
        price: p.price,
        rating: p.rating,
        photo: p.photos[0] ?? null,
        availableFrom: p.availableFrom,
      }))
    }

    const fallbackToken = crypto.randomUUID()
    const { error: updateError } = await supabase
      .from('quote_selections')
      .update({
        status: 'needs_new_painter',
        declined_painters: declined,
        fallback_token: fallbackToken,
        fallback_expires_at: expiresAt.toISOString(),
        fallback_suggestions: suggestions,
        claim_token: crypto.randomUUID(), // the old offer links stop working
      })
      .eq('id', job.id)
      .eq('status', 'offer_sent')
    if (updateError) throw updateError

    // Who declined, for the email wording.
    let declinedName: string | null = null
    if (job.selection_type === 'specific_painter') {
      const { data: p } = await supabase.from('painters').select('company_name').eq('id', painterId).maybeSingle()
      declinedName = p?.company_name ?? null
    }

    const base = `${frontendUrl}`
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: job.customer_email,
        type: 'painter_declined_suggestions',
        data: {
          customerName: String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'there',
          declinedName,
          mystery: job.selection_type !== 'specific_painter',
          expiresAt: expiresAt.toISOString(),
          suggestions: suggestions.map((s) => ({ ...s, chooseUrl: `${base}/choose-painter?token=${fallbackToken}&painter=${s.painterId}` })),
          resumeUrl: `${base}/resume-search?token=${fallbackToken}`,
          cancelUrl: `${base}/cancel-request?token=${fallbackToken}`,
        },
      }),
    }).catch((err) => console.error('declined email failed:', err))

    await notify(supabase, {
      userId: job.customer_id,
      type: 'painter_declined',
      title: declinedName ? `${declinedName} can't take your job` : 'We need to find you another painter',
      body: 'Pick one of your next best matches within 72 hours.',
      link: '/customer/projects',
    })

    return json({ success: true, customerNotified: true, suggestions: suggestions.length })
  } catch (error) {
    console.error('Error in decline-job:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
