// supabase/functions/create-checkout-session/index.ts
//
// Supabase Edge Function: Create Stripe Checkout Session
//
// Receives a POST request with project details and creates a Stripe Checkout
// Session so the customer can pay a deposit or full amount for their painting
// project. Returns the Checkout Session URL for client-side redirect.
//
// Environment variables required:
//   STRIPE_SECRET_KEY - Your Stripe secret key (sk_live_... or sk_test_...)
//
// Deploy:
//   supabase functions deploy create-checkout-session --no-verify-jwt
//
// Set secret:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

// CORS headers to allow requests from the frontend app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // --------------------------------------------------------------------------
  // Step 1: Handle CORS preflight requests
  // Browsers send an OPTIONS request before the actual POST to check CORS.
  // --------------------------------------------------------------------------
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // ------------------------------------------------------------------------
    // Step 2: Parse the request body
    // The client sends the project ID, amount, description, and redirect URLs.
    // ------------------------------------------------------------------------
    const { projectId, amount, description, successUrl, cancelUrl } = await req.json()

    // Validate required fields
    if (!projectId || !amount || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: projectId, amount, successUrl, cancelUrl',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be a positive number (in dollars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ------------------------------------------------------------------------
    // Step 3: Initialize the Stripe client
    // The secret key is stored as a Supabase Edge Function secret and accessed
    // via Deno.env. Never hard-code the key in source.
    // ------------------------------------------------------------------------
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      // Use the Deno HTTP client (fetch-based) instead of Node's http module
      httpClient: Stripe.createFetchHttpClient(),
    })

    // ------------------------------------------------------------------------
    // Step 4: Create the Stripe Checkout Session
    //
    // - mode: 'payment' for one-time charges (deposits or full payment)
    // - line_items: a single item representing the painting project charge
    // - metadata: stores the projectId so we can link the payment back to
    //   the project when we receive the webhook
    // - success_url / cancel_url: where Stripe redirects the customer after
    //   completing or cancelling the payment
    // ------------------------------------------------------------------------
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || 'Painting Project Deposit',
              description: `Project ID: ${projectId}`,
            },
            // Stripe expects the amount in cents
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      // Store the project ID in metadata so the stripe-webhook function can
      // look up and update the correct project when payment completes
      metadata: {
        projectId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // ------------------------------------------------------------------------
    // Step 5: Return the Checkout Session URL
    // The client redirects the user to this URL to complete payment on
    // Stripe's hosted checkout page.
    // ------------------------------------------------------------------------
    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    // ------------------------------------------------------------------------
    // Error handling: return a structured error response
    // In production, consider logging to an external service instead of
    // exposing internal error messages.
    // ------------------------------------------------------------------------
    console.error('Error creating checkout session:', error)

    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Missing required') ? 400 : 500

    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
