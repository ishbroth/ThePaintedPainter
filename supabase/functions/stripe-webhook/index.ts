// supabase/functions/stripe-webhook/index.ts
//
// Supabase Edge Function: Stripe Webhook Handler
//
// Receives webhook events from Stripe and processes them. Currently handles
// the 'checkout.session.completed' event to mark deposits as paid and notify
// the customer.
//
// Environment variables required:
//   STRIPE_SECRET_KEY      - Your Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET  - Webhook signing secret (whsec_...) from Stripe Dashboard
//   SUPABASE_URL           - Your Supabase project URL (auto-set by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY - Service role key for admin DB access (auto-set)
//
// Deploy:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Set secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Configure webhook in Stripe Dashboard:
//   URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

serve(async (req: Request) => {
  // --------------------------------------------------------------------------
  // Step 1: Only accept POST requests
  //
  // Stripe always sends webhooks via POST. Reject anything else.
  // Note: No CORS headers needed here because webhooks come from Stripe's
  // servers, not from a browser.
  // --------------------------------------------------------------------------
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // ------------------------------------------------------------------------
    // Step 2: Read environment variables
    //
    // STRIPE_SECRET_KEY is needed to initialize the Stripe client.
    // STRIPE_WEBHOOK_SECRET is used to verify the webhook signature.
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by
    // Supabase for Edge Functions and give us admin access to the database.
    // ------------------------------------------------------------------------
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error('Missing Stripe environment variables (STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)')
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
    }

    // ------------------------------------------------------------------------
    // Step 3: Initialize clients
    //
    // The Stripe client is used to construct and verify events.
    // The Supabase client uses the service role key to bypass RLS and perform
    // admin-level database operations.
    // ------------------------------------------------------------------------
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // ------------------------------------------------------------------------
    // Step 4: Verify the webhook signature
    //
    // Stripe signs every webhook payload with a secret. We verify this
    // signature to ensure the request genuinely came from Stripe and was not
    // tampered with. This is critical for security.
    //
    // The raw body must be read as text (not parsed as JSON) because the
    // signature is computed over the raw payload bytes.
    // ------------------------------------------------------------------------
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('Missing stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    let event: Stripe.Event

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown verification error'
      console.error(`Webhook signature verification failed: ${message}`)
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    console.log(`Received Stripe event: ${event.type} (${event.id})`)

    // ------------------------------------------------------------------------
    // Step 5: Route the event to the appropriate handler
    //
    // We use a switch statement so additional event types can be added easily.
    // For now, we only handle checkout.session.completed.
    // ------------------------------------------------------------------------
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event, supabase)
        break
      }

      // Add more event handlers here as needed:
      // case 'payment_intent.succeeded': { ... }
      // case 'customer.subscription.created': { ... }
      // case 'invoice.paid': { ... }

      default: {
        // Log unhandled events for debugging but return 200 so Stripe
        // does not retry delivery.
        console.log(`Unhandled event type: ${event.type}`)
      }
    }

    // ------------------------------------------------------------------------
    // Step 6: Return 200 to acknowledge receipt
    //
    // Stripe expects a 2xx response within a few seconds. If we return an
    // error, Stripe will retry the webhook delivery (up to ~3 days).
    // Always return 200 after successfully processing or logging the event.
    // ------------------------------------------------------------------------
    return new Response(
      JSON.stringify({ received: true, type: event.type }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    // ------------------------------------------------------------------------
    // Top-level error handler
    //
    // If something unexpected goes wrong, log it and return 500. Stripe will
    // retry the webhook, giving us a chance to fix the issue.
    // ------------------------------------------------------------------------
    console.error('Webhook handler error:', error)

    const message = error instanceof Error ? error.message : 'Internal server error'

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

// ===========================================================================
// Event Handlers
// ===========================================================================

/**
 * Handle checkout.session.completed
 *
 * This event fires when a customer successfully completes a Stripe Checkout
 * payment. We use it to:
 *   1. Extract the projectId from the session metadata
 *   2. Mark the project's deposit as paid in the database
 *   3. Create a notification record for the customer
 *
 * @param event - The verified Stripe event
 * @param supabase - Supabase client with service role (admin) access
 */
async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // --------------------------------------------------------------------------
  // Step A: Extract session data
  //
  // The checkout session object contains payment details and the metadata
  // we attached when creating the session (see create-checkout-session).
  // --------------------------------------------------------------------------
  const session = event.data.object as Stripe.Checkout.Session
  const projectId = session.metadata?.projectId

  if (!projectId) {
    console.error('checkout.session.completed: No projectId found in session metadata')
    console.error('Session ID:', session.id)
    // We still return without throwing so the webhook returns 200.
    // The missing metadata indicates a bug in session creation, not a
    // transient failure that retrying would fix.
    return
  }

  console.log(`Processing payment for project: ${projectId}`)
  console.log(`Amount: ${session.amount_total ? session.amount_total / 100 : 'unknown'} ${session.currency?.toUpperCase()}`)
  console.log(`Customer email: ${session.customer_details?.email || 'unknown'}`)

  // --------------------------------------------------------------------------
  // Step B: Update the customer_projects table
  //
  // Mark the deposit as paid. This flag is used by the frontend to show
  // payment status and unlock subsequent project steps.
  // --------------------------------------------------------------------------
  const { error: updateError } = await supabase
    .from('customer_projects')
    .update({
      deposit_paid: true,
      deposit_amount: session.amount_total ? session.amount_total / 100 : null,
      deposit_paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent as string,
    })
    .eq('id', projectId)

  if (updateError) {
    // Log the error but do not throw — we already received the payment.
    // A background job or manual intervention can reconcile later.
    console.error(`Failed to update customer_projects for project ${projectId}:`, updateError)
  } else {
    console.log(`Successfully marked project ${projectId} as deposit_paid = true`)
  }

  // --------------------------------------------------------------------------
  // Step C: Create a notification for the customer
  //
  // Insert a record into the notifications table so the customer sees
  // confirmation in their dashboard. The notification can also trigger
  // a push notification or email via a database trigger or separate function.
  // --------------------------------------------------------------------------
  const customerEmail = session.customer_details?.email
  const amountPaid = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00'

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({
      project_id: projectId,
      type: 'deposit_receipt',
      title: 'Payment received',
      message: `Your deposit of $${amountPaid} has been received. Your painter is now secured!`,
      recipient_email: customerEmail,
      read: false,
      created_at: new Date().toISOString(),
    })

  if (notificationError) {
    console.error(`Failed to create notification for project ${projectId}:`, notificationError)
  } else {
    console.log(`Notification created for project ${projectId}`)
  }

  // --------------------------------------------------------------------------
  // Step D: Trigger the send-email function (optional)
  //
  // If the customer has an email, invoke the send-email function to send
  // a deposit receipt email. We call it via the Supabase Functions URL.
  // This is optional — if it fails, the notification in the dashboard
  // still serves as confirmation.
  // --------------------------------------------------------------------------
  if (customerEmail) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

      if (supabaseUrl && supabaseAnonKey) {
        const emailResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: customerEmail,
              type: 'deposit_receipt',
              data: {
                customerName: session.customer_details?.name || 'Valued Customer',
                projectName: `Project ${projectId}`,
                amount: amountPaid,
              },
            }),
          },
        )

        if (emailResponse.ok) {
          console.log(`Deposit receipt email sent to ${customerEmail}`)
        } else {
          const emailError = await emailResponse.text()
          console.error(`Failed to send deposit receipt email: ${emailError}`)
        }
      }
    } catch (emailErr) {
      // Email failure is non-critical — log and continue
      console.error('Error sending deposit receipt email:', emailErr)
    }
  }
}
