// supabase/functions/update-credentials/index.ts
//
// Supabase Edge Function: a painter updates their license / insurance / bond /
// workers' comp / certifications
//
// These are the details we vetted at approval, so they can't be written
// straight to the table from the browser (a database trigger blocks that).
// Painters change them through here instead: the update is validated and saved.
//
// Editing DETAILS (a new license number, a different insurance or bond
// provider, a renewed expiry) just saves: those change while a painter stays in
// business, so there's nothing to review.
//
// Turning OFF "licensed", "insured" or "bonded" — or workers' comp, for a
// painter who reported a crew of more than one — is different: if the painter is
// approved they're paused from new leads (status 'suspended') until the admin
// re-verifies them, the admin is emailed with a one-tap reinstate button, and
// the painter is told what's happening and what to upload. Jobs already
// accepted are unaffected.
//
// POST { credentials: { ...fields } }   -- only the fields below are accepted
//
// Deployed WITH JWT verification on.
//
// Deploy:
//   supabase functions deploy update-credentials

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { buildReviewUrl, ADMIN_EMAIL } from '../_shared/adminLink.ts'
import { notify } from '../_shared/notify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Turning one of these off (true -> false) pauses an approved painter pending re-verification.
// Workers' comp only counts for painters with employees: a crew of more than one. Crew size is
// whatever's on their profile; a painter who misstates it is caught when they contract the work.
type PauseCheck = { key: string; what: string; applies?: (p: Record<string, unknown>) => boolean }
const PAUSING_FLAGS: PauseCheck[] = [
  { key: 'has_license', what: 'contractor license' },
  { key: 'is_insured', what: 'liability insurance' },
  { key: 'is_bonded', what: 'bond' },
  {
    key: 'has_workers_comp',
    what: "workers' compensation coverage",
    applies: (p) => (Number(p.crew_size) || 0) > 1,
  },
]

const CERTIFICATIONS = ['EPA Lead-Safe Certified', 'OSHA Certified', 'Master Painter Certified', 'Other']

type Kind = 'bool' | 'text' | 'date' | 'certs'
const FIELDS: { key: string; label: string; kind: Kind }[] = [
  { key: 'has_license', label: 'Licensed', kind: 'bool' },
  { key: 'license_number', label: 'License #', kind: 'text' },
  { key: 'license_state', label: 'License state', kind: 'text' },
  { key: 'license_expiration', label: 'License expires', kind: 'date' },
  { key: 'is_insured', label: 'Insured', kind: 'bool' },
  { key: 'insurance_company', label: 'Insurance company', kind: 'text' },
  { key: 'policy_number', label: 'Policy #', kind: 'text' },
  { key: 'coverage_amount', label: 'Coverage', kind: 'text' },
  { key: 'is_bonded', label: 'Bonded', kind: 'bool' },
  { key: 'bonding_company', label: 'Bonding company', kind: 'text' },
  { key: 'bond_amount', label: 'Bond amount', kind: 'text' },
  { key: 'has_workers_comp', label: "Workers' comp", kind: 'bool' },
  { key: 'workers_comp_carrier', label: "Workers' comp carrier", kind: 'text' },
  { key: 'certifications', label: 'Certifications', kind: 'certs' },
  { key: 'other_certification', label: 'Other certification', kind: 'text' },
]

const display = (v: unknown): string => {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(none)'
  return v === null || v === undefined || v === '' ? '(blank)' : String(v)
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
    const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)

    const { credentials } = await req.json() as { credentials?: Record<string, unknown> }
    if (!credentials || typeof credentials !== 'object') return json({ error: 'Nothing to save' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: painter } = await supabase
      .from('painters')
      .select(`id, company_name, email, status, crew_size, ${FIELDS.map((f) => f.key).join(', ')}`)
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!painter) return json({ error: 'No painter profile found for this account' }, 404)

    // Validate + normalize each submitted field; ignore anything not on the list.
    const update: Record<string, unknown> = {}
    for (const field of FIELDS) {
      if (!(field.key in credentials)) continue
      const raw = credentials[field.key]
      if (field.kind === 'bool') {
        if (typeof raw !== 'boolean') return json({ error: `${field.label} must be yes or no.` }, 400)
        update[field.key] = raw
      } else if (field.kind === 'date') {
        const v = typeof raw === 'string' ? raw.trim() : ''
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return json({ error: `${field.label} must be a date.` }, 400)
        update[field.key] = v || null
      } else if (field.kind === 'certs') {
        if (!Array.isArray(raw) || raw.some((c) => !CERTIFICATIONS.includes(String(c)))) return json({ error: 'Unknown certification.' }, 400)
        update[field.key] = raw
      } else {
        const v = typeof raw === 'string' ? raw.trim() : ''
        if (v.length > 120) return json({ error: `${field.label} is too long.` }, 400)
        update[field.key] = v || null
      }
    }

    // Consistency: a license/insurance/bond/comp that's switched off carries no details.
    const clearIfOff = (flag: string, detailKeys: string[]) => {
      if (update[flag] === false) for (const k of detailKeys) update[k] = null
    }
    clearIfOff('has_license', ['license_number', 'license_state', 'license_expiration'])
    clearIfOff('is_insured', ['insurance_company', 'policy_number', 'coverage_amount'])
    clearIfOff('is_bonded', ['bonding_company', 'bond_amount'])
    clearIfOff('has_workers_comp', ['workers_comp_carrier'])
    if (Array.isArray(update.certifications) && !(update.certifications as string[]).includes('Other')) update.other_certification = null

    // What actually changed?
    const changes: { label: string; from: string; to: string }[] = []
    for (const field of FIELDS) {
      if (!(field.key in update)) continue
      const before = display((painter as Record<string, unknown>)[field.key])
      const after = display(update[field.key])
      if (before !== after) changes.push({ label: field.label, from: before, to: after })
    }

    if (changes.length === 0) return json({ success: true, changed: 0 })

    // Did they switch off a license / insurance / bond they previously had?
    const turnedOff = PAUSING_FLAGS.filter((f) => (painter as Record<string, unknown>)[f.key] === true && update[f.key] === false && (!f.applies || f.applies(painter as Record<string, unknown>)))
    const suspend = painter.status === 'approved' && turnedOff.length > 0
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    if (suspend) {
      const things = turnedOff.map((f) => f.what).join(' and ')
      Object.assign(update, {
        status: 'suspended',
        verified: false,
        application_tasks: turnedOff.map((f) => ({ id: crypto.randomUUID(), label: `Proof of your current ${f.what}, or an explanation of your status`, done: false })),
        admin_message: `You turned off your ${things}. New leads are paused until we re-verify you, usually within 1\u20133 days. Jobs you've already accepted aren't affected. Upload proof below and press Submit for review to speed things up.`,
      })
    }

    const { error } = await supabase.from('painters').update(update).eq('id', painter.id)
    if (error) throw error

    if (suspend) {
      // Best effort — the change itself already saved.
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: ADMIN_EMAIL(),
            type: 'painter_suspended',
            data: {
              companyName: painter.company_name,
              applicantEmail: painter.email,
              turnedOff: turnedOff.map((f) => f.what),
              reviewUrl: await buildReviewUrl(painter.id),
            },
          }),
        })
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: painter.email,
            type: 'painter_suspended_notice',
            data: { turnedOff: turnedOff.map((f) => f.what), profileUrl: `${frontendUrl}/painter/dashboard` },
          }),
        })
        await notify(supabase, {
          userId: userData.user.id,
          type: 'painter_suspended',
          title: 'New leads are paused while we re-verify you',
          body: 'Expect 1\u20133 days. Upload proof on your profile to speed it up.',
          link: '/painter/dashboard',
        })
      } catch (notifyErr) {
        console.error('suspension notifications failed:', notifyErr)
      }
    }

    return json({ success: true, changed: changes.length, suspended: suspend, turnedOff: suspend ? turnedOff.map((f) => f.what) : [] })
  } catch (error) {
    console.error('Error in update-credentials:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
