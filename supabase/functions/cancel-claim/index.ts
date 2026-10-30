// supabase/functions/cancel-claim/index.ts
//
// Supabase Edge Function: the customer cancels the request they just sent (the "Cancel request" button in the
// "we received your request" email). The job is closed, so no painter can accept it any more.
//
// POST { token }                (the signed cancel token from the email)
// POST { token, preview: true } says whether the request can still be cancelled, without cancelling it.
// POST is used (not a plain link) so email scanners can't cancel anything.
//
// Only a request nobody has accepted yet can be cancelled here. Once a painter has accepted (and a deposit may be involved)
// the customer manages it from My Projects.
//
// Deploy:
//   supabase functions deploy cancel-claim --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { verifyCancel } from '../_shared/priceToken.ts'

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
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

    const { token, preview } = await req.json() as { token?: string; preview?: boolean }
    const jobId = await verifyCancel(token)
    if (!jobId) return json({ error: 'This link is not valid.' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, guaranteed_price')
      .eq('id', jobId)
      .maybeSingle()
    if (!job) return json({ error: 'We could not find this request.' }, 404)

    if (job.status === 'cancelled') return json({ error: 'This request is already cancelled.', code: 'already_cancelled' }, 409)
    if (!CANCELLABLE.includes(job.status)) {
      return json({
        error: 'A painter has already accepted this job, so it can no longer be cancelled from here. Open My Projects or reply to your confirmation email and we will help.',
        code: 'not_cancellable',
      }, 409)
    }
    if (preview) return json({ active: true, price: job.guaranteed_price })

    // The status is checked again in the update itself, so a painter accepting at the same moment can't be overwritten.
    const { data: updated, error } = await supabase
      .from('quote_selections')
      .update({ status: 'cancelled' })
      .eq('id', job.id)
      .in('status', CANCELLABLE)
      .select('id')
    if (error) throw error
    if (!updated || updated.length === 0) {
      return json({ error: 'A painter accepted this job a moment ago, so it can no longer be cancelled from here.', code: 'not_cancellable' }, 409)
    }
    return json({ success: true })
  } catch (error) {
    console.error('Error in cancel-claim:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
