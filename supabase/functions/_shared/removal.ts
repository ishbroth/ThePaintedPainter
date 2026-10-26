// Taking painters out of the network, and recognising one who comes back.
//
// removePainter() is the single way a painter is removed (automatically after repeated low reviews, or by the
// owner from the admin page): status 'removed', gone from the map / results / offers, a snapshot kept in
// removed_painters, the painter and the owner emailed.
//
// findPreviousRemoval() is used when someone applies: if their name, address, phone number or license number
// matches a painter removed earlier, the owner's application email says so.

import { notify } from './notify.ts'
import { ADMIN_EMAIL, buildReviewUrl } from './adminLink.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any

/** A review at or below this many stars is a "low review". */
export const BAD_REVIEW_MAX_RATING = 2
/**
 * A painter is removed when BOTH hold: at least BAD_REVIEWS_MIN low reviews, and low reviews are at least 3 out of every 10 of all their
 * reviews. So 3 low reviews out of 11 is not enough (27%), 6 out of 20 is (30%), and 2 low reviews out of 5 isn't yet, because the
 * third hasn't happened. With 50 reviews, 14 low ones are still fine and 15 are not.
 */
export const BAD_REVIEWS_MIN = 3
export const BAD_SHARE_NUMERATOR = 3
export const BAD_SHARE_DENOMINATOR = 10

/** True when this many low reviews out of this many in total is grounds for removal. */
export function overRemovalLine(bad: number, total: number): boolean {
  return bad >= BAD_REVIEWS_MIN && bad * BAD_SHARE_DENOMINATOR >= total * BAD_SHARE_NUMERATOR
}

/** How many more low reviews, with nothing good in between, would put a painter over the line (0 = already over). */
export function lowReviewsUntilRemoval(bad: number, total: number): number {
  let k = 0
  while (!overRemovalLine(bad + k, total + k)) k++
  return k
}

const key = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const phoneKey = (s: unknown) => String(s ?? '').replace(/\D/g, '').slice(-10)

export interface Identity {
  company_name?: string | null
  owner_name?: string | null
  email?: string | null
  phone?: string | null
  street_address?: string | null
  zip_code?: string | null
  license_number?: string | null
}

function keysFor(p: Identity) {
  const street = key(p.street_address)
  return {
    company_key: key(p.company_name) || null,
    owner_key: key(p.owner_name) || null,
    phone_key: phoneKey(p.phone).length >= 7 ? phoneKey(p.phone) : null,
    address_key: street && key(p.zip_code) ? `${street}|${String(p.zip_code).trim().slice(0, 5)}` : null,
    license_key: key(p.license_number).length >= 4 ? key(p.license_number) : null,
  }
}

/** A sentence for the owner if this applicant matches someone removed earlier, otherwise null. */
export async function findPreviousRemoval(supabase: Supabase, applicant: Identity): Promise<string | null> {
  const k = keysFor(applicant)
  const checks: [string, string | null, string][] = [
    ['phone number', k.phone_key, 'phone_key'],
    ['license number', k.license_key, 'license_key'],
    ['street address', k.address_key, 'address_key'],
    ['owner name', k.owner_key && k.owner_key.length >= 6 ? k.owner_key : null, 'owner_key'],
    ['company name', k.company_key && k.company_key.length >= 6 ? k.company_key : null, 'company_key'],
  ]
  const hits: string[] = []
  let first: { company_name: string | null; removed_at: string; reason: string } | null = null
  for (const [label, value, column] of checks) {
    if (!value) continue
    const { data } = await supabase
      .from('removed_painters')
      .select('company_name, removed_at, reason')
      .eq(column, value)
      .order('removed_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      hits.push(label)
      first = first ?? data[0]
    }
  }
  if (!first) return null
  const when = new Date(first.removed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const why = first.reason === 'bad_reviews' ? 'after repeated low reviews' : 'by you'
  const weak = hits.every((h) => h === 'owner name' || h === 'company name')
  return `Matches "${first.company_name ?? 'a painter'}", removed ${when} ${why}. Same ${hits.join(', ')}.${weak ? ' Only the name matches, and names can coincide, so check the rest.' : ''}`
}

export async function removePainter(
  supabase: Supabase,
  env: { supabaseUrl: string; serviceRoleKey: string },
  painter: Identity & { id: string; user_id: string | null },
  reason: 'bad_reviews' | 'admin',
  details: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('painters')
    .update({ status: 'removed', verified: false, removed_at: now, removal_reason: reason })
    .eq('id', painter.id)
  if (error) throw error

  await supabase.from('removed_painters').insert({
    painter_id: painter.id,
    reason,
    details,
    company_name: painter.company_name ?? null,
    owner_name: painter.owner_name ?? null,
    email: painter.email ?? null,
    ...keysFor(painter),
  })

  // Jobs they still hold (the owner decides what to do with them).
  const { data: open } = await supabase
    .from('quote_selections')
    .select('phase_label, customer_name, status, scheduled_date, quote_zip')
    .eq('accepted_by', painter.id)
    .in('status', ['painter_accepted', 'confirmed'])
  const activeJobs = (open ?? []).map((j: { phase_label: string | null; customer_name: string | null; status: string; scheduled_date: string | null; quote_zip: string | null }) =>
    `${j.phase_label || 'Painting job'} for ${j.customer_name || 'a customer'} in ${j.quote_zip ?? '?'} (${j.status.replace('_', ' ')}${j.scheduled_date ? `, ${j.scheduled_date}` : ''})`)

  const send = (to: string, type: string, data: Record<string, unknown>) =>
    fetch(`${env.supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, data }),
    }).catch((err) => console.error(`${type} email failed:`, err))

  await Promise.all([
    painter.email ? send(painter.email, 'painter_removed', { ownerName: painter.owner_name, companyName: painter.company_name, reason }) : null,
    send(ADMIN_EMAIL(), 'painter_removed_admin', { companyName: painter.company_name, reason, details, activeJobs }),
  ])
  await notify(supabase, {
    userId: painter.user_id,
    type: 'removed_from_network',
    title: 'You have been removed from the network',
    body: reason === 'bad_reviews' ? 'After several low customer reviews your account was removed. Reply to our email if you think this was a mistake.' : 'Your account was removed. Reply to our email if you think this was a mistake.',
    link: '/painter/dashboard',
  })
}

/** Counts a painter's low reviews and removes them (once) at the limit. Returns the count. */
export async function checkLowReviews(
  supabase: Supabase,
  env: { supabaseUrl: string; serviceRoleKey: string },
  painter: Identity & { id: string; user_id: string },
  latest: { rating: number; reviewerName: string; title?: string | null; body?: string | null },
): Promise<number> {
  if (latest.rating > BAD_REVIEW_MAX_RATING) return 0
  const { count } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('painter_id', painter.user_id)
    .lte('rating', BAD_REVIEW_MAX_RATING)
  const badCount = count ?? 0
  const { count: allCount } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('painter_id', painter.user_id)
  const totalCount = Math.max(allCount ?? 0, badCount)

  const { data: row } = await supabase.from('painters').select('status, is_demo').eq('id', painter.id).maybeSingle()
  if (!row || row.is_demo) return badCount // demonstration painters are never removed

  const willRemove = overRemovalLine(badCount, totalCount) && row.status !== 'removed'
  await fetch(`${env.supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: ADMIN_EMAIL(),
      type: 'painter_bad_review_admin',
      data: {
        companyName: painter.company_name, rating: latest.rating, reviewerName: latest.reviewerName,
        title: latest.title ?? null, body: latest.body ?? null, badCount, totalCount, moreToGo: lowReviewsUntilRemoval(badCount, totalCount),
        manageUrl: await buildReviewUrl(painter.id),
      },
    }),
  }).catch((err) => console.error('low review alert failed:', err))

  if (willRemove) {
    await removePainter(supabase, env, painter, 'bad_reviews', `${badCount} of ${totalCount} reviews were ${BAD_REVIEW_MAX_RATING} stars or fewer (${Math.round((badCount / totalCount) * 100)}%).`)
  }
  return badCount
}
