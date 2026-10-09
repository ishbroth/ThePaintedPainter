// The customer's own words from the estimator chat: cleaned for storage, checked again on the server, and summarized for painters.
//
// Painters see every reply the customer typed, in order, with the job. That way, if a conversation slips past the checks in the
// browser, the painter can read it and decide for themselves. The same word lists as the browser's conversationReview.ts apply
// when a price is claimed, so a claim can't be pushed through by skipping the browser.

const MAX_MESSAGES = 80
const MAX_LENGTH = 500

const STRONG = new Set([
  'fuck', 'fucker', 'fucking', 'fucked', 'fck', 'fuk', 'motherfucker', 'shit', 'shithead', 'bullshit', 'bitch', 'bitches', 'asshole', 'assholes',
  'dumbass', 'jackass', 'cunt', 'dick', 'dickhead', 'prick', 'whore', 'slut', 'bastard', 'retard', 'retarded', 'faggot', 'nigger', 'nigga',
  'piss', 'pissed', 'wtf', 'stfu', 'gtfo',
])
const MILD = new Set(['damn', 'dammit', 'goddamn', 'hell', 'crap', 'ass', 'idiot', 'stupid', 'dumb', 'suck', 'sucks', 'moron', 'screw'])
const INSULTS = [/\byour (mom|mother|momma|mama|mum)\b/i, /\byou (suck|are stupid|are dumb|idiot|moron)\b/i, /\b(shut up|go to hell|piss off|screw you|f+u+c+k+ (you|off))\b/i]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/5/g, 's').replace(/!/g, 'i')
    .replace(/[*#%^+_.\-]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1')
}

export function scanProfanity(text: string): { strong: number; mild: number; insult: boolean } {
  const n = normalize(text)
  let strong = 0
  let mild = 0
  for (const w of n.split(/[^a-z]+/).filter(Boolean)) {
    if (STRONG.has(w) || STRONG.has(w.replace(/(.)\1/g, '$1'))) strong++
    else if (MILD.has(w)) mild++
  }
  return { strong, mild, insult: INSULTS.some((re) => re.test(text) || re.test(n)) }
}

/** A list of the customer's replies, safe to store: strings only, trimmed, capped. */
export function cleanConversation(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((m): m is string => typeof m === 'string')
    .map((m) => m.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH))
    .filter(Boolean)
    .slice(-MAX_MESSAGES)
}

/** True when the conversation should not be turned into a job offer at all. */
export function conversationRejected(messages: string[]): boolean {
  let strong = 0
  let mild = 0
  let insulted = false
  for (const m of messages) {
    const s = scanProfanity(m)
    strong += s.strong
    mild += s.mild
    if (s.insult) insulted = true
  }
  return strong > 0 || insulted || mild >= 3
}

/** A one-line heads-up for painters when the replies include rough language (below the level that is rejected outright). */
export function conversationNote(messages: string[]): string | null {
  const rough = messages.filter((m) => {
    const s = scanProfanity(m)
    return s.strong > 0 || s.mild > 0 || s.insult
  }).length
  return rough > 0 ? `${rough} of the customer's ${messages.length} replies include rough language. Read them below before you decide.` : null
}
