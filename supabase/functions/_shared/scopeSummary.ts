// The scope-of-work list a painter or customer reads (contract, offer emails, outreach invitations, the accept page): only what is
// actually part of this job.
//
// The estimator's answers are kept whole on the job, including answers about parts of the house the customer never talked about (an
// apartment's interior can still carry "Fence type" or "Exterior condition" because of how the interview's fields are initialised, and the
// AI sometimes fills fields in from nothing). Every list shown to a person goes through cleanScope() first, so an inside job never lists
// the fence, gutters or siding, an outside job never lists cabinets or ceilings, and "no", "none" and blank answers never show.
//
// Browser copy: src/lib/chatEstimator/scopeSummary.ts. Keep the two identical.

export interface ScopeItem {
  question: string
  answer: string
}

/** Labels that only make sense for work on the outside of a building. */
const OUTSIDE_ONLY = /^(exterior|siding|stucco|soffit|eave|fascia|gutter|downspout|fence|deck\b|overhang|patio|foundation|garage door|pressure.?wash|power.?wash|balcon|house body|access restrictions|railing(s| type)\b)/i
/** Labels that only make sense for work on the inside. */
const INSIDE_ONLY = /^(interior|inside surfaces|accent wall|ceiling|crown|wainscot|baseboard|cabinet|closet|stair|chair rail|popcorn|wallpaper|fireplace|wall texture|trim (condition|finish)|door finish)/i
/** Bookkeeping that is not scope. */
const NOT_SCOPE = /^(zip|state|answered|response|photo|contact|utilities$)/i
/** Answers that say nothing. */
const EMPTY_ANSWER = /^(no|none|n\/a|na|unknown|not sure|not specified|false|undefined|null|0|-)$/i

type Kind = 'inside' | 'outside' | 'both' | null

/** Inside, outside or both, from the "Project type" answer the estimator recorded (null when it is not there). */
function projectKind(items: ScopeItem[]): Kind {
  const type = items.find((i) => /^project type$/i.test(i.question.trim()))?.answer.trim().toLowerCase()
  if (type === 'interior') return 'inside'
  if (type === 'exterior') return 'outside'
  if (type === 'both') return 'both'
  return null
}

function tidy(answer: string): string {
  const a = answer.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return a.charAt(0).toUpperCase() + a.slice(1)
}

/** The items that belong to this job, in their original order, with blank, repeated and out-of-place ones removed. */
export function cleanScope(input: unknown, max = 30): ScopeItem[] {
  if (!Array.isArray(input)) return []
  const items: ScopeItem[] = []
  for (const raw of input) {
    const question = typeof raw?.question === 'string' ? raw.question.replace(/\s+/g, ' ').trim() : ''
    const answer = typeof raw?.answer === 'string' ? raw.answer.trim() : typeof raw?.answer === 'number' ? String(raw.answer) : ''
    if (question && answer) items.push({ question: question.slice(0, 200), answer: answer.slice(0, 400) })
  }
  const kind = projectKind(items)
  const seen = new Set<string>()
  const out: ScopeItem[] = []
  for (const item of items) {
    if (EMPTY_ANSWER.test(item.answer) || NOT_SCOPE.test(item.question)) continue
    if (kind === 'inside' && OUTSIDE_ONLY.test(item.question)) continue
    if (kind === 'outside' && INSIDE_ONLY.test(item.question)) continue
    const key = item.question.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ question: item.question, answer: tidy(item.answer) })
    if (out.length >= max) break
  }
  return out
}

/**
 * The customer's own messages worth quoting in a contract: real sentences about the job. Greetings, one-word replies, and anything with a
 * phone number or email address in it are left out.
 */
export function meaningfulWords(input: unknown, max = 6): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const line = raw.replace(/\s+/g, ' ').trim()
    if (line.split(' ').length < 4) continue
    if (/@|\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}/.test(line)) continue
    // a short acknowledgement ("ok thanks a lot"), not a sentence about the job
    if (/^(yes|no|yep|nope|ok|okay|sure|thanks|thank you|hi|hello|hey)\b/i.test(line) && line.split(' ').length < 7) continue
    out.push(line.slice(0, 300))
    if (out.length >= max) break
  }
  return out
}
