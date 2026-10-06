// supabase/functions/claim-job/index.ts
//
// Supabase Edge Function: Painter clicks "Accept" in the job-offer email
//
// New emails link to /painter/accept-job in the app, which POSTs here when the
// painter presses the button — a GET that changes state gets triggered by mail
// link scanners that open links in advance. The plain GET still works so offer
// emails already sent keep working. Atomically
// flips the job to painter_accepted — the UPDATE's WHERE status='offer_sent'
// clause is what makes this race-safe: if two painters click at once, only
// one UPDATE matches a row and returns it; the loser gets 0 rows back and
// sees "already claimed." On success, redirects the painter to a real app
// page (/painter/confirm-date) to set the scheduled start date — the
// customer isn't emailed to confirm+pay until that date is set, so their
// confirm email can show it (see confirm-painter-date).
//
// Environment variables required:
//   SUPABASE_URL              - auto-injected
//   SUPABASE_SERVICE_ROLE_KEY - auto-injected
//   FRONTEND_URL              - e.g. https://thepaintedpainter.com (defaults to that)
//
// Deploy:
//   supabase functions deploy claim-job --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { notify } from '../_shared/notify.ts'

function htmlPage(title: string, message: string, tone: 'success' | 'error'): Response {
  const color = tone === 'success' ? '#2563eb' : '#dc2626'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 20px; }
        .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px 32px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { color: ${color}; font-size: 22px; margin: 0 0 12px; }
        p { color: #374151; line-height: 1.6; margin: 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const isPost = req.method === 'POST'
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  // Same outcomes, shaped for the caller: JSON for the app, a page for old email links.
  const fail = (title: string, message: string, status = 400) =>
    isPost ? json({ error: message, title }, status) : htmlPage(title, message, 'error')

  try {
    let token: string | null
    let painterId: string | null
    let previewOnly = false
    if (isPost) {
      const body = await req.json() as { token?: string; painterId?: string; preview?: boolean }
      token = body.token ?? null
      painterId = body.painterId ?? null
      previewOnly = !!body.preview
    } else {
      const url = new URL(req.url)
      token = url.searchParams.get('token')
      painterId = url.searchParams.get('painter_id')
    }

    if (!token || !painterId) {
      return fail('Invalid link', 'This link is missing required information. Please check your email and try again.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Look up the job to confirm the token matches and this painter was eligible.
    const { data: job, error: jobError } = await supabase
      .from('quote_selections')
      .select('id, status, selection_type, selected_painter_id, notified_painters, customer_id, customer_email, guaranteed_price, customer_preferred_date, quote_zip, painter_payout_amount, project_summary, photos')
      .eq('claim_token', token)
      .maybeSingle()

    if (jobError || !job) {
      return fail('Link not found', 'This job offer link is invalid or has expired.', 404)
    }

    const eligible = job.selection_type === 'specific_painter'
      ? job.selected_painter_id === painterId
      : (job.notified_painters ?? []).includes(painterId)

    if (!eligible) {
      return fail('Not available', 'This job offer was not sent to this painter account.', 403)
    }

    // A painter who's been paused (or isn't approved) can't take new jobs, even from an offer sent earlier.
    const { data: claimer } = await supabase.from('painters').select('status, verified').eq('id', painterId).maybeSingle()
    if (!claimer || claimer.status !== 'approved' || !claimer.verified) {
      return fail('Not available right now', 'Your account is paused while we re-verify it, so you can\'t accept new jobs yet. Check your profile for next steps.', 403)
    }

    // Preview: what the accept page shows before the painter presses the button (nothing changes).
    if (previewOnly) {
      const summary = (job.project_summary ?? {}) as { timelineLabel?: string; qa?: { question: string; answer: string }[] }
      return json({
        open: job.status === 'offer_sent',
        zip: job.quote_zip,
        payoutAmount: job.painter_payout_amount,
        timelineLabel: summary.timelineLabel ?? null,
        preferredDate: job.customer_preferred_date,
        qa: summary.qa ?? [],
        photos: job.photos ?? [],
      })
    }

    // Atomic claim: only succeeds if the job is still open.
    const { data: updated, error: updateError } = await supabase
      .from('quote_selections')
      .update({ status: 'painter_accepted', accepted_by: painterId, accepted_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'offer_sent')
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError

    if (!updated) {
      return fail('Already claimed', 'Another painter already accepted this job. Keep an eye out for the next one!', 409)
    }

    // Best-effort notifications — never block the painter's redirect on them.
    try {
      const send = (to: string, type: string, data: Record<string, unknown>) =>
        fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, type, data }),
        })

      const { data: acceptedPainter } = await supabase
        .from('painters').select('company_name').eq('id', painterId).maybeSingle()

      if (job.customer_email) {
        await send(job.customer_email, 'painter_accepted_notice', {
          painterCompanyName: acceptedPainter?.company_name ?? 'A painter',
          guaranteedPrice: job.guaranteed_price,
          customerPreferredDate: job.customer_preferred_date,
        })
      }

      await notify(supabase, {
        userId: job.customer_id, type: 'painter_accepted', title: 'A painter accepted your job',
        body: `${acceptedPainter?.company_name ?? 'A painter'} is picking a start date.`, link: '/customer/projects',
      })

      const otherIds = (job.notified_painters ?? []).filter((id: string) => id !== painterId)
      if (otherIds.length > 0) {
        const { data: others } = await supabase.from('painters').select('email, user_id').in('id', otherIds)
        await Promise.allSettled((others ?? []).flatMap((o: { email: string; user_id: string | null }) => [
          send(o.email, 'job_taken', { zipCode: job.quote_zip }),
          notify(supabase, { userId: o.user_id, type: 'job_taken', title: 'That job was taken', body: `The job in ${job.quote_zip ?? 'your area'} was accepted by another painter.`, link: '/painter/projects' }),
        ]))
      }
    } catch (notifyErr) {
      console.error('Failed to send claim notifications:', notifyErr)
    }

    const dateConfirmUrl = `${frontendUrl}/painter/confirm-date?token=${token}&painter_id=${painterId}`
    if (isPost) return json({ success: true, dateConfirmUrl })
    return new Response(null, { status: 302, headers: { Location: dateConfirmUrl } })
  } catch (error) {
    console.error('Error claiming job:', error)
    return fail('Something went wrong', 'Please try again or contact support.', 500)
  }
})
