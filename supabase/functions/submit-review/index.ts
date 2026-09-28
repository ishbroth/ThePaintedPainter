// supabase/functions/submit-review/index.ts
//
// Supabase Edge Function: customer submits a rating/review from the
// "confirm & rate" email link
//
// No login required — the review_token is the credential (same guest-
// checkout-friendly pattern as the rest of the claim flow). Writes into
// the reviews table, keyed by the painter's auth user id (painters.user_id),
// and marks the job so the link can't be reused.
//
// POST { token, rating, title?, body? }
//
// Deploy:
//   supabase functions deploy submit-review --no-verify-jwt

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
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase environment variables')

    const { token, rating, title, body } = await req.json() as {
      token?: string; rating?: number; title?: string; body?: string
    }
    if (!token) return jsonError('Missing token', 400)
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return jsonError('rating must be an integer from 1 to 5', 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: job, error: jobError } = await supabase
      .from('quote_selections')
      .select('id, customer_id, customer_name, accepted_by, review_submitted_at')
      .eq('review_token', token)
      .maybeSingle()

    if (jobError || !job) return jsonError('This review link is invalid.', 404)
    if (job.review_submitted_at) return jsonError('This job has already been reviewed.', 409)
    if (!job.accepted_by) return jsonError('This job has no assigned painter to review.', 400)

    const { data: painter, error: painterError } = await supabase
      .from('painters')
      .select('user_id')
      .eq('id', job.accepted_by)
      .maybeSingle()

    if (painterError || !painter?.user_id) {
      return jsonError('Could not identify the painter for this job.', 500)
    }

    const { error: insertError } = await supabase
      .from('reviews')
      .insert({
        painter_id: painter.user_id,
        customer_id: job.customer_id,
        project_id: job.id,
        rating,
        title: title?.trim() || null,
        body: body?.trim() || null,
        customer_name: job.customer_name,
      })

    if (insertError) {
      if (insertError.code === '23505') return jsonError('This job has already been reviewed.', 409)
      throw insertError
    }

    await supabase
      .from('quote_selections')
      .update({ review_submitted_at: new Date().toISOString() })
      .eq('id', job.id)

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in submit-review:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonError(message, 500)
  }
})
