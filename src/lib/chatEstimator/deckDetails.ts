// ============================================================================
// Deck details, read from whatever the customer says
// ============================================================================
// How high the deck is, whether the underside is painted, whether it has railings and what shape the wood is in. Read from an answer to the
// matching question ("on the ground", "yes, the underside too") and from a message that volunteers it ("second-story deck, railings, underside
// painting"), so nothing the customer already said is asked again, and nothing about the deck is ever read as being about the house.
// ============================================================================

import type { EstimatorContext } from '../types';

export interface DeckReading {
  patch: Partial<EstimatorContext>;
  acks: string[];
}

const YES = /^\W*(?:yes|yeah|yep|yup|sure|please|definitely|absolutely|both|all of it|everything|that too|do it|of course)\b/;
const NO = /^\W*(?:no|nope|nah|none|not (?:needed|really)|skip|pass|just the top|top only|only the top)\b/;

/** A deck's level, from words (or a height in feet): '' when the message says nothing about it. */
function levelFrom(low: string, asked: boolean): 'ground' | 'raised' | 'second_story' | '' {
  if (/\b(?:second|2nd|upper|top|third|3rd)[\s-]*(?:story|floor|level)\b|\b(?:two|2)[\s-]*stor(?:y|ey)\s+(?:deck|balcon)|\boff (?:of )?the (?:second|2nd|upper) (?:story|floor)\b|\bdeck (?:on|off) the (?:second|2nd|upper)\b/.test(low)) return 'second_story';
  const feet = low.match(/\b(\d{1,2})\s*(?:-|\s)?(?:f(?:oo|ee)?t|')\s*(?:up|high|off the ground|above)\b|\b(\d{1,2})\s*(?:-|\s)?(?:f(?:oo|ee)?t|')\s*(?:tall|high)\s+deck\b/);
  if (feet) {
    const n = parseInt(feet[1] ?? feet[2], 10);
    if (n >= 9) return 'second_story';
    if (n >= 2) return 'raised';
  }
  if (/\b(?:ground[\s-]*level|on the ground|at ground|flush with the ground|low[\s-]*(?:to[\s-]*the[\s-]*ground )?deck|sits? (?:right )?on the ground|slab|patio[\s-]*level|ground floor|first floor|one level|single level)\b/.test(low)) return 'ground';
  if (/\b(?:raised|elevated|stilts|off the ground|walk (?:under|beneath)|crawl (?:under|beneath)|above the ground|up (?:off|high)|few feet (?:up|off)|several feet|cantilever|hillside|sloped?|built up)\b/.test(low)) return 'raised';
  if (asked) {
    if (/^\W*(?:ground|low|level)\b/.test(low)) return 'ground';
    if (/^\W*(?:raised|up|high|elevated|above)\b/.test(low)) return 'raised';
    if (/^\W*(?:second|2nd|upstairs|upper)\b/.test(low)) return 'second_story';
  }
  return '';
}

export function readDeckDetails(text: string, ctx: EstimatorContext, askedId: string | null): DeckReading {
  const patch: Partial<EstimatorContext> = {};
  const acks: string[] = [];
  const low = text.toLowerCase();
  const mentionsDeck = /\b(?:decks?|decking|porch|balcony|balconies)\b/.test(low);
  const aboutDeck = !!askedId && askedId.startsWith('ext_deck');
  // only when the deck is what is being talked about: a bare "railings" or "peeling" in some other answer is not about it
  if (ctx.deck !== 'yes' && !mentionsDeck) return { patch, acks };
  if (!mentionsDeck && !aboutDeck && askedId !== 'wrapup') return { patch, acks };
  const question = text.trim().endsWith('?');
  if (question) return { patch, acks };

  // ----- height -----
  const level = !ctx.deckLevel ? levelFrom(low, askedId === 'ext_deck_level') : '';
  if (level) {
    patch.deckLevel = level;
    acks.push(level === 'ground' ? 'ground-level deck' : level === 'second_story' ? 'second-story deck' : 'raised deck');
  }
  const effectiveLevel = ctx.deckLevel || level;

  // ----- underside -----
  if (!ctx.deckUnderside) {
    const saysUnderside = /\bunder\s?side\b|\bunderneath\b|\bbeneath\b|\bjoists?\b|\bbottom of the deck\b|\bbelow the deck\b|\bunder the deck\b/.test(low);
    const negated = /\b(?:no|not|without|skip|don'?t|doesn'?t|won'?t|leave)\b[^.,;]{0,25}\b(?:under\s?side|underneath|beneath|joists?|under the deck)\b|\b(?:just|only)\s+(?:the\s+)?(?:top|surface)\b|\btop(?:\s+side)?\s+only\b|\bone side\b/.test(low);
    if (saysUnderside) {
      patch.deckUnderside = negated ? 'no' : 'yes';
      if (!negated) acks.push('underside painted');
      // an underside only exists on a raised deck
      if (!negated && !effectiveLevel) patch.deckLevel = 'raised';
    } else if (askedId === 'ext_deck_underside') {
      if (YES.test(low)) { patch.deckUnderside = 'yes'; acks.push('underside painted'); }
      else if (NO.test(low) || /\b(?:just|only)\b.*\b(?:top|surface)\b/.test(low)) patch.deckUnderside = 'no';
    } else if (effectiveLevel === 'ground') {
      patch.deckUnderside = 'no'; // a deck on the ground has no underside to reach
    } else if (negated && /\b(?:just|only|top)\b/.test(low) && mentionsDeck) {
      patch.deckUnderside = 'no';
    }
  }

  // ----- railings -----
  if (ctx.railings === 'none') {
    const rail = /\brail(?:ing)?s?\b|\bbalusters?\b|\bspindles?\b|\bbanisters?\b/.test(low);
    const noRail = /\b(?:no|without|doesn'?t have|don'?t have|not have|none)\b[^.,;]{0,20}\brail(?:ing)?s?\b|\brail(?:ing)?s?\b[^.,;]{0,15}\b(?:no|none|aren'?t|isn'?t|not)\b/.test(low);
    if (rail && !noRail) {
      patch.railings = 'yes';
      patch.railingType = /\b(?:spindles?|balusters?|pickets?)\b/.test(low) ? 'spindles' : ctx.railingType || 'simple';
      acks.push('deck railings');
    } else if (aboutDeck && askedId === 'ext_deck_railings' && !noRail) {
      if (YES.test(low)) { patch.railings = 'yes'; patch.railingType = ctx.railingType || 'simple'; acks.push('deck railings'); }
    }
  }

  // ----- condition -----
  if (!ctx.deckCondition && (mentionsDeck || askedId === 'ext_deck_condition')) {
    let cond: '' | 'good' | 'weathered' | 'peeling' | 'rotted' = '';
    if (/\b(?:rot|rotted|rotten|rotting|dry[\s-]rot|soft (?:spots?|boards?|wood)|termites?|damaged (?:boards?|wood)|broken boards?|replace (?:some )?boards?|splintered|splitting boards?)\b/.test(low)) cond = 'rotted';
    else if (/\b(?:peel(?:ing|ed|s)?|flak(?:ing|ed|y)|chipp(?:ing|ed)|blister(?:ing|ed)?|bubbl(?:ing|ed)|failing|crack(?:ing|ed)\s+(?:paint|stain|finish)|stripped back|needs? (?:to be )?stripp?ed)\b/.test(low)) cond = 'peeling';
    else if (/\b(?:weathered|gr[ae]y(?:ed|ing)?|bare(?:\s+wood)?|raw|unfinished|never (?:been )?(?:stained|painted|sealed|treated)|sun[\s-]?bleached|dried out|dry)\b/.test(low) && !/\bgray\s+(?:paint|stain)\b/.test(low)) cond = 'weathered';
    else if (/\b(?:good|great|fine|solid|sound|excellent|decent|okay|ok|faded|worn|pretty good|new|recently|well[\s-]kept|maintained|clean)\b/.test(low) && (askedId === 'ext_deck_condition' || /\bdeck\b[^.,;]{0,30}\b(?:good|great|fine|solid|sound|excellent|decent|faded|worn|new)\b|\b(?:good|great|fine|solid|sound|excellent|decent|faded|worn|new)\b[^.,;]{0,20}\bdeck\b/.test(low))) cond = 'good';
    if (cond) {
      patch.deckCondition = cond;
      acks.push(cond === 'good' ? 'deck in good shape' : cond === 'weathered' ? 'weathered deck' : cond === 'peeling' ? 'peeling deck finish' : 'rotted deck boards');
    }
  }
  return { patch, acks };
}

/** Whether a message is about a deck, balcony or porch rather than the house: its height ("second-story") must not become the house's stories. */
export function isDeckTalk(text: string): boolean {
  const low = text.toLowerCase();
  if (!/\b(?:decks?|decking|porch|balcony|balconies|underside|underneath)\b/.test(low)) return false;
  return !/\b(?:my|the|our)\s+(?:house|home)\b|\bsiding\b|\bstucco\b|\bwhole (?:house|exterior)\b|\bhouse exterior\b|\bexterior (?:of|paint)\b/.test(low);
}
