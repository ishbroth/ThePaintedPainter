// supabase/functions/admin-painter-review/index.ts
//
// Supabase Edge Function: the admin's decision on a painter application
//
// Backs the /admin/painter-review page that the sign-up email links to. No
// login: the link carries a signed, expiring token (see _shared/adminLink.ts).
//
// GET  ?id&exp&sig                 -> application summary + current tasks
// POST { id, exp, sig, action, tasks?, message? }
//        action 'approve'      -> status approved, verified; painter emailed + notified
//        action 'request_info' -> status needs_info; tasks (labels) saved to the
//                                 painter's profile as a checklist; emailed + notified
//        action 'reject'       -> status rejected with the reason in `message`
//
// Deploy:
//   supabase functions deploy admin-painter-review --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { verifyReviewLink } from '../_shared/adminLink.ts'
import { notify } from '../_shared/notify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

interface Task { id: string; label: string; done: boolean }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    let id: string | null, exp: number, sig: string | null
    let body: { action?: string; tasks?: string[]; message?: string } = {}

    if (req.method === 'GET') {
      const url = new URL(req.url)
      id = url.searchParams.get('id')
      exp = Number(url.searchParams.get('exp'))
      sig = url.searchParams.get('sig')
    } else if (req.method === 'POST') {
      const parsed = await req.json()
      id = parsed.id
      exp = Number(parsed.exp)
      sig = parsed.sig
      body = parsed
    } else {
      return json({ error: 'Method not allowed' }, 405)
    }

    if (!id || !sig || !(await verifyReviewLink(id, exp, sig))) {
      return json({ error: 'This review link is invalid or has expired. Use the link from a more recent email.' }, 403)
    }

    const { data: painter, error } = await supabase
      .from('painters')
      .select('id, user_id, company_name, owner_name, email, phone, street_address, city, state, zip_code, website, years_in_business, crew_size, has_license, license_number, license_state, license_expiration, is_bonded, bonding_company, bond_amount, is_insured, insurance_company, policy_number, coverage_amount, has_workers_comp, workers_comp_carrier, certifications, service_types, service_area_zips, status, application_tasks, admin_message, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error || !painter) return json({ error: 'Application not found' }, 404)

    if (req.method === 'GET') return json({ painter })

    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
    const profileUrl = `${frontendUrl}/painter/dashboard`
    const send = (type: string, data: Record<string, unknown>) =>
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: painter.email, type, data }),
      }).catch((err) => console.error('painter decision email failed:', err))

    const message = (body.message ?? '').toString().trim().slice(0, 2000)
    const now = new Date().toISOString()

    if (body.action === 'approve') {
      const { error: upErr } = await supabase
        .from('painters')
        .update({ status: 'approved', verified: true, reviewed_at: now, admin_message: message || null, application_tasks: [] })
        .eq('id', id)
      if (upErr) throw upErr
      await send('painter_application_approved', { ownerName: painter.owner_name, companyName: painter.company_name, profileUrl })
      await notify(supabase, {
        userId: painter.user_id, type: 'application_approved', title: 'You\'re approved!',
        body: 'Your painter application was approved. You\'ll now receive job offers.', link: '/painter/dashboard',
      })
      return json({ success: true, status: 'approved' })
    }

    if (body.action === 'request_info') {
      const labels = (body.tasks ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      if (labels.length === 0 && !message) return json({ error: 'Add at least one task or a message' }, 400)
      // Keep progress on tasks that are unchanged; new labels start undone.
      const existing = (painter.application_tasks ?? []) as Task[]
      const tasks: Task[] = labels.map((label) => {
        const prior = existing.find((t) => t.label === label)
        return prior ?? { id: crypto.randomUUID(), label, done: false }
      })
      const { error: upErr } = await supabase
        .from('painters')
        .update({ status: painter.status === 'suspended' ? 'suspended' : 'needs_info', verified: false, application_tasks: tasks, admin_message: message || null, reviewed_at: now })
        .eq('id', id)
      if (upErr) throw upErr
      await send('painter_needs_info', {
        ownerName: painter.owner_name, companyName: painter.company_name, tasks: labels, message, profileUrl,
      })
      await notify(supabase, {
        userId: painter.user_id, type: 'application_needs_info', title: 'More info needed for your application',
        body: labels.length ? `${labels.length} task${labels.length === 1 ? '' : 's'} to complete on your profile.` : message,
        link: '/painter/dashboard',
      })
      return json({ success: true, status: 'needs_info' })
    }

    if (body.action === 'reject') {
      const { error: upErr } = await supabase
        .from('painters')
        .update({ status: 'rejected', verified: false, admin_message: message || null, reviewed_at: now })
        .eq('id', id)
      if (upErr) throw upErr
      await send('painter_rejected', { ownerName: painter.owner_name, companyName: painter.company_name, message })
      await notify(supabase, {
        userId: painter.user_id, type: 'application_rejected', title: 'Update on your application',
        body: message || 'Your application was not approved.', link: '/painter/dashboard',
      })
      return json({ success: true, status: 'rejected' })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('Error in admin-painter-review:', error)
    return json({ error: 'Something went wrong' }, 500)
  }
})
