// supabase/functions/invite-status/index.ts
//
// Supabase Edge Function: is the job in an outreach invitation still open?
//
// The "Claim this job" button in the invitation email (outreach-painters) links to the painter signup page with the invitation's token.
// The page asks this function what became of the job so it can say so, instead of letting a company sign up for a job that is gone.
//
// POST { token }  ->  { state: 'open' | 'taken' | 'cancelled' | 'closed' }
//   open       nobody has the job yet (a company that signs up and is approved will be offered it)
//   taken      another painter has been given or has accepted the job
//   cancelled  the customer cancelled the request
//   closed     the job ran out its 48 hours with no painter, or is otherwise over
// Nothing about the customer or the job is returned, only the state. An unknown token is treated as 'open' (the page just shows the form).
//
// Deploy:
//   supabase functions deploy invite-status --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const OPEN = ['searching_painter', 'needs_new_painter']
const TAKEN = ['offer_sent', 'painter_accepted', 'confirmed', 'completed']

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

    const { token } = await req.json() as { token?: string }
    // invitation tokens are uuids; anything else is not one of ours
    if (!token || !/^[0-9a-f-]{20,40}$/i.test(token)) return json({ state: 'open' })

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: lead } = await supabase.from('outreach_leads').select('job_id').eq('invite_token', token).maybeSingle()
    if (!lead) return json({ state: 'open' })

    const { data: job } = await supabase.from('quote_selections').select('status').eq('id', lead.job_id).maybeSingle()
    if (!job) return json({ state: 'closed' })

    const state = OPEN.includes(job.status) ? 'open'
      : TAKEN.includes(job.status) ? 'taken'
      : job.status === 'cancelled' ? 'cancelled'
      : 'closed'
    return json({ state })
  } catch (error) {
    console.error('Error in invite-status:', error)
    // never block the signup form on a lookup failure
    return json({ state: 'open' })
  }
})
