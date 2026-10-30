// Who gets the next outreach invitation: the rotation.
//
// Pure logic (no database, no Deno), so it can be tested on its own. Every company that has been invited keeps a count of how many times,
// and a company is invited for one job at a time, up to the limit for that job (12). The order of preference:
//
//   1. In progress: invited, but fewer than GIVE_UP_AFTER times since they last came round, and no response (they have not signed up or
//      unsubscribed: those two leave the rotation before this is called). The same companies are invited again, so a group of 12 where 3
//      sign up leaves 9 who are invited again, with 3 new companies filling the places. The ones closest to their last turn go first.
//   2. Fresh: never invited. Nearest to the customer first.
//   3. Rotated out: invited GIVE_UP_AFTER times with no response. Not dropped (they stay in the directory) but only used once there is
//      nobody else left in the area; then they start a new round of GIVE_UP_AFTER invitations.
//
// There is no waiting period between invitations: the next job in the area uses the same rotation straight away. A company is never
// invited twice for the same job (the invitation log prevents it).
// Companies that signed up or unsubscribed are filtered out before this is called.

export const GIVE_UP_AFTER = 3

export interface Candidate {
  id: string
  /** Invitations sent to this company, ever. */
  inviteCount: number
  lastInvitedAt: string | null
  /** Miles from the customer. */
  distance: number
}

export type Tier = 'in_progress' | 'fresh' | 'rotated_out'

/** How far through its current round of invitations a company is: 0 = not started or just finished a round. */
export const roundProgress = (inviteCount: number): number => inviteCount % GIVE_UP_AFTER

export function tierOf(c: Candidate): Tier {
  if (c.inviteCount === 0) return 'fresh'
  return roundProgress(c.inviteCount) === 0 ? 'rotated_out' : 'in_progress'
}

/** Candidates in the order they should be invited, each with the tier that put them there. */
export function orderCandidates(candidates: Candidate[]): (Candidate & { tier: Tier })[] {
  const rank: Record<Tier, number> = { in_progress: 0, fresh: 1, rotated_out: 2 }
  const lastMs = (c: Candidate) => (c.lastInvitedAt ? new Date(c.lastInvitedAt).getTime() : -Infinity)
  return candidates
    .map((c) => ({ ...c, tier: tierOf(c) }))
    .sort((a, b) => {
      if (rank[a.tier] !== rank[b.tier]) return rank[a.tier] - rank[b.tier]
      if (a.tier === 'in_progress') return roundProgress(b.inviteCount) - roundProgress(a.inviteCount) || a.distance - b.distance
      if (a.tier === 'rotated_out') return lastMs(a) - lastMs(b) || a.distance - b.distance // whoever waited longest comes back first
      return a.distance - b.distance
    })
}
