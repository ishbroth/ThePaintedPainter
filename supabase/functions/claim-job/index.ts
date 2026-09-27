// supabase/functions/claim-job/index.ts
//
// Supabase Edge Function: Painter clicks "Accept" in the job-offer email
//
// A plain GET link (so it works directly from an email client). Atomically
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
      .select('id, status, selection_type, selected_painter_id, notified_painters')
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

    const dateConfirmUrl = `${frontendUrl}/painter/confirm-date?token=${token}&painter_id=${painterId}`
    return new Response(null, { status: 302, headers: { Location: dateConfirmUrl } })
  } catch (error) {
    console.error('Error claiming job:', error)
    return htmlPage('Something went wrong', 'Please try again or contact support.', 'error')
  }
})
