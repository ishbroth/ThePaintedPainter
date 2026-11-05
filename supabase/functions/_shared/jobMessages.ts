// In-app messaging between the customer and the painter of a confirmed job: the rules, kept free of any
// network or database code so the edge function (supabase/functions/job-messages) and the checks
// (scripts/jobMessagingChecks.ts) use exactly the same code.
//
// Who may message: only the two people on a job, only once BOTH have confirmed: the painter accepted the job,
// the customer chose the painter and paid the deposit, and the dates are agreed, which is `status = 'confirmed'`
// with a scheduled date (see CLAUDE.md and the job lifecycle). Before that, and for anyone else, nothing is
// readable or writable. An account that is not on the job gets "not found", never "forbidden", so job ids
// cannot be probed.

export const MAX_MESSAGE_LENGTH = 1000
/** At most this many messages from one person on one job inside the window below. */
export const RATE_LIMIT_COUNT = 20
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
/** A finished job's thread stays readable for this long, so nothing agreed in it is lost right after the work. */
export const READ_AFTER_COMPLETE_DAYS = 90

export type MessageRole = 'customer' | 'painter'

export interface JobForMessaging {
  id: string
  status: string
  scheduled_date: string | null
  customer_id: string | null
  customer_email: string | null
  accepted_by: string | null
  completed_at?: string | null
}

export interface CallerIdentity {
  userId: string
  /** The sign-in email, only when it has been confirmed (an unconfirmed address proves nothing). */
  confirmedEmail: string | null
}

/** Which side of the job the caller is on, or null when they are not on it at all. */
export function participantRole(job: JobForMessaging, caller: CallerIdentity, painterRowForCaller: { id: string } | null): MessageRole | null {
  if (painterRowForCaller && job.accepted_by && painterRowForCaller.id === job.accepted_by) return 'painter'
  if (job.customer_id && job.customer_id === caller.userId) return 'customer'
  // guest claims made before the customer had an account are matched by a confirmed email, as in get-my-projects
  if (!job.customer_id && caller.confirmedEmail && job.customer_email && job.customer_email.trim().toLowerCase() === caller.confirmedEmail.trim().toLowerCase()) return 'customer'
  return null
}

/** Both parties have confirmed and the job is on the schedule: the only time anyone can send. */
export function canSendMessages(job: JobForMessaging): boolean {
  return job.status === 'confirmed' && !!job.scheduled_date
}

/** The thread can be read while the job is confirmed, and for a while after it is completed. */
export function canReadMessages(job: JobForMessaging, now: Date = new Date()): boolean {
  if (canSendMessages(job)) return true
  if (job.status === 'completed') {
    if (!job.completed_at) return true
    return now.getTime() - new Date(job.completed_at).getTime() <= READ_AFTER_COMPLETE_DAYS * 86400000
  }
  return false
}

/**
 * Cleans what someone typed: plain text only. Control characters are dropped, line endings normalised, runs of blank
 * lines collapsed, and the ends trimmed. (The pages show messages as text, never as HTML, so angle brackets are
 * harmless and are kept as typed.) Returns null when nothing is left or it is too long.
 */
export function cleanMessageBody(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Write a message first.' }
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!text) return { ok: false, error: 'Write a message first.' }
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` }
  return { ok: true, body: text }
}

/** Has this person sent too many messages on this job lately? `recentSentAt` are the ISO times of their latest messages. */
export function isRateLimited(recentSentAt: string[], now: Date = new Date()): boolean {
  const since = now.getTime() - RATE_LIMIT_WINDOW_MS
  return recentSentAt.filter((t) => new Date(t).getTime() >= since).length >= RATE_LIMIT_COUNT
}

/** The one-line preview shown in the notification feed and the push (never the whole message). */
export function snippet(body: string, max = 110): string {
  const one = body.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`
}

/** Where a notification about a message takes the recipient: their projects page, with the thread opened. */
export function threadLink(recipient: MessageRole, jobId: string): string {
  return `/${recipient}/dashboard/projects?messages=${encodeURIComponent(jobId)}`
}

/** The first name shown in a notification title (or a fallback), so full names and contact details are not repeated there. */
export function firstName(full: string | null | undefined, fallback: string): string {
  const first = String(full ?? '').trim().split(/\s+/)[0]
  return first || fallback
}
