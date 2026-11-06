// supabase/functions/cancel-my-request/index.ts
//
// Supabase Edge Function: a signed-in customer cancels a request that is still waiting for a painter (the "Cancel request" button
// on the Dashboard's Requests & messages). Same rule as the "Cancel request" button in the confirmation email (cancel-claim): only a
// request nobody has accepted yet can be cancelled. A job a painter has accepted can be too, as long as the customer has not accepted
// the contract or paid the deposit (nothing is signed yet): the painter is sent a kind note that the customer will not be moving forward.
// After that, the painter's own cancellation notices and the consumer cancellation rights they give apply.
//
// POST { jobId }   (Authorization: the customer's session)
// The row must belong to the caller: matched by customer_id, or by customer_email when the account's email is confirmed
// (the same rule as get-my-projects).
//
// Deploy:
//   supabase functions deploy cancel-my-request

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { notify } from '../_shared/notify.ts'

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
      .select('id, status, customer_id, customer_email, customer_name, phase_label, quote_zip, accepted_by, deposit_status')
      .eq('id', jobId)
      .maybeSingle()
    const mine = job && (job.customer_id === userId || (userEmail && String(job.customer_email ?? '').toLowerCase() === userEmail))
    if (!job || !mine) return json({ error: 'We could not find this request.' }, 404)

    if (job.status === 'cancelled') return json({ error: 'This request is already cancelled.', code: 'already_cancelled' }, 409)

    // A painter has accepted but nothing is signed and no deposit is paid: the customer may still walk away, and the painter is told.
    // Once they accept the contract and pay the deposit, the painter's own cancellation notices take over (the job is 'confirmed' by then).
    const heldByPainter = job.status === 'painter_accepted'
    if (!CANCELLABLE.includes(job.status) && !heldByPainter) {
      return json({ error: 'This job is already booked with a painter, so it can no longer be cancelled from here. Contact your painter about their cancellation terms.', code: 'not_cancellable' }, 409)
    }
    if (heldByPainter) {
      const { data: versions } = await supabase.from('job_contracts').select('id, status').eq('job_id', job.id)
      if (job.deposit_status === 'paid' || (versions ?? []).some((v: { status: string }) => v.status === 'accepted')) {
        return json({ error: 'You have already accepted the contract for this job, so it can no longer be cancelled from here. Contact your painter about their cancellation terms.', code: 'not_cancellable' }, 409)
      }
    }

    // The status is checked again in the update itself, so a painter accepting (or a customer paying) at the same moment can't be overwritten.
    const { data: updated, error } = await supabase
      .from('quote_selections')
      .update({ status: 'cancelled', fallback_token: null, fallback_expires_at: null, fallback_suggestions: null })
      .eq('id', job.id)
      .eq('status', job.status)
      .select('id')
    if (error) throw error
    if (!updated || updated.length === 0) {
      return json({ error: 'This job just changed, so it can no longer be cancelled from here. Reload the page.', code: 'not_cancellable' }, 409)
    }

    if (heldByPainter && job.accepted_by) {
      const now = new Date().toISOString()
      // the contract that was waiting is closed, so nobody can accept it afterwards
      await supabase.from('job_contracts').update({ status: 'declined', responded_at: now, updated_at: now, customer_note: 'The customer cancelled the request.' }).eq('job_id', job.id).eq('status', 'sent')
      await supabase.from('job_contracts').update({ status: 'superseded', updated_at: now }).eq('job_id', job.id).eq('status', 'draft')

      const { data: painter } = await supabase.from('painters').select('email, owner_name, company_name, user_id').eq('id', job.accepted_by).maybeSingle()
      if (painter?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: painter.email,
            type: 'customer_cancelled_request',
            data: {
              ownerName: painter.owner_name,
              customerFirstName: String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'The customer',
              projectLabel: job.phase_label || 'painting project',
              zipCode: job.quote_zip,
              dashboardUrl: `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/painter/dashboard`,
            },
          }),
        }).catch((e) => console.error('cancellation email failed:', e))
      }
      await notify(supabase, {
        userId: painter?.user_id, type: 'request_cancelled', title: 'The customer is not moving forward',
        body: 'They have decided not to go ahead with this project at this time. Nothing was signed and no deposit was paid.', link: '/painter/dashboard',
      })
    }
    return json({ success: true })
  } catch (error) {
    console.error('Error in cancel-my-request:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
