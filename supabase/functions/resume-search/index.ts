// supabase/functions/resume-search/index.ts
//
// Supabase Edge Function: load the customer's saved search results again
//
// The painter-declined email links to /resume-search, which asks the customer to
// sign in (or create an account with the same email) and then calls this. It returns
// the saved estimate and project details so the results page can be rebuilt exactly
// as before, minus the painter who declined, until the 72-hour link expires.
//
// POST { token }   Deployed WITH JWT verification: the caller must be signed in.
//
// Deploy:
//   supabase functions deploy resume-search

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server is not configured' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Please sign in' }, 401)
    const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'Please sign in' }, 401)

    const { token } = await req.json() as { token?: string }
    if (!token) return json({ error: 'Missing token' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, customer_id, customer_email, fallback_expires_at, resume_state, declined_painters')
      .eq('fallback_token', token)
      .maybeSingle()

    if (!job || job.status !== 'needs_new_painter') return json({ error: 'This link is no longer active.' }, 404)
    if (!job.fallback_expires_at || new Date(job.fallback_expires_at).getTime() < Date.now()) {
      return json({ error: 'This link has expired (they last 72 hours). You can start a new search any time.' }, 410)
    }

    // It's their search: signed in as the account that made it, or with the same email.
    const user = userData.user
    const sameEmail = !!user.email && user.email.toLowerCase() === String(job.customer_email ?? '').toLowerCase()
    if (job.customer_id !== user.id && !sameEmail) {
      return json({ error: 'This search belongs to a different account. Please sign in with the email you used for your request.' }, 403)
    }
    if (!job.resume_state) return json({ error: 'We couldn\'t restore that search. Please start a new one.' }, 404)

    return json({ state: job.resume_state, expiresAt: job.fallback_expires_at, declinedCount: (job.declined_painters ?? []).length })
  } catch (error) {
    console.error('Error in resume-search:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
