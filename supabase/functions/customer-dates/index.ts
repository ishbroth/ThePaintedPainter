// supabase/functions/customer-dates/index.ts
//
// Supabase Edge Function: the customer's side of "when can you do it?"
//
// Once the painter has sent their availability, the customer, from the "confirm your
// dates and pay" page, does one of:
//   accept   {windowIndex}   take one of the painter's exact date windows
//   choose   {startDate}     painter was flexible: pick the exact start inside their window
//   counter  {start,end,note} suggest a different timeframe; the painter is emailed to
//                            accept it or offer other dates
// Accept/choose lock in the dates ('agreed'), after which the deposit can be paid.
// Nothing here reveals the painter's contact details; those are released after the
// deposit is paid.
//
// Auth: the customer's confirm token (from the email), no login.
//
// POST { token, action, ... }
//
// Deploy:
//   supabase functions deploy customer-dates --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { addDays, addWorkingDays, isIsoDate, todayIso } from '../_shared/availability.ts'
import { notify } from '../_shared/notify.ts'

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
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    const body = await req.json() as Record<string, unknown>
    const token = String(body.token ?? '')
    const action = String(body.action ?? '')
    if (!token) return json({ error: 'Missing token' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, deposit_status, accepted_by, claim_token, customer_name, painter_availability, date_state, estimated_days')
      .eq('customer_confirm_token', token)
      .maybeSingle()
    if (!job) return json({ error: 'This link is invalid.' }, 404)
    if (job.status !== 'painter_accepted' || job.deposit_status === 'paid') {
      return json({ error: 'This job is already confirmed or is no longer open.' }, 409)
    }
    if (!['painter_offered', 'agreed', 'customer_countered'].includes(job.date_state) || !job.painter_availability) {
      return json({ error: 'Your painter hasn\'t sent their available dates yet.' }, 409)
    }

    const avail = job.painter_availability as {
      mode: 'exact' | 'flexible'
      windows?: { start: string; end: string }[]
      around?: string
      flexDays?: number
      estimatedDays?: number
    }
    const today = todayIso()

    if (action === 'accept') {
      if (avail.mode !== 'exact') return json({ error: 'This painter offered a flexible window; choose your start date.' }, 400)
      const i = Number(body.windowIndex ?? 0)
      const w = avail.windows?.[i]
      if (!w) return json({ error: 'Choose one of the offered windows.' }, 400)
      if (w.end < today) return json({ error: 'That window has passed. Ask your painter for new dates.' }, 409)
      const { error } = await supabase
        .from('quote_selections')
        .update({ scheduled_date: w.start, scheduled_end_date: w.end, date_state: 'agreed', customer_counter: null, date_confirmed_at: new Date().toISOString() })
        .eq('id', job.id).eq('status', 'painter_accepted')
      if (error) throw error
      return json({ success: true, scheduled: { start: w.start, end: w.end } })
    }

    if (action === 'choose') {
      if (avail.mode !== 'flexible' || !isIsoDate(avail.around) || !avail.flexDays) return json({ error: 'This painter offered exact windows; accept one of them.' }, 400)
      const start = body.startDate
      if (!isIsoDate(start)) return json({ error: 'Pick a start date.' }, 400)
      const lo = addDays(avail.around, -avail.flexDays)
      const hi = addDays(avail.around, avail.flexDays)
      if (start < today) return json({ error: 'That date has passed.' }, 400)
      if (start < lo || start > hi) return json({ error: `Your painter can start between ${lo} and ${hi}.` }, 400)
      const days = avail.estimatedDays ?? job.estimated_days ?? 1
      const end = addWorkingDays(start, days)
      const { error } = await supabase
        .from('quote_selections')
        .update({ scheduled_date: start, scheduled_end_date: end, date_state: 'agreed', customer_counter: null, date_confirmed_at: new Date().toISOString() })
        .eq('id', job.id).eq('status', 'painter_accepted')
      if (error) throw error
      return json({ success: true, scheduled: { start, end } })
    }

    if (action === 'counter') {
      const start = body.start
      const end = body.end
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
      if (!isIsoDate(start) || !isIsoDate(end) || end < start) return json({ error: 'Enter a start date and an end date on or after it.' }, 400)
      if (start < today) return json({ error: 'Dates can\'t be in the past.' }, 400)

      const { error } = await supabase
        .from('quote_selections')
        .update({ customer_counter: { start, end, note, proposedAt: new Date().toISOString() }, date_state: 'customer_countered', scheduled_date: null, scheduled_end_date: null })
        .eq('id', job.id).eq('status', 'painter_accepted')
      if (error) throw error

      const { data: painter } = await supabase.from('painters').select('email, user_id').eq('id', job.accepted_by).maybeSingle()
      if (painter?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: painter.email,
            type: 'customer_counter_dates',
            data: {
              customerFirstName: String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'The customer',
              start, end, note,
              reviewUrl: `${frontendUrl}/painter/availability?token=${job.claim_token}&painter_id=${job.accepted_by}`,
            },
          }),
        }).catch((e) => console.error('counter email failed:', e))
      }
      await notify(supabase, {
        userId: painter?.user_id, type: 'dates_countered', title: 'The customer suggested different dates',
        body: `${start} to ${end}`, link: '/painter/projects',
      })
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('Error in customer-dates:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
