/**
 * Email Notification Integration (Resend)
 *
 * Sends transactional emails via the `send-email` Supabase Edge Function,
 * which relays them through Resend.
 *
 * Email Types:
 *
 * FOR CUSTOMERS:
 * - estimate_ready: "Your painting estimate is ready"
 * - painter_assigned: "A painter has been assigned to your project"
 * - project_reminder: "Your painting project is coming up on [date]"
 * - project_completed: "Your project is complete — leave a review!"
 * - deposit_receipt: "Payment received — your painter is secured"
 *
 * FOR PAINTERS:
 * - new_offer: "New job offer in [city] — $[amount]"
 * - offer_accepted: "Your offer was accepted by [customer]"
 * - new_review: "You received a new [X]-star review"
 * - payment_received: "Payment of $[amount] has been processed"
 * - deal_expiring: "Your deal '[title]' expires in 3 days"
 *
 * INTERNAL:
 * - painter_application_received: "New painter application received"
 */

import { supabase } from '../supabase';

export type EmailType =
  | 'estimate_ready'
  | 'painter_assigned'
  | 'project_reminder'
  | 'project_completed'
  | 'deposit_receipt'
  | 'new_offer'
  | 'offer_accepted'
  | 'new_review'
  | 'payment_received'
  | 'deal_expiring'
  | 'painter_application_received';

export interface EmailPayload {
  to: string;
  type: EmailType;
  data: Record<string, string | number>;
}

/**
 * Send a transactional email via Supabase Edge Function + Resend.
 *
 * Usage:
 *   await sendEmail({
 *     to: 'customer@example.com',
 *     type: 'painter_assigned',
 *     data: { painterName: 'ABC Painting', projectDate: '2026-04-15' }
 *   });
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: payload,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: data.error };
  }

  return { success: true };
}
