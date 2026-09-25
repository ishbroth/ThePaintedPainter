// supabase/functions/get-job-by-token/index.ts
//
// Supabase Edge Function: Look up a job by the customer's confirm token
//
// Backs the /confirm-job page. Returns only the safe subset of fields a
// customer should see at this stage (the accepted painter's contact info,
// price, deposit amount, status) — never the claim_token or the raw
// quote_selections row, since quote_selections has no public SELECT policy
// by design (this function uses the service role to read it deliberately).
//
// Deploy:
//   supabase functions deploy get-job-by-token --no-verify-jwt

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
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase environment variables')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: job, error } = await supabase
      .from('quote_selections')
      .select('id, status, guaranteed_price, deposit_amount, deposit_status, accepted_by, confirmed_at')
      .eq('customer_confirm_token', token)
      .maybeSingle()

    if (error || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!job.accepted_by) {
      return new Response(
        JSON.stringify({ error: 'No painter has accepted this job yet' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: painter } = await supabase
      .from('painters')
      .select('company_name, owner_name, email, phone')
      .eq('id', job.accepted_by)
      .maybeSingle()

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: job.status,
        guaranteedPrice: job.guaranteed_price,
        depositAmount: job.deposit_amount,
        depositStatus: job.deposit_status,
        confirmedAt: job.confirmed_at,
        painter: painter
          ? {
              companyName: painter.company_name,
              ownerName: painter.owner_name,
              email: painter.email,
              phone: painter.phone,
            }
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error fetching job by token:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
