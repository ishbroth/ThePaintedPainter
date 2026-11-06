// The scope-of-work list a painter or customer reads (contract, offer emails, outreach invitations, the accept page): what the customer
// actually talked about, and all of it.
//
// The estimator's answers are kept whole on the job, including answers the customer never gave (a field the interview initialises, or one
// the AI filled in from nothing, can still carry "Fence type" or "Exterior condition"). There is no rule about inside versus outside: a
// customer may want both, or three chairs and a fence. Instead, every specific piece of work in the list (a fence, a deck, cabinets,
// chairs, gutters, crown molding...) is shown only when there is evidence the job includes it:
//   - the customer mentioned it in their own messages, or
//   - it is a priced line in the job's price breakdown (and the customer did not take it off).
// General details (rooms, square feet, paint, condition, notes) are always shown. "No", "none", blank and repeated answers never show.
//
// Browser copy: src/lib/chatEstimator/scopeSummary.ts. Keep the two identical.

export interface ScopeItem {
  question: string
  answer: string
}

/** What shows the job includes something: the customer's own messages and the priced lines of the breakdown. */
export interface ScopeEvidence {
  conversation?: unknown
  breakdown?: unknown
}

/**
 * Specific pieces of work. `label` matches the list's question text; `said` matches how a customer (or a price line) would name the same
 * thing. An item whose label matches here is shown only when `said` matches the evidence. Anything that matches no label is general.
 * Order matters: the first label that matches decides (chair rail before chairs).
 */
const WORK: { label: RegExp; said: RegExp }[] = [
  { label: /^chair rail/i, said: /chair.?rail/i },
  { label: /^chair/i, said: /\bchairs?\b|furniture|stools?|seating/i },
  { label: /^(furniture|dresser|table|desk|bookcase)/i, said: /furniture|dresser|table|desk|bookcase|nightstand|bed\s?frame|chairs?\b|stools?/i },
  { label: /^fence/i, said: /\bfenc/i },
  { label: /^deck\b/i, said: /\bdeck|porch|patio/i },
  { label: /^(gutter|downspout)/i, said: /gutter|downspout/i },
  { label: /^(soffit|eave|fascia)/i, said: /soffit|eave|fascia/i },
  { label: /^overhang/i, said: /overhang|patio cover|carport|porch/i },
  { label: /^balcon/i, said: /balcon/i },
  { label: /^(siding|stucco|house body|exterior (scope|condition|color|body))/i, said: /exterior|outside|outdoor|siding|stucco|brick|facade|curb|whole house|entire house|front of (the |my )?house/i },
  { label: /^exterior trim/i, said: /exterior|outside|outdoor|trim|fascia|window frames?/i },
  { label: /^exterior shutter/i, said: /shutter/i },
  { label: /^exterior window/i, said: /window/i },
  { label: /^railing(s| type)\b|^exterior railing/i, said: /\brailing|banister|handrail/i },
  { label: /^garage door/i, said: /garage/i },
  { label: /^foundation/i, said: /foundation/i },
  { label: /^(pressure|power).?wash/i, said: /pressure|power.?wash/i },
  { label: /^(epoxy|garage floor)/i, said: /epoxy|garage/i },
  { label: /^brick/i, said: /brick/i },
  { label: /^cabinet/i, said: /cabinet|vanity|kitchen/i },
  { label: /^closet/i, said: /closet|pantry/i },
  { label: /^(stair|interior railing)/i, said: /stair|banister|railing|handrail/i },
  { label: /^(crown|molding)/i, said: /crown|molding|moulding/i },
  { label: /^wainscot/i, said: /wainscot/i },
  { label: /^accent wall/i, said: /accent/i },
  { label: /^popcorn/i, said: /popcorn|texture/i },
  { label: /^wallpaper/i, said: /wallpaper/i },
  { label: /^fireplace|^mantel/i, said: /fireplace|mantel|hearth/i },
  { label: /^beam/i, said: /beam/i },
  { label: /^built.?in/i, said: /built.?in|bookcase|shelv/i },
  { label: /^interior shutter/i, said: /shutter/i },
  { label: /^(doors? to paint|door count|doors?\b)/i, said: /\bdoors?\b/i },
  { label: /^(windows? to paint|window count)/i, said: /window/i },
]

/** Bookkeeping that is not scope. */
const NOT_SCOPE = /^(zip|state|answered|response|photo|contact|utilities$)/i
/** Answers that say nothing. */
const EMPTY_ANSWER = /^(no|none|n\/a|na|unknown|not sure|not specified|false|undefined|null|0|-)$/i

function tidy(answer: string): string {
  const a = answer.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return a.charAt(0).toUpperCase() + a.slice(1)
}

/** Everything that shows what is in the job, lowercased: the customer's messages and the priced lines they did not take off. */
function haystack(evidence?: ScopeEvidence): string {
  const parts: string[] = []
  if (Array.isArray(evidence?.conversation)) for (const l of evidence.conversation) if (typeof l === 'string') parts.push(l)
  if (Array.isArray(evidence?.breakdown)) {
    for (const l of evidence.breakdown) {
      if (l && typeof l.description === 'string' && !l.removed) parts.push(l.description)
    }
  }
  return parts.join(' \n ').toLowerCase()
}

/**
 * The items that belong to this job, in their original order. Specific pieces of work stay only when the customer talked about them or
 * they are priced in the job; without any evidence to check against (nothing was passed), nothing is dropped for lack of it.
 */
export function cleanScope(input: unknown, evidence?: ScopeEvidence, max = 40): ScopeItem[] {
  if (!Array.isArray(input)) return []
  const hay = haystack(evidence)
  const seen = new Set<string>()
  const out: ScopeItem[] = []
  for (const raw of input) {
    const question = typeof raw?.question === 'string' ? raw.question.replace(/\s+/g, ' ').trim() : ''
    const answer = typeof raw?.answer === 'string' ? raw.answer.trim() : typeof raw?.answer === 'number' ? String(raw.answer) : ''
    if (!question || !answer || EMPTY_ANSWER.test(answer) || NOT_SCOPE.test(question)) continue
    if (hay) {
      const work = WORK.find((w) => w.label.test(question))
      if (work && !work.said.test(hay)) continue
    }
    const key = question.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ question: question.slice(0, 200), answer: tidy(answer).slice(0, 400) })
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
