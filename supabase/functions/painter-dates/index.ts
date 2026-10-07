// supabase/functions/painter-dates/index.ts
//
// Supabase Edge Function: the painter's side of "when can you do it?"
//
// After a painter accepts a job they tell the customer when they're available, in
// one of two ways:
//   * exact dates     -> up to 3 windows ("I can do it Nov 3-7, or Nov 17-21")
//   * "my dates are flexible" -> around a date they choose, plus or minus 3/7/14/30 days
// The estimator's duration estimate (adjusted for THIS painter's crew size) is used
// to sanity-check what they offer: an exact window shorter than the job should take
// asks them to confirm it's realistic, and a flexible offer always asks them to confirm
// they can finish in about that many days.
// If the customer then suggests different dates, the painter accepts them here or
// offers new ones.
//
// Auth: the job's claim token + the accepting painter's id (the same credential as the
// accept link). No login.
//
// POST { token, painterId, action: 'get' }
// POST { token, painterId, action: 'offer', mode: 'exact', windows: [{start,end}], note?, confirmRealistic? }
// POST { token, painterId, action: 'offer', mode: 'flexible', around, flexDays, note?, confirmRealistic? }
// POST { token, painterId, action: 'accept_counter' }
//
// Deploy:
//   supabase functions deploy painter-dates --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { addDays, isIsoDate, todayIso, workingDaysBetween } from '../_shared/availability.ts'
import { estimateWorkingDays } from '../_shared/duration.ts'
import { describeTiming } from '../_shared/offers.ts'
import { notify } from '../_shared/notify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FLEX_OPTIONS = [3, 7, 14, 30]
const MAX_WINDOWS = 3
const MAX_DAYS_AHEAD = 365

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

    const body = await req.json() as Record<string, unknown>
    const token = String(body.token ?? '')
    const painterId = String(body.painterId ?? '')
    const action = String(body.action ?? 'get')
    if (!token || !painterId) return json({ error: 'Missing token or painterId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, accepted_by, customer_id, customer_name, customer_email, quote_zip, guaranteed_price, painter_payout_amount, estimated_days, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, painter_availability, date_state, customer_counter, customer_confirm_token, scheduled_date, scheduled_end_date, project_summary')
      .eq('claim_token', token)
      .maybeSingle()
    if (!job) return json({ error: 'This link is invalid or has expired.' }, 404)
    if (job.accepted_by !== painterId) return json({ error: 'This job was not accepted by this painter account.' }, 403)

    const { data: painter } = await supabase.from('painters').select('company_name, crew_size').eq('id', painterId).maybeSingle()
    const crew = painter?.crew_size ?? null
    const myDays = estimateWorkingDays(Number(job.guaranteed_price) || 0, crew)

    if (action === 'get') {
      return json({
        status: job.status,
        dateState: job.date_state,
        zip: job.quote_zip,
        payoutAmount: job.painter_payout_amount,
        estimatedDays: myDays,
        crewSize: crew,
        customerTiming: describeTiming(job),
        customerDates: { start: job.customer_start_date, end: job.customer_end_date, flexible: !!job.dates_flexible, preferred: job.customer_preferred_date },
        availability: job.painter_availability,
        counter: job.customer_counter,
        scheduled: job.scheduled_date ? { start: job.scheduled_date, end: job.scheduled_end_date } : null,
      })
    }

    if (job.status !== 'painter_accepted') {
      return json({ error: job.status === 'confirmed' ? 'This job is already confirmed. Use your dashboard to change the date.' : 'This job can\'t be scheduled right now.' }, 409)
    }

    const today = todayIso()
    const base = `${frontendUrl}`

    // ---------------- accept the customer's counter-proposal ----------------
    if (action === 'accept_counter') {
      const c = job.customer_counter as { start?: string; end?: string } | null
      if (job.date_state !== 'customer_countered' || !c || !isIsoDate(c.start) || !isIsoDate(c.end)) {
        return json({ error: 'There\'s no customer proposal to accept.' }, 409)
      }
      const { error } = await supabase
        .from('quote_selections')
        .update({ scheduled_date: c.start, scheduled_end_date: c.end, date_state: 'agreed', date_confirmed_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'painter_accepted')
      if (error) throw error

      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: job.customer_email,
          type: 'dates_agreed',
          data: {
            painterCompanyName: painter?.company_name,
            startDate: c.start,
            endDate: c.end,
            confirmUrl: `${base}/confirm-job?token=${job.customer_confirm_token}`,
          },
        }),
      }).catch((e) => console.error('dates_agreed email failed:', e))
      await notify(supabase, {
        userId: job.customer_id, type: 'dates_agreed', title: 'Your painter accepted your dates',
        body: 'Pay your deposit to lock them in.', link: '/customer/projects',
      })
      return json({ success: true })
    }

    if (action !== 'offer') return json({ error: 'Unknown action' }, 400)
    // Until the deposit is paid (status stays painter_accepted) the painter can still change what they offer;
    // that sends the customer back to confirm again.

    const mode = String(body.mode ?? '')
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
    const confirmRealistic = body.confirmRealistic === true
    let availability: Record<string, unknown>

    if (mode === 'exact') {
      const raw = Array.isArray(body.windows) ? body.windows : []
      if (raw.length === 0 || raw.length > MAX_WINDOWS) return json({ error: `Offer between 1 and ${MAX_WINDOWS} date windows.` }, 400)
      const windows: { start: string; end: string }[] = []
      for (const w of raw as { start?: unknown; end?: unknown }[]) {
        if (!isIsoDate(w.start) || !isIsoDate(w.end) || w.end < w.start) return json({ error: 'Each window needs a start date and an end date on or after it.' }, 400)
        if (w.start < today) return json({ error: 'Dates can\'t be in the past.' }, 400)
        if (w.start > addDays(today, MAX_DAYS_AHEAD)) return json({ error: 'Those dates are too far ahead.' }, 400)
        windows.push({ start: w.start, end: w.end })
      }
      // Realism: is each window long enough for the job?
      const tooShort = windows.filter((w) => workingDaysBetween(w.start, w.end) < myDays)
      if (tooShort.length > 0 && !confirmRealistic) {
        return json({
          needsConfirm: true,
          reason: 'window_shorter_than_job',
          estimatedDays: myDays,
          windowDays: tooShort.map((w) => workingDaysBetween(w.start, w.end)),
          message: `We estimate this job takes about ${myDays} working day${myDays === 1 ? '' : 's'} with your crew, but ${tooShort.length === 1 ? 'a window you entered has' : 'some windows you entered have'} fewer. Confirm you can finish within ${tooShort.length === 1 ? 'it' : 'them'}, or adjust the dates.`,
        }, 409)
      }
      availability = { mode: 'exact', windows, note, estimatedDays: myDays, offeredAt: new Date().toISOString() }
    } else if (mode === 'flexible') {
      const around = body.around
      const flexDays = Number(body.flexDays)
      if (!isIsoDate(around) || around < today) return json({ error: 'Pick the date your availability is centered around.' }, 400)
      if (around > addDays(today, MAX_DAYS_AHEAD)) return json({ error: 'That date is too far ahead.' }, 400)
      if (!FLEX_OPTIONS.includes(flexDays)) return json({ error: 'Choose how flexible you are: 3, 7, 14 or 30 days.' }, 400)
      // Always ask for the realism confirmation: the customer will choose any start inside the window.
      if (!confirmRealistic) {
        return json({
          needsConfirm: true,
          reason: 'confirm_duration',
          estimatedDays: myDays,
          message: `We estimate this job takes about ${myDays} working day${myDays === 1 ? '' : 's'} with your crew. Confirm you can finish it if the customer starts on any date in your window.`,
        }, 409)
      }
      availability = { mode: 'flexible', around, flexDays, note, estimatedDays: myDays, offeredAt: new Date().toISOString() }
    } else {
      return json({ error: 'Choose exact dates or "my dates are flexible".' }, 400)
    }

    const { error } = await supabase
      .from('quote_selections')
      .update({
        painter_availability: availability,
        date_state: 'painter_offered',
        customer_counter: null,
        scheduled_date: null,
        scheduled_end_date: null,
      })
      .eq('id', job.id)
      .eq('status', 'painter_accepted')
    if (error) throw error

    const summary = availability.mode === 'exact'
      ? (availability.windows as { start: string; end: string }[]).map((w) => ({ start: w.start, end: w.end }))
      : []
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: job.customer_email,
        type: 'painter_offered_dates',
        data: {
          painterCompanyName: painter?.company_name,
          mode: availability.mode,
          windows: summary,
          around: availability.mode === 'flexible' ? availability.around : null,
          flexDays: availability.mode === 'flexible' ? availability.flexDays : null,
          note,
          estimatedDays: myDays,
          guaranteedPrice: job.guaranteed_price,
          confirmUrl: `${base}/confirm-job?token=${job.customer_confirm_token}`,
        },
      }),
    }).catch((e) => console.error('painter_offered_dates email failed:', e))
    await notify(supabase, {
      userId: job.customer_id, type: 'dates_offered', title: 'Your painter sent their available dates',
      body: 'Confirm your dates and pay your deposit to lock them in.', link: '/customer/projects',
    })

    return json({ success: true })
  } catch (error) {
    console.error('Error in painter-dates:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})

