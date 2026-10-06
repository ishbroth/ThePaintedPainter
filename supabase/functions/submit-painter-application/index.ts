// supabase/functions/submit-painter-application/index.ts
//
// Supabase Edge Function: step 1 of painter sign-up — request + confirmation email
//
// Nothing is created yet. The form answers are stored in painter_signup_requests
// (password kept only as a bcrypt hash) and an email with a confirmation link
// goes to the applicant. The account, the painter record and the email to the
// admin all happen in confirm-painter-signup, when they click that link. If they
// never do, no account ever exists and the stored answers are deleted when the
// request expires 14 days after it was made.
//
// Deploy:
//   supabase functions deploy submit-painter-application --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'
import { sha256Hex } from '../_shared/hash.ts'
import { cleanExternalReviews, toStored } from '../_shared/externalReviews.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Only these columns may be set from the form. Notably NOT status/verified/
// application_tasks/user_id — those are set server-side or by the reviewer.
export const ALLOWED_COLUMNS = [
  'company_name', 'owner_name', 'phone', 'street_address', 'city', 'state', 'zip_code', 'website', 'external_reviews',
  'years_in_business', 'crew_size',
  'has_license', 'license_number', 'license_state', 'license_expiration',
  'is_bonded', 'bonding_company', 'bond_amount',
  'is_insured', 'insurance_company', 'policy_number', 'coverage_amount',
  'has_workers_comp', 'workers_comp_carrier',
  'certifications', 'other_certification',
  'service_types', 'service_area_zips', 'max_project_size', 'projects_per_month',
  'offers_estimates', 'offers_warranty', 'warranty_length',
  'price_1br_full', 'price_3br_walls', 'price_3br_trim_doors', 'price_3br_ceilings', 'price_5br_full', 'price_5br_cabinets',
]

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const body = await req.json() as { email?: string; password?: string; ownerName?: string; painter?: Record<string, unknown> }
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const ownerName = body.ownerName?.trim()
    const form = body.painter ?? {}

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required' }, 400)
    if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
    if (!ownerName) return json({ error: 'Owner name is required' }, 400)
    // These columns are NOT NULL on painters; catch a missing one now rather than after the confirmation click.
    for (const field of ['company_name', 'phone', 'street_address', 'city', 'state', 'zip_code']) {
      if (typeof form[field] !== 'string' || !(form[field] as string).trim()) return json({ error: 'Please fill in all required company and address fields.' }, 400)
    }

    const { data: exists } = await supabase.rpc('auth_email_exists', { p_email: email })
    if (exists) return json({ error: 'An account with this email already exists. Try signing in instead.' }, 409)

    const payload: Record<string, unknown> = {}
    for (const key of ALLOWED_COLUMNS) {
      if (key in form) payload[key] = form[key]
    }
    payload.owner_name = ownerName
    // Links are painter-typed and shown to the public: keep only https links on the right site, ratings in range.
    payload.external_reviews = toStored(cleanExternalReviews(payload.external_reviews))

    // A fresh submission replaces any earlier pending one for the same email,
    // so only the newest link works.
    await supabase.from('painter_signup_requests').delete().ilike('email', email)

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join('')
    const { error: insertError } = await supabase.from('painter_signup_requests').insert({
      email,
      token_hash: await sha256Hex(token),
      password_hash: bcrypt.hashSync(password, 10),
      payload,
    })
    if (insertError) {
      console.error('signup request insert failed:', insertError)
      return json({ error: 'We couldn\'t save your application. Please check your answers and try again.' }, 400)
    }

    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        type: 'painter_signup_confirm',
        data: {
          ownerName,
          companyName: payload.company_name,
          confirmUrl: `${frontendUrl}/painter/confirm-signup?token=${token}`,
        },
      }),
    })
    if (!emailRes.ok) {
      console.error('confirmation email failed:', await emailRes.text())
      await supabase.from('painter_signup_requests').delete().ilike('email', email)
      return json({ error: 'We couldn\'t send your confirmation email. Please check the address and try again.' }, 502)
    }

    return json({ success: true, needsEmailConfirmation: true })
  } catch (error) {
    console.error('Error in submit-painter-application:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
