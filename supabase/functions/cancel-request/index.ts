// supabase/functions/cancel-request/index.ts
//
// Supabase Edge Function: the customer declines the suggestions and cancels
// their request (the "No thanks" link in the painter-declined email).
//
// POST { token }   (the 72-hour fallback_token)
// POST is used (not a plain link) so email scanners can't cancel anything.
//
// Deploy:
//   supabase functions deploy cancel-request --no-verify-jwt

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
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

    const { token, preview } = await req.json() as { token?: string; preview?: boolean }
    if (!token) return json({ error: 'Missing token' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, fallback_expires_at')
      .eq('fallback_token', token)
      .maybeSingle()

    if (!job || job.status !== 'needs_new_painter') return json({ error: 'This request is no longer active.' }, 404)
    if (preview) return json({ active: true })

    const { error } = await supabase
      .from('quote_selections')
      .update({ status: 'cancelled', fallback_token: null, fallback_expires_at: null, fallback_suggestions: null })
      .eq('id', job.id)
      .eq('status', 'needs_new_painter')
    if (error) throw error

    return json({ success: true })
  } catch (error) {
    console.error('Error in cancel-request:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
