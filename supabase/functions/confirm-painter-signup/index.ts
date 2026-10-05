// supabase/functions/confirm-painter-signup/index.ts
//
// Supabase Edge Function: step 2 of painter sign-up — the email link is clicked
//
// POST { token }  (POST on purpose: email link scanners prefetch GET links, and
// this is the step that creates the account.)
//
// On a valid, unexpired token this is the moment the account officially exists:
//   1. creates the auth user (email already confirmed, with the password hash
//      the applicant chose — plaintext was never stored),
//   2. creates the painter record as status 'pending',
//   3. emails the admin the application with a signed review link,
//   4. deletes the stored request.
// Expired or unknown tokens create nothing.
//
// Deploy:
//   supabase functions deploy confirm-painter-signup --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { buildReviewUrl, ADMIN_EMAIL } from '../_shared/adminLink.ts'
import { sha256Hex } from '../_shared/hash.ts'

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  let createdUserId: string | null = null

  try {
    const { token } = await req.json() as { token?: string }
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return json({ error: 'This confirmation link is invalid.' }, 400)

    const { data: request } = await supabase
      .from('painter_signup_requests')
      .select('id, email, password_hash, payload, expires_at')
      .eq('token_hash', await sha256Hex(token))
      .maybeSingle()

    if (!request) {
      return json({ error: 'This confirmation link is invalid or has already been used. If you already confirmed, just sign in.' }, 404)
    }
    if (new Date(request.expires_at).getTime() < Date.now()) {
      await supabase.from('painter_signup_requests').delete().eq('id', request.id)
      return json({ error: 'This confirmation link has expired. Please fill out the sign-up form again.' }, 410)
    }

    const { data: exists } = await supabase.rpc('auth_email_exists', { p_email: request.email })
    if (exists) {
      await supabase.from('painter_signup_requests').delete().eq('id', request.id)
      return json({ error: 'An account with this email already exists. Try signing in instead.' }, 409)
    }

    // A stale never-confirmed account (e.g. an abandoned customer sign-up) must not block this address.
    await supabase.rpc('drop_unconfirmed_auth_user', { p_email: request.email })

    const payload = request.payload as Record<string, unknown>
    const ownerName = String(payload.owner_name ?? '')

    // 1. Auth user. Raw admin API call so we can pass the bcrypt hash directly.
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: request.email,
        password_hash: request.password_hash,
        email_confirm: true,
        user_metadata: { role: 'painter', display_name: ownerName },
      }),
    })
    const created = await createRes.json()
    if (!createRes.ok || !created?.id) {
      console.error('auth user creation failed:', created)
      return json({ error: 'We couldn\'t create your account. Please try the link again in a moment.' }, 500)
    }
    createdUserId = created.id as string

    // 2. Painter record, always pending. Starts the 30-day "remind" clock.
    const { data: painter, error: insertError } = await supabase
      .from('painters')
      .insert({
        ...payload,
        user_id: createdUserId,
        email: request.email,
        status: 'pending',
        verified: false,
        last_reminder_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !painter) {
      console.error('painter insert failed, rolling back auth user:', insertError)
      await supabase.auth.admin.deleteUser(createdUserId)
      createdUserId = null
      return json({ error: 'We couldn\'t finish creating your application. Please try the link again in a moment.' }, 500)
    }
    createdUserId = null // fully created; nothing to roll back

    // 3. Application goes to the admin now that the email is verified.
    try {
      const reviewUrl = await buildReviewUrl(painter.id)
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ADMIN_EMAIL(),
          type: 'painter_application_received',
          data: {
            companyName: payload.company_name,
            ownerName,
            applicantEmail: request.email,
            phone: payload.phone,
            city: payload.city,
            state: payload.state,
            zipCode: payload.zip_code,
            serviceTypes: Array.isArray(payload.service_types) ? (payload.service_types as string[]).join(', ') : '',
            yearsInBusiness: payload.years_in_business ?? 'N/A',
            crewSize: payload.crew_size ?? 'N/A',
            hasLicense: payload.has_license ? 'Yes' : 'No',
            isInsured: payload.is_insured ? 'Yes' : 'No',
            isBonded: payload.is_bonded ? 'Yes' : 'No',
            reviewUrl,
          },
        }),
      })
    } catch (emailErr) {
      console.error('admin application email failed:', emailErr)
    }

    // 4. The stored answers have served their purpose.
    await supabase.from('painter_signup_requests').delete().eq('id', request.id)

    return json({ success: true })
  } catch (error) {
    console.error('Error in confirm-painter-signup:', error)
    if (createdUserId) {
      try { await supabase.auth.admin.deleteUser(createdUserId) } catch (cleanupErr) { console.error('cleanup failed:', cleanupErr) }
    }
    return json({ error: 'Something went wrong. Please try the link again.' }, 500)
  }
})
