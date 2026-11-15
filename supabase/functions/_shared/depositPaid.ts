// What happens once a job's deposit is paid: the job becomes confirmed, the painter and the customer are notified and emailed.
// Shared by the Stripe webhook (a real payment) and create-checkout-session (the one test account that skips Stripe,
// see _shared/depositBypass.ts), so both leave the job in exactly the same state.

import { notify } from './notify.ts'
import { buildIcs, toBase64 } from './ics.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

export async function confirmDepositPaid(
  quoteSelectionId: string,
  checkoutSessionId: string | null,
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  const { data: job, error: updateError } = await supabase
    .from('quote_selections')
    .update({
      deposit_status: 'paid',
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      stripe_checkout_session_id: checkoutSessionId,
    })
    .eq('id', quoteSelectionId)
    .eq('status', 'painter_accepted')
    .select('id, customer_id, customer_name, customer_email, customer_phone, customer_street_address, customer_city, customer_state, quote_zip, painter_payout_amount, accepted_by, scheduled_date, scheduled_end_date, deposit_amount, guaranteed_price')
    .maybeSingle()

  if (updateError || !job) {
    console.error(`Failed to update quote_selections for job ${quoteSelectionId}:`, updateError)
    return
  }

  if (!job.accepted_by) {
    console.error(`Job ${quoteSelectionId} paid but has no accepted_by painter — cannot notify`)
    return
  }

  const { data: painter, error: painterError } = await supabase
    .from('painters')
    .select('email, user_id, company_name, owner_name, phone')
    .eq('id', job.accepted_by)
    .maybeSingle()

  if (painterError || !painter?.email) {
    console.error(`Could not find painter email for job ${quoteSelectionId}:`, painterError)
    return
  }

  const location = [job.customer_street_address, job.customer_city].filter(Boolean).join(', ')
  const icsAttachments = job.scheduled_date
    ? [{
        filename: 'painting-project.ics',
        content: toBase64(buildIcs({ uid: job.id, title: 'Painting project starts', date: job.scheduled_date, endDate: job.scheduled_end_date, location })),
      }]
    : undefined

  await notify(supabase, {
    userId: painter.user_id, type: 'job_confirmed', title: 'Job confirmed — deposit paid',
    body: job.scheduled_date ? `Starts ${job.scheduled_date}` : 'Open the job for customer details.', link: '/painter/projects',
  })
  await notify(supabase, {
    userId: job.customer_id, type: 'job_confirmed', title: 'Your project is confirmed',
    body: job.scheduled_date ? `Starts ${job.scheduled_date}` : undefined, link: '/customer/projects',
  })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) return

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: painter.email,
        type: 'job_confirmed_painter_details',
        data: {
          customerName: job.customer_name,
          customerEmail: job.customer_email,
          customerPhone: job.customer_phone,
          customerStreetAddress: job.customer_street_address,
          customerCity: job.customer_city,
          customerState: job.customer_state,
          customerZip: job.quote_zip,
          payoutAmount: job.painter_payout_amount,
          guaranteedPrice: job.guaranteed_price,
          depositAmount: job.deposit_amount,
          scheduledDate: job.scheduled_date,
          scheduledEndDate: job.scheduled_end_date,
          dashboardUrl: `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/painter/dashboard/projects`,
        },
        attachments: icsAttachments,
      }),
    })

    // Receipt + scheduling confirmation to the customer, now that the painter's
    // contact details are theirs to have.
    if (job.customer_email) {
      const receiptResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: job.customer_email,
          type: 'job_confirmed_customer',
          data: {
            painterCompanyName: painter.company_name,
            painterOwnerName: painter.owner_name,
            painterEmail: painter.email,
            painterPhone: painter.phone,
            depositAmount: job.deposit_amount,
            guaranteedPrice: job.guaranteed_price,
            scheduledDate: job.scheduled_date,
            scheduledEndDate: job.scheduled_end_date,
            projectsUrl: job.customer_id ? `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/customer/dashboard/projects` : null,
          },
          attachments: icsAttachments,
        }),
      })
      if (!receiptResponse.ok) console.error(`Failed to send customer receipt: ${await receiptResponse.text()}`)
    }

    if (emailResponse.ok) {
      console.log(`Job-confirmed email sent to painter for job ${quoteSelectionId}`)
    } else {
      console.error(`Failed to send job-confirmed email: ${await emailResponse.text()}`)
    }
  } catch (emailErr) {
    console.error('Error sending job-confirmed email:', emailErr)
  }
}
