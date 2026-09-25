// supabase/functions/claim-job/index.ts
//
// Supabase Edge Function: Painter clicks "Accept" in the job-offer email
//
// A plain GET link (so it works directly from an email client). Atomically
// flips the job to painter_accepted — the UPDATE's WHERE status='offer_sent'
// clause is what makes this race-safe: if two painters click at once, only
// one UPDATE matches a row and returns it; the loser gets 0 rows back and
// sees "already claimed." On success, emails the customer to confirm + pay
// the deposit, and returns a plain HTML confirmation page (there's no
// browser session here — this is a link click, not an app route).
//
// Environment variables required:
//   SUPABASE_URL              - auto-injected
//   SUPABASE_SERVICE_ROLE_KEY - auto-injected
//   SUPABASE_ANON_KEY         - auto-injected (used for the internal send-email call)
//   FRONTEND_URL              - e.g. https://thepaintedpainter.com (defaults to that)
//
// Deploy:
//   supabase functions deploy claim-job --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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

serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const painterId = url.searchParams.get('painter_id')

    if (!token || !painterId) {
      return htmlPage('Invalid link', 'This link is missing required information. Please check your email and try again.', 'error')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Look up the job to confirm the token matches and this painter was eligible.
    const { data: job, error: jobError } = await supabase
      .from('quote_selections')
      .select('id, status, selection_type, selected_painter_id, notified_painters, customer_email, customer_confirm_token, painter_payout_amount, deposit_amount, guaranteed_price')
      .eq('claim_token', token)
      .maybeSingle()

    if (jobError || !job) {
      return htmlPage('Link not found', 'This job offer link is invalid or has expired.', 'error')
    }

    const eligible = job.selection_type === 'specific_painter'
      ? job.selected_painter_id === painterId
      : (job.notified_painters ?? []).includes(painterId)

    if (!eligible) {
      return htmlPage('Not available', 'This job offer was not sent to this painter account.', 'error')
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
      return htmlPage(
        'Already claimed',
        'Another painter already accepted this job. Keep an eye out for the next one!',
        'error',
      )
    }

    // Fetch this painter's contact info for the customer-facing email.
    const { data: painter } = await supabase
      .from('painters')
      .select('company_name, owner_name, email, phone')
      .eq('id', painterId)
      .maybeSingle()

    const confirmUrl = `${frontendUrl}/confirm-job?token=${job.customer_confirm_token}`

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: job.customer_email,
          type: 'painter_accepted_confirm_deposit',
          data: {
            painterCompanyName: painter?.company_name ?? 'Your painter',
            painterOwnerName: painter?.owner_name ?? '',
            painterEmail: painter?.email ?? '',
            painterPhone: painter?.phone ?? '',
            guaranteedPrice: job.guaranteed_price,
            depositAmount: job.deposit_amount,
            confirmUrl,
          },
        }),
      })
    } catch (emailErr) {
      console.error('Failed to send customer confirm email:', emailErr)
    }

    return htmlPage(
      'Job claimed!',
      'You\'ve accepted this job. We\'ve notified the customer to confirm and pay the deposit — we\'ll email you their full contact details as soon as they do.',
      'success',
    )
  } catch (error) {
    console.error('Error claiming job:', error)
    return htmlPage('Something went wrong', 'Please try again or contact support.', 'error')
  }
})
