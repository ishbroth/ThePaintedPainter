// supabase/functions/mark-job-completed/index.ts
//
// Supabase Edge Function: painter marks a confirmed job done & paid
//
// We don't handle the actual labor contract or remaining payment between
// painter and customer — that's negotiated and settled off-platform. So
// "completed" here is purely the painter's own attestation, made from
// their signed-in dashboard (not an email link, not customer-verified).
// On success, emails the customer a "confirm & rate" link.
//
// Deployed WITH JWT verification on (no --no-verify-jwt flag) — the caller
// must be a signed-in painter, and we resolve which painter from their JWT.
//
// POST { jobId }
//
// Deploy:
//   supabase functions deploy mark-job-completed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

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
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData.user) return jsonError('Not authenticated', 401)

    const { jobId } = await req.json() as { jobId?: string }
    if (!jobId) return jsonError('Missing jobId', 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: painter, error: painterError } = await supabase
      .from('painters')
      .select('id, company_name')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (painterError || !painter) return jsonError('No painter profile found for this account', 403)

    const { data: job, error: updateError } = await supabase
      .from('quote_selections')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        review_requested_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('accepted_by', painter.id)
      .eq('status', 'confirmed')
      .select('id, customer_email, customer_name, phase_label, guaranteed_price, selected_painter_price, review_token')
      .maybeSingle()

    if (updateError) throw updateError
    if (!job) return jsonError('Job not found, not yours, or not in a completable state', 404)

    if (job.customer_email) {
      const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
      const reviewUrl = `${frontendUrl}/leave-review?token=${job.review_token}`
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: job.customer_email,
            type: 'project_completed',
            data: {
              customerName: job.customer_name,
              projectName: job.phase_label || `your project with ${painter.company_name}`,
              reviewUrl,
            },
          }),
        })
      } catch (emailErr) {
        console.error('Failed to send review-request email:', emailErr)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in mark-job-completed:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonError(message, 500)
  }
})
