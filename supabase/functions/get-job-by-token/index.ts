// supabase/functions/get-job-by-token/index.ts
//
// Supabase Edge Function: what the customer's "confirm your dates and pay" page shows
//
// GET ?token=<customer_confirm_token>
//
// Returns the job, the painter's offered dates, and where the dates conversation
// stands. The painter's name is shown, but their email, phone and owner's name are
// withheld until the deposit has been paid (they're released in the confirmation
// email and on the confirmed job).
//
// Deploy:
//   supabase functions deploy get-job-by-token --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { describeTiming } from '../_shared/offers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) return json({ error: 'Missing token' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase environment variables')
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: job, error } = await supabase
      .from('quote_selections')
      .select('id, status, guaranteed_price, deposit_amount, deposit_status, accepted_by, confirmed_at, scheduled_date, scheduled_end_date, phase_label, date_state, painter_availability, customer_counter, estimated_days, customer_start_date, customer_end_date, dates_flexible, timeline, customer_preferred_date')
      .eq('customer_confirm_token', token)
      .maybeSingle()

    if (error || !job) return json({ error: 'Job not found' }, 404)
    if (!job.accepted_by) return json({ error: 'No painter has accepted this job yet' }, 409)

    const paid = job.deposit_status === 'paid'
    const { data: painter } = await supabase
      .from('painters')
      .select('company_name, owner_name, email, phone')
      .eq('id', job.accepted_by)
      .maybeSingle()

    return json({
      jobId: job.id,
      status: job.status,
      guaranteedPrice: job.guaranteed_price,
      depositAmount: job.deposit_amount,
      depositStatus: job.deposit_status,
      confirmedAt: job.confirmed_at,
      scheduledDate: job.scheduled_date,
      scheduledEndDate: job.scheduled_end_date,
      phaseLabel: job.phase_label,
      dateState: job.date_state,
      availability: job.painter_availability,
      counter: job.customer_counter,
      estimatedDays: job.estimated_days,
      customerTiming: describeTiming(job),
      // Contact details only once the deposit is paid.
      painter: painter
        ? paid
          ? { companyName: painter.company_name, ownerName: painter.owner_name, email: painter.email, phone: painter.phone }
          : { companyName: painter.company_name }
        : null,
    })
  } catch (error) {
    console.error('Error fetching job by token:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
