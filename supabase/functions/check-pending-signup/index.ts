// supabase/functions/check-pending-signup/index.ts
//
// Supabase Edge Function: "is this a painter who still has to verify their email?"
//
// A painter who has filled out the sign-up form but hasn't clicked the emailed
// link yet has no account, so a normal sign-in fails. The sign-in page asks
// here when a login fails: if the email + password match a pending, unexpired
// request, they're told to check their email for the verification link (and can
// have it sent again).
//
// POST { email, password, resend?: boolean }
//   -> { pending: true, resent?: true }      credentials match a pending request
//   -> { pending: false }                    anything else (no hints either way)
//   -> { pending: true, resent: false, retryInSeconds }   resend asked too soon
//
// Only a correct password reveals anything, and wrong guesses are counted per
// request: after 10 the request stops answering (the applicant can resubmit the
// form to start fresh).
//
// Deploy:
//   supabase functions deploy check-pending-signup --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'
import { sha256Hex } from '../_shared/hash.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_ATTEMPTS = 10
const RESEND_COOLDOWN_SECONDS = 60

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ pending: false })
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const { email, password, resend } = await req.json() as { email?: string; password?: string; resend?: boolean }
    if (!email || !password) return json({ pending: false })

    const { data: request } = await supabase
      .from('painter_signup_requests')
      .select('id, email, password_hash, payload, check_attempts, last_sent_at, expires_at')
      .ilike('email', email.trim())
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!request || request.check_attempts >= MAX_ATTEMPTS) return json({ pending: false })

    if (!bcrypt.compareSync(password, request.password_hash)) {
      await supabase.from('painter_signup_requests').update({ check_attempts: request.check_attempts + 1 }).eq('id', request.id)
      return json({ pending: false })
    }

    if (!resend) return json({ pending: true })

    // Resend: a fresh link replaces the old one (only the token hash is stored, so the old
    // token can't be re-emailed). Rate-limited so this can't be used to spam an inbox.
    const sinceLast = (Date.now() - new Date(request.last_sent_at).getTime()) / 1000
    if (sinceLast < RESEND_COOLDOWN_SECONDS) {
      return json({ pending: true, resent: false, retryInSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - sinceLast) })
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join('')
    const payload = request.payload as Record<string, unknown>
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: request.email,
        type: 'painter_signup_confirm',
        data: {
          ownerName: payload.owner_name,
          companyName: payload.company_name,
          confirmUrl: `${frontendUrl}/painter/confirm-signup?token=${token}`,
        },
      }),
    })
    if (!emailRes.ok) {
      console.error('resend failed:', await emailRes.text())
      return json({ pending: true, resent: false })
    }

    await supabase
      .from('painter_signup_requests')
      .update({ token_hash: await sha256Hex(token), last_sent_at: new Date().toISOString() })
      .eq('id', request.id)

    return json({ pending: true, resent: true })
  } catch (error) {
    console.error('Error in check-pending-signup:', error)
    return json({ pending: false })
  }
})
