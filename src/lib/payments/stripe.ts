/**
 * Stripe Payment Integration
 *
 * Groundwork for handling 10% deposit payments when customers
 * secure a painter at their chosen price.
 *
 * TODO: Set VITE_STRIPE_PUBLISHABLE_KEY in .env
 * TODO: Create Supabase Edge Function for checkout session creation
 * TODO: Set up Stripe webhook for payment confirmation
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { supabase } from '../supabase';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get or initialize the Stripe instance.
 * Uses the publishable key from environment variables.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('Stripe publishable key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in .env');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

/**
 * Create a checkout session for a job claim's 10% deposit payment.
 *
 * Flow:
 * 1. A painter accepts the customer's job (claim-job function)
 * 2. The customer gets an email with a /confirm-job?token=... link
 * 3. That page calls this function with the quote_selections id + confirm token
 * 4. This calls the create-checkout-session Edge Function, tagging the
 *    session metadata with kind: 'quote_selection' so the webhook knows
 *    which table to update
 * 5. Customer is redirected to Stripe Checkout
 * 6. On success, the webhook marks quote_selections.deposit_status = 'paid'
 *    and emails the painter the customer's full contact details
 *
 * @param quoteSelectionId - The quote_selections row id (Stripe metadata key)
 * @param confirmToken - The customer_confirm_token, so success/cancel redirects land back on the same job
 * @param totalAmount - The guaranteed price (deposit is 10% of this)
 * @param painterName - Name of the painter (for checkout description)
 * @returns The Stripe Checkout Session URL to redirect to
 */
export async function createDepositCheckout(
  quoteSelectionId: string,
  confirmToken: string,
  totalAmount: number,
  painterName: string
): Promise<string | null> {
  const depositAmount = calculateDeposit(totalAmount); // 10%, in dollars — create-checkout-session converts to cents itself

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      projectId: quoteSelectionId,
      amount: depositAmount,
      description: `10% deposit for painting project with ${painterName}`,
      kind: 'quote_selection',
      successUrl: `${window.location.origin}/confirm-job?token=${confirmToken}&payment=success`,
      cancelUrl: `${window.location.origin}/confirm-job?token=${confirmToken}&payment=cancelled`,
    },
  });

  if (error || !data?.url) {
    console.error('Failed to create checkout session:', error);
    return null;
  }

  return data.url;
}

/**
 * Deposit amount calculator
 */
export function calculateDeposit(totalAmount: number): number {
  return Math.round(totalAmount * 0.10 * 100) / 100; // 10%, rounded to cents
}
