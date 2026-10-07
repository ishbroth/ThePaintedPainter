// supabase/functions/create-checkout-session/index.ts
//
// Supabase Edge Function: start the Stripe Checkout for a job's deposit
//
// POST { confirmToken }
//
// The browser used to send the amount, and this accepted any amount for any job,
// so a customer could pay $1 and still confirm the job. Now the browser sends only
// the customer's confirm token; everything else is decided here from the database:
//   * the job must be waiting on its deposit (painter accepted, dates agreed,
//     not yet paid);
//   * the amount is the job's stored deposit (10% of the guaranteed price);
//   * the return URLs are built from our own site address.
// The webhook then re-checks the amount actually paid before confirming anything.
//
// Required secrets: STRIPE_SECRET_KEY. Optional: FRONTEND_URL.
//
// Deploy:
//   supabase functions deploy create-checkout-session --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) throw new Error('Server is not configured')
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

    const { confirmToken } = await req.json() as { confirmToken?: string }
    if (!confirmToken) return json({ error: 'Missing confirmToken' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, date_state, deposit_status, deposit_amount, scheduled_date, accepted_by')
      .eq('customer_confirm_token', confirmToken)
      .maybeSingle()

    if (!job) return json({ error: 'This link is invalid.' }, 404)
    if (job.deposit_status === 'paid' || job.status === 'confirmed') return json({ error: 'This deposit has already been paid.' }, 409)
    if (job.status !== 'painter_accepted' || !job.accepted_by) return json({ error: 'This job isn\'t ready for a deposit.' }, 409)
    if (job.date_state !== 'agreed' || !job.scheduled_date) return json({ error: 'Confirm your dates before paying the deposit.' }, 409)

    const depositCents = Math.round(Number(job.deposit_amount) * 100)
    if (!Number.isFinite(depositCents) || depositCents < 50) return json({ error: 'This job has no valid deposit amount.' }, 409)

    const { data: painter } = await supabase.from('painters').select('company_name').eq('id', job.accepted_by).maybeSingle()

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `10% deposit for painting project with ${painter?.company_name ?? 'your painter'}`,
              description: `Project ID: ${job.id}`,
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      metadata: { projectId: job.id, kind: 'quote_selection', depositCents: String(depositCents) },
      success_url: `${frontendUrl}/confirm-job?token=${confirmToken}&payment=success`,
      cancel_url: `${frontendUrl}/confirm-job?token=${confirmToken}&payment=cancelled`,
    })

    return json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return json({ error: 'Could not start checkout. Please try again.' }, 500)
  }
})
