// Shared bits for sending a painter a job offer and describing a job's timing.

import { notify } from './notify.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any

export interface OfferJob {
  id: string
  claim_token: string
  quote_zip: string | null
  customer_name: string
  customer_preferred_date: string | null
  customer_start_date: string | null
  customer_end_date: string | null
  dates_flexible: boolean | null
  timeline: string | null
  estimated_days: number | null
  painter_payout_amount: number | null
  project_summary: { qa?: unknown[]; timelineLabel?: string } | null
  photos: unknown[] | null
}

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** "Specific dates: Nov 3 – Nov 7, 2026", "Dates are flexible", "ASAP", ... for emails and cards. */
export function describeTiming(job: Pick<OfferJob, 'customer_start_date' | 'customer_end_date' | 'dates_flexible' | 'timeline' | 'customer_preferred_date'>): string {
  const flex = job.dates_flexible ? 'Dates are flexible' : ''
  if (job.customer_start_date) {
    const span = job.customer_end_date && job.customer_end_date !== job.customer_start_date
      ? `${fmt(job.customer_start_date)} – ${fmt(job.customer_end_date)}`
      : `starting ${fmt(job.customer_start_date)}`
    return flex ? `${flex}, around ${span}` : `Specific dates: ${span}`
  }
  if (flex) return flex
  if (job.timeline === 'asap') return 'As soon as possible'
  if (job.timeline === 'this_month') return 'Within the month'
  if (job.timeline === 'no_rush') return 'No rush'
  if (job.customer_preferred_date) return `Preferred start ${fmt(job.customer_preferred_date)}`
  return 'Not specified'
}

/** Email the painter the (masked) offer with its Accept/Decline page, plus an in-app/push notification. */
export async function sendPainterOffer(
  supabase: Supabase,
  env: { supabaseUrl: string; serviceRoleKey: string },
  job: OfferJob,
  painter: { id: string; email: string; user_id: string | null },
): Promise<void> {
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
  const first = job.customer_name.trim().split(/\s+/)[0] || 'A customer'
  await notify(supabase, {
    userId: painter.user_id,
    type: 'new_offer',
    title: 'New job offer in your area',
    body: `Payout ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(job.painter_payout_amount ?? 0)} · ZIP ${job.quote_zip}`,
    link: '/painter/projects',
  })
  await fetch(`${env.supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: painter.email,
      type: 'job_offer_available',
      data: {
        customerFirstName: first,
        zipCode: job.quote_zip,
        timelineLabel: job.project_summary?.timelineLabel ?? describeTiming(job),
        datesText: describeTiming(job),
        estimatedDays: job.estimated_days,
        customerPreferredDate: job.customer_preferred_date,
        payoutAmount: job.painter_payout_amount,
        acceptUrl: `${frontendUrl}/painter/accept-job?token=${job.claim_token}&painter_id=${painter.id}`,
        qa: job.project_summary?.qa ?? [],
        photos: job.photos ?? [],
      },
    }),
  }).catch((err) => console.error('offer email failed:', err))
}
