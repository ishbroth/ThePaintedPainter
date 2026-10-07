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
 * Starts Stripe Checkout for a job's deposit and returns the hosted-checkout URL.
 *
 * The browser sends ONLY the customer's confirm token. The server looks up the job, requires it to be waiting on
 * its deposit with dates agreed, and uses the deposit amount stored in the database (10% of the guaranteed price),
 * so the amount can't be changed from here. See supabase/functions/create-checkout-session.
 */
export async function createDepositCheckout(confirmToken: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { confirmToken },
  });

  if (error || !data?.url) {
    console.error('Failed to create checkout session:', error ?? data);
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
