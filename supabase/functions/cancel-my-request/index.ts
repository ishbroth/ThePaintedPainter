// supabase/functions/cancel-my-request/index.ts
//
// Supabase Edge Function: a signed-in customer cancels a request that is still waiting for a painter (the "Cancel request" button
// on the Dashboard's Requests & messages). Same rule as the "Cancel request" button in the confirmation email (cancel-claim): only a
// request nobody has accepted yet can be cancelled; once a painter has accepted, the customer works it out with them from the dashboard.
//
// POST { jobId }   (Authorization: the customer's session)
// The row must belong to the caller: matched by customer_id, or by customer_email when the account's email is confirmed
// (the same rule as get-my-projects).
//
// Deploy:
//   supabase functions deploy cancel-my-request

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CANCELLABLE = ['offer_sent', 'searching_painter']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server is not configured' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)
    const userId = userData.user.id
    const userEmail = userData.user.email_confirmed_at ? userData.user.email?.toLowerCase() : undefined

    const { jobId } = await req.json() as { jobId?: string }
    if (!jobId) return json({ error: 'Missing jobId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, customer_id, customer_email')
      .eq('id', jobId)
      .maybeSingle()
    const mine = job && (job.customer_id === userId || (userEmail && String(job.customer_email ?? '').toLowerCase() === userEmail))
    if (!job || !mine) return json({ error: 'We could not find this request.' }, 404)

    if (job.status === 'cancelled') return json({ error: 'This request is already cancelled.', code: 'already_cancelled' }, 409)
    if (!CANCELLABLE.includes(job.status)) {
      return json({ error: 'A painter has already accepted this job, so it can no longer be cancelled from here.', code: 'not_cancellable' }, 409)
    }

    // The status is checked again in the update itself, so a painter accepting at the same moment can't be overwritten.
    const { data: updated, error } = await supabase
      .from('quote_selections')
      .update({ status: 'cancelled', fallback_token: null, fallback_expires_at: null, fallback_suggestions: null })
      .eq('id', job.id)
      .in('status', CANCELLABLE)
      .select('id')
    if (error) throw error
    if (!updated || updated.length === 0) {
      return json({ error: 'A painter accepted this job a moment ago, so it can no longer be cancelled from here.', code: 'not_cancellable' }, 409)
    }
    return json({ success: true })
  } catch (error) {
    console.error('Error in cancel-my-request:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
