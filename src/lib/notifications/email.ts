/**
 * Email Notification Integration (Resend)
 *
 * Groundwork for sending transactional emails via Resend.
 * These will be triggered by Supabase Edge Functions or database triggers.
 *
 * TODO: Set up Resend account and API key
 * TODO: Create Supabase Edge Function for sending emails
 * TODO: Set up email templates
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
 */

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
  | 'deal_expiring';

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
export async function sendEmail(_payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement via Supabase Edge Function
  // const { data, error } = await supabase.functions.invoke('send-email', {
  //   body: payload,
  // });
  //
  // if (error) {
  //   return { success: false, error: error.message };
  // }
  //
  // return { success: true };

  console.log('Email sending not yet configured');
  return { success: false, error: 'Email service not configured' };
}
