// A painter who has just been approved gets the jobs that were waiting for someone in their area.
//
// Jobs sit in status 'searching_painter' when a customer claimed a price where no approved painter was within range (or in
// 'needs_new_painter' when every painter offered a Mystery job declined, while the customer is still choosing). The first painter
// approved near that ZIP (and free on the customer's dates) is offered the job, exactly like any other offer: they get the same email
// and accept page. The job moves to 'offer_sent' so it shows as live to the customer.

import { getZipCoords, milesBetweenZips } from './geo.ts'
import { evaluateAvailability } from './availability.ts'
import { sendPainterOffer, type OfferJob } from './offers.ts'
import { estimateWorkingDays } from './duration.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any

const SERVICE_RADIUS_MILES = 50

export async function attachOpenJobsToPainter(
  supabase: Supabase,
  env: { supabaseUrl: string; serviceRoleKey: string },
  painterId: string,
): Promise<number> {
  const { data: painter } = await supabase
    .from('painters')
    .select('id, user_id, email, zip_code, status, verified, is_demo, leads_paused, paused_until, blackout_dates')
    .eq('id', painterId)
    .maybeSingle()
  if (!painter || painter.status !== 'approved' || !painter.verified || painter.is_demo) return 0

  const { data: jobs } = await supabase
    .from('quote_selections')
    .select('id, claim_token, quote_zip, customer_name, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, estimated_days, painter_payout_amount, guaranteed_price, project_summary, photos, notified_painters')
    .in('status', ['searching_painter', 'needs_new_painter'])
    .eq('selection_type', 'guaranteed')
    .order('offer_sent_at', { ascending: true })

  const coords = await getZipCoords(supabase, [painter.zip_code, ...(jobs ?? []).map((j: { quote_zip: string | null }) => j.quote_zip ?? '')])

  let attached = 0
  for (const job of jobs ?? []) {
    const distance = job.quote_zip ? milesBetweenZips(coords, job.quote_zip, painter.zip_code) : null
    if (distance === null || distance > SERVICE_RADIUS_MILES) continue
    const days = job.estimated_days ?? estimateWorkingDays(Number(job.guaranteed_price) || 0)
    const timing = { startDate: job.customer_start_date, endDate: job.customer_end_date, flexible: !!job.dates_flexible, timeline: job.timeline }
    if (!evaluateAvailability(painter, timing, days).show) continue
    // the first painter to be matched takes the job out of "searching"; the WHERE makes sure two approvals at once don't both do it
    // (a Mystery job whose painters all declined is also open: the customer's own pick-a-painter links stop working once someone takes it)
    const { data: updated } = await supabase
      .from('quote_selections')
      .update({ status: 'offer_sent', notified_painters: [...(job.notified_painters ?? []), painter.id], offer_sent_at: new Date().toISOString(), fallback_token: null, fallback_expires_at: null, fallback_suggestions: null })
      .eq('id', job.id)
      .in('status', ['searching_painter', 'needs_new_painter'])
      .select('id')
    if (!updated || updated.length === 0) continue
    await sendPainterOffer(supabase, env, job as OfferJob, painter)
    await supabase.from('outreach_leads').update({ status: 'signed_up' }).eq('job_id', job.id).ilike('email', painter.email)
    await supabase.from('outreach_companies').update({ signed_up: true }).ilike('email', painter.email)
    attached++
  }
  return attached
}
