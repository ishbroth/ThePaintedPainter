// Painter rewards program: milestones for completed jobs and for good reviews.
//
// awardAchievements() is idempotent. It counts what the painter has actually
// done, inserts any milestone not yet recorded, and sends a notification only
// for the ones that are new. Call it after a job is completed, after a review
// arrives, and as a backfill when the Rewards page loads.
//
// Reviews count toward milestones only at 2 stars or more; a 1-star review
// instead prompts the painter to follow up with the customer (see submit-review).

import { notify } from './notify.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any

export const JOB_MILESTONES = [5, 15, 30, 100]
export const REVIEW_MILESTONES = [1, 5, 15, 50]
/** Reviews at or below this rating trigger a "try to resolve it" prompt and don't count toward rewards. */
export const LOW_REVIEW_MAX_RATING = 1

export async function awardAchievements(
  supabase: Supabase,
  painter: { id: string; user_id: string },
): Promise<{ kind: string; threshold: number }[]> {
  const [jobsRes, reviewsRes, existingRes] = await Promise.all([
    supabase.from('quote_selections').select('id', { count: 'exact', head: true })
      .eq('accepted_by', painter.id).eq('status', 'completed'),
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .eq('painter_id', painter.user_id).gt('rating', LOW_REVIEW_MAX_RATING),
    supabase.from('painter_achievements').select('kind, threshold').eq('painter_id', painter.id),
  ])

  const jobs = jobsRes.count ?? 0
  const reviews = reviewsRes.count ?? 0
  const have = new Set(((existingRes.data ?? []) as { kind: string; threshold: number }[]).map((a) => `${a.kind}:${a.threshold}`))

  const fresh: { kind: string; threshold: number }[] = []
  for (const t of JOB_MILESTONES) if (jobs >= t && !have.has(`jobs:${t}`)) fresh.push({ kind: 'jobs', threshold: t })
  for (const t of REVIEW_MILESTONES) if (reviews >= t && !have.has(`reviews:${t}`)) fresh.push({ kind: 'reviews', threshold: t })
  if (fresh.length === 0) return []

  // ignoreDuplicates + select: only rows this call actually created come back,
  // so two concurrent calls can't both announce the same achievement.
  const { data: inserted, error } = await supabase
    .from('painter_achievements')
    .upsert(fresh.map((f) => ({ painter_id: painter.id, ...f })), { onConflict: 'painter_id,kind,threshold', ignoreDuplicates: true })
    .select('kind, threshold')
  if (error) {
    console.error('awardAchievements: insert failed', error)
    return []
  }

  for (const a of (inserted ?? []) as { kind: string; threshold: number }[]) {
    await notify(supabase, {
      userId: painter.user_id,
      type: 'achievement',
      title: a.kind === 'jobs'
        ? `Achievement unlocked: ${a.threshold} jobs completed`
        : `Achievement unlocked: ${a.threshold} ${a.threshold === 1 ? 'review' : 'reviews'} earned`,
      body: 'Nice work — see your badges on the Rewards page.',
      link: '/painter/dashboard/rewards',
    })
  }
  return (inserted ?? []) as { kind: string; threshold: number }[]
}
