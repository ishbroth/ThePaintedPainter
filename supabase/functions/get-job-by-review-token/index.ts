// supabase/functions/get-job-by-review-token/index.ts
//
// Supabase Edge Function: look up a job from its review token
//
// Backs the public /leave-review page a customer lands on from the
// "confirm & rate" email sent after a painter marks a job completed. No
// login required — the token itself is the credential, same pattern as
// get-job-by-token/confirm-painter-date.
//
// GET ?token=...
//
// Deploy:
//   supabase functions deploy get-job-by-review-token --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return jsonError('Method not allowed', 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase environment variables')

    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return jsonError('Missing token', 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: job, error } = await supabase
      .from('quote_selections')
      .select('id, customer_name, phase_label, completed_at, review_submitted_at, accepted_by')
      .eq('review_token', token)
      .maybeSingle()

    if (error || !job) return jsonError('This review link is invalid.', 404)

    let painterCompanyName = 'your painter'
    if (job.accepted_by) {
      const { data: painter } = await supabase
        .from('painters')
        .select('company_name')
        .eq('id', job.accepted_by)
        .maybeSingle()
      if (painter?.company_name) painterCompanyName = painter.company_name
    }

    return new Response(
      JSON.stringify({
        customerName: job.customer_name,
        painterCompanyName,
        phaseLabel: job.phase_label,
        completedAt: job.completed_at,
        alreadyReviewed: !!job.review_submitted_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in get-job-by-review-token:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonError(message, 500)
  }
})
