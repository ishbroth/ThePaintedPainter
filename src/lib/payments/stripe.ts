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
 * Create a checkout session for the 10% deposit payment.
 *
 * Flow:
 * 1. Customer selects a painter or guaranteed price
 * 2. Frontend calls this function with the project details
 * 3. This calls a Supabase Edge Function to create a Stripe Checkout Session
 * 4. Customer is redirected to Stripe Checkout
 * 5. On success, Stripe webhook updates the customer_project.deposit_paid = true
 *
 * @param projectId - The customer_project ID
 * @param totalAmount - The total project price
 * @param painterName - Name of the painter (for checkout description)
 * @returns The Stripe Checkout Session URL to redirect to
 */
export async function createDepositCheckout(
  projectId: string,
  totalAmount: number,
  painterName: string
): Promise<string | null> {
  const depositAmount = Math.round(totalAmount * 0.10 * 100); // 10% in cents

  // TODO: Replace with actual Supabase Edge Function call
  // const { data, error } = await supabase.functions.invoke('create-checkout-session', {
  //   body: {
  //     projectId,
  //     amount: depositAmount,
  //     description: `10% deposit for painting project with ${painterName}`,
  //     successUrl: `${window.location.origin}/customer/dashboard/projects?payment=success`,
  //     cancelUrl: `${window.location.origin}/customer/dashboard/projects?payment=cancelled`,
  //   },
  // });
  //
  // if (error || !data?.url) {
  //   console.error('Failed to create checkout session:', error);
  //   return null;
  // }
  //
  // return data.url;

  console.log('Stripe checkout not yet configured', { projectId, depositAmount, painterName });
  return null;
}

/**
 * Deposit amount calculator
 */
export function calculateDeposit(totalAmount: number): number {
  return Math.round(totalAmount * 0.10 * 100) / 100; // 10%, rounded to cents
}
