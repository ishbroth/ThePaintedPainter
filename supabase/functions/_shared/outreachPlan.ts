// Who gets the next outreach invitation: the rotation.
//
// Pure logic (no database, no Deno), so it can be tested on its own. The order of preference:
//
//   1. Fresh: invited fewer than GIVE_UP_AFTER times, and not invited in the last COOLDOWN_DAYS. The ones invited least go first, then the
//      ones invited longest ago, then the nearest to the customer. Companies never invited come before everyone else.
//   2. Cooling down: invited fewer than GIVE_UP_AFTER times but within the last COOLDOWN_DAYS. Used only when there are not enough fresh
//      companies to fill the invitations, so the 7-day rest applies whenever the area has enough companies to rotate through.
//   3. Moved on: invited GIVE_UP_AFTER or more times without ever signing up. Not dropped (they stay in the directory and come back
//      round), but only used when nobody else is left.
//
// Nobody is invited twice within MIN_GAP_HOURS, however few companies there are, so several jobs at once cannot pile onto one company.
// Companies that signed up or unsubscribed are filtered out before this is called.

export const COOLDOWN_DAYS = 7
export const GIVE_UP_AFTER = 5
export const MIN_GAP_HOURS = 24

export interface Candidate {
  id: string
  inviteCount: number
  lastInvitedAt: string | null
  /** Miles from the customer. */
  distance: number
}

export type Tier = 'fresh' | 'cooling' | 'moved_on'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function tierOf(c: Candidate, now: number): Tier | null {
  const last = c.lastInvitedAt ? new Date(c.lastInvitedAt).getTime() : null
  if (last !== null && now - last < MIN_GAP_HOURS * HOUR) return null
  if (c.inviteCount >= GIVE_UP_AFTER) return 'moved_on'
  if (last !== null && now - last < COOLDOWN_DAYS * DAY) return 'cooling'
  return 'fresh'
}

/** Candidates in the order they should be invited, each with the tier that put them there. Anyone invited in the last day is left out. */
export function orderCandidates(candidates: Candidate[], now: number = Date.now()): (Candidate & { tier: Tier })[] {
  const rank: Record<Tier, number> = { fresh: 0, cooling: 1, moved_on: 2 }
  const lastMs = (c: Candidate) => (c.lastInvitedAt ? new Date(c.lastInvitedAt).getTime() : -Infinity) // never invited sorts first
  return candidates
    .map((c) => ({ ...c, tier: tierOf(c, now) }))
    .filter((c): c is Candidate & { tier: Tier } => c.tier !== null)
    .sort((a, b) =>
      rank[a.tier] - rank[b.tier] ||
      a.inviteCount - b.inviteCount ||
      lastMs(a) - lastMs(b) ||
      a.distance - b.distance)
}
