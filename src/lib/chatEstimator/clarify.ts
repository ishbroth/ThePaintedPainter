// ============================================================================
// Asking instead of assuming
// ============================================================================
// When a reply doesn't fit the question, or the customer pushes back ("I never said trim"), the estimator must not
// quietly pick a default and move on. It says what it understood so far and asks what they meant.
// ============================================================================

import type { ChatMessage } from './chatEngine';

/** "I never said that", "that's not what I said", "no I said...", "you assumed...": the customer is disputing what the bot did. */
const DENIAL =
  /\b(?:i\s+(?:never|didn'?t|did\s+not|haven'?t|have\s+not|don'?t\s+recall)\s+(?:say|said|mention|mentioned|tell|told|ask|asked|want)\b|(?:that'?s|thats|that\s+is|this\s+is|it'?s)\s+not\s+(?:what|right|correct|true|it)\b|not\s+what\s+i\s+(?:said|meant|asked)|no,?\s+i\s+(?:said|meant|just\s+said)|you\s+(?:assumed|misunderstood|got\s+(?:that|it)\s+wrong|keep\s+(?:assuming|ignoring))|stop\s+assuming|that'?s\s+wrong|i\s+said\s+(?:no|nothing)|where\s+did\s+you\s+get\s+that)/i;

export function isDenial(text: string): boolean {
  if (/\b(?:nothing|no|not)\s+wrong\b/i.test(text)) return false;
  return DENIAL.test(text);
}

/** The denial points at what's being painted ("I didn't say walls only", "first you need to know what we're painting"). */
export function denialIsAboutScope(text: string): boolean {
  return /\b(walls?|ceilings?|trim|baseboards?|doors?|surfaces?|what\s+(?:we'?re|i'?m|are\s+we|am\s+i|we\s+are)\s+painting|painting|scope)\b/i.test(text);
}

/** "renting" alone could be a tenant or a landlord. */
export function isAmbiguousRenting(text: string): boolean {
  return /^\s*(?:i'?m\s+|we'?re\s+|we\s+|i\s+)?rent(?:ing)?(?:\s+(?:it|here|this|this\s+place|the\s+place))?\s*[.!]?\s*$/i.test(text);
}

const TOPIC_LABEL: Record<string, string> = {
  project_type: 'whether this is inside, outside or both',
  which_rooms: 'which rooms are being painted',
  room_size: 'the size of the room',
  house_size: 'the size of the place',
  surfaces: 'what gets painted (walls, ceilings, trim, doors)',
  trim_scope: 'what the trim includes',
  condition: 'the condition of the surfaces',
  popcorn_extent: 'how much popcorn ceiling there is',
  property_ownership: 'whether you live there, rent it, or rent it out',
  commercial_access: 'when the crew can work in the business',
  color_change: 'the paint color',
  color_scope_clarify: 'how many colors',
  reno_context: 'where the other work stands',
  siding: 'what the outside is made of',
  stories: 'how many stories',
  location: 'the ZIP code',
  timeline_and_access: 'your timing and whether the place is occupied',
};

export function topicLabel(id: string | null | undefined): string {
  return (id && TOPIC_LABEL[id]) || 'that';
}

/**
 * The last few things the estimator actually understood, newest last, taken from what it acknowledged after each
 * earlier customer message ("3 bedrooms", "1,200 sqft", "rental property"...).
 */
export function recentRecognized(history: ChatMessage[], max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...history].reverse()) {
    if (m.role !== 'user' || !m.ackChips) continue;
    for (const chip of [...m.ackChips].reverse()) {
      const clean = chip.replace(/^\s+|\s+$/g, '');
      const key = clean.toLowerCase().replace(/,/g, '');
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
      if (out.length >= max) return out.reverse();
    }
  }
  return out.reverse();
}

export function recapSentence(items: string[]): string {
  if (items.length === 0) return '';
  return `Here's what I have so far: ${items.map((i) => `“${i}”`).join(', ')}.`;
}
