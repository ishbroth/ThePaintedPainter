// supabase/functions/confirm-painter-date/index.ts
//
// Supabase Edge Function: painter sets/confirms the scheduled start date
//
// Backs the /painter/confirm-date page, which a painter lands on right
// after accepting a job (see claim-job's redirect). Deliberately returns
// only the masked subset of job info a painter should see before the
// customer has paid a deposit — no name/address/phone here, same privacy
// boundary the rest of the claim flow already enforces.
//
// GET  ?token=...&painter_id=...   -> prefill data (customer's preferred
//                                     date, ZIP, price)
// POST { token, painterId, scheduledDate } -> sets scheduled_date, then
//                                     emails the customer to confirm+pay,
//                                     now including the date.
//
// Deploy:
//   supabase functions deploy confirm-painter-date --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { notify } from '../_shared/notify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonError('Missing Supabase environment variables', 500)
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')
      const painterId = url.searchParams.get('painter_id')
      if (!token || !painterId) return jsonError('Missing token or painter_id', 400)

      const { data: job, error } = await supabase
        .from('quote_selections')
        .select('id, quote_zip, guaranteed_price, customer_preferred_date, scheduled_date, accepted_by, phase_label')
        .eq('claim_token', token)
        .maybeSingle()

      if (error || !job) return jsonError('Job not found', 404)
      if (job.accepted_by !== painterId) return jsonError('This job was not accepted by this painter account', 403)

      return new Response(
        JSON.stringify({
          jobId: job.id,
          zipCode: job.quote_zip,
          guaranteedPrice: job.guaranteed_price,
          customerPreferredDate: job.customer_preferred_date,
          scheduledDate: job.scheduled_date,
          phaseLabel: job.phase_label,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method === 'POST') {
      const body = await req.json() as { token?: string; painterId?: string; scheduledDate?: string }
      const { token, painterId, scheduledDate } = body
      if (!token || !painterId || !scheduledDate) return jsonError('Missing token, painterId, or scheduledDate', 400)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return jsonError('scheduledDate must be YYYY-MM-DD', 400)

      const { data: job, error: jobError } = await supabase
        .from('quote_selections')
        .select('id, status, accepted_by, customer_id, customer_email, customer_confirm_token, guaranteed_price, deposit_amount')
        .eq('claim_token', token)
        .maybeSingle()

      if (jobError || !job) return jsonError('Job not found', 404)
      if (job.accepted_by !== painterId) return jsonError('This job was not accepted by this painter account', 403)

      // Only valid until the customer pays. After that the date is locked in
      // and changes go through reschedule-job (which notifies both sides),
      // so this link can't silently move a paid job or re-send a pay-now email.
      if (job.status !== 'painter_accepted') {
        return jsonError('This job is already confirmed. Use your dashboard to request a date change.', 409)
      }
      const today = new Date().toISOString().slice(0, 10)
      if (scheduledDate < today) return jsonError('Start date cannot be in the past', 400)

      const { error: updateError } = await supabase
        .from('quote_selections')
        .update({ scheduled_date: scheduledDate, date_confirmed_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'painter_accepted')

      if (updateError) throw updateError

      const { data: painter } = await supabase
        .from('painters')
        .select('company_name, owner_name, email, phone')
        .eq('id', painterId)
        .maybeSingle()

      await notify(supabase, {
        userId: job.customer_id, type: 'date_set', title: 'Start date set — confirm to lock it in',
        body: `${painter?.company_name ?? 'Your painter'} proposed ${scheduledDate}. Pay your deposit to confirm.`, link: '/customer/projects',
      })

      const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
      const confirmUrl = `${frontendUrl}/confirm-job?token=${job.customer_confirm_token}`

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: job.customer_email,
            type: 'painter_accepted_confirm_deposit',
            data: {
              painterCompanyName: painter?.company_name ?? 'Your painter',
              painterOwnerName: painter?.owner_name ?? '',
              painterEmail: painter?.email ?? '',
              painterPhone: painter?.phone ?? '',
              guaranteedPrice: job.guaranteed_price,
              depositAmount: job.deposit_amount,
              scheduledDate,
              confirmUrl,
            },
          }),
        })
      } catch (emailErr) {
        console.error('Failed to send customer confirm email:', emailErr)
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return jsonError('Method not allowed', 405)
  } catch (error) {
    console.error('Error in confirm-painter-date:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonError(message, 500)
  }
})
