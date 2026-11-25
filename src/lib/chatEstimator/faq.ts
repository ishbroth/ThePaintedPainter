// ============================================================================
// Answering what the customer asks along the way
// ============================================================================
// A real estimator answers "do you bring the paint?" or "how long will it take?" on the spot and then picks the conversation back up. The
// estimator used to skip any question it had no canned line for and just ask its next one. These are the questions customers actually ask
// mid-estimate; each gets a short, true answer and the engine then repeats the question that was pending.
//
// Only real questions are answered (a question mark, or a question opener): "I'll provide the paint" is a statement about the job, not a
// question, and is left to the normal readers.
// ============================================================================

import type { EstimatorContext } from '../types';

const QUESTION_OPENER = /^\s*(?:and\s+|also\s+|so\s+|but\s+|quick question[,:]?\s*)?(?:do|does|did|can|could|will|would|is|are|how|what|what's|whats|who|when|where|should|am i|do i|will i|would i|can i)\b/i;

export function looksLikeQuestion(text: string): boolean {
  return text.trim().endsWith('?') || QUESTION_OPENER.test(text);
}

interface Faq {
  key: string;
  re: RegExp;
  answer: (ctx: EstimatorContext) => string;
}

/** About how long the painting itself takes, from what is known so far (a range, never a promise). */
function durationFor(ctx: EstimatorContext): string {
  const outside = ctx.projectType === 'exterior';
  const sqft = ctx.squareFeet ?? 0;
  if (ctx.itemsOnly) return 'Furniture is usually a day or two per batch, longer if it needs stripping or several coats to dry.';
  if (outside) return 'An average house exterior is usually 3 to 7 days, weather permitting; a smaller one can be a couple of days.';
  if (ctx.interiorScope === 'specific_rooms' || (ctx.selectedRooms ?? []).length > 0) {
    const n = (ctx.selectedRooms ?? []).length;
    return n <= 1 ? 'A single room is usually done in a day, two at the most with trim and a second coat.' : `A few rooms usually take 1 to ${Math.min(5, Math.max(2, n))} days, depending on trim and how many coats.`;
  }
  if (sqft > 0) {
    const days = Math.max(2, Math.min(10, Math.round(sqft / 500)));
    return `A home your size is usually around ${days} days of painting for a crew, a bit longer with ceilings, trim and repairs.`;
  }
  return 'A single room is usually a day, and a whole house inside is typically 3 to 5 days for a crew; the painter gives you a firm schedule.';
}

const FAQS: Faq[] = [
  {
    key: 'cost',
    // "how much would it cost" / "ballpark": the real number is what this conversation is for. ("Is this free?" is answered elsewhere.)
    re: /\b(?:how much\b|ballpark|rough (?:idea|number|price|estimate)|what(?:'s| is| will| would| does)?\s+(?:it|that|this|the (?:price|cost|total))\s+(?:cost|run|come to|be|go for)|what (?:do|would) you charge|average (?:cost|price))/i,
    answer: () => "It depends mostly on the size, what gets painted and the shape things are in, which is what I'm working out with you. Keep going and I'll give you a real price range at the end, plus painters who'll take the job.",
  },
  {
    key: 'paint supply',
    re: /\b(?:(?:provide|supply|bring|furnish|include|buy|purchase|pay for|cover|get)\b[^.?!]{0,40}\b(?:paint|materials?|supplies)\b|(?:paint|materials?|supplies)\b[^.?!]{0,30}\b(?:included|provided|supplied|extra|on me|on my end|up to me)\b)/i,
    answer: () => "The painter supplies the paint and materials, and they're included in your price. If you'd rather buy the paint yourself, just tell me and I'll price it that way.",
  },
  {
    key: 'duration',
    re: /\bhow long\b[^.?!]{0,40}\b(?:take|takes|last|will it|would it|does it|is it going)\b|\bhow many days\b|\bhow (?:soon|fast|quickly)\b[^.?!]{0,30}\b(?:done|finish|finished|complete|completed)\b|\btime ?frame\b[^.?!]{0,20}\b(?:complete|finish|job)\b/i,
    answer: durationFor,
  },
  {
    key: 'license',
    re: /\b(?:licen[sc]ed|licen[sc]e\b|insured|insurance|bonded|liability)\b/i,
    answer: () => "Yes: the painting companies in our network are well-reviewed, insured and carry the licensing their area requires, and painters with a pattern of poor reviews are removed automatically.",
  },
  {
    key: 'furniture',
    re: /\b(?:(?:move|moving|cover|covering|protect|protecting|clear|clearing)\b[^.?!]{0,40}\b(?:furniture|stuff|belongings|things|floors?|carpets?)|(?:furniture|belongings)\b[^.?!]{0,40}\b(?:move|moved|moving|covered|protected|in the way))/i,
    answer: () => "Painters normally move furniture to the middle of the room and cover it, and they protect the floors with drop cloths. It helps if you clear small items and take things off the walls first.",
  },
  {
    key: 'warranty',
    re: /\b(?:warrant(?:y|ies)|guarantee[sd]?|stand behind|peels? (?:later|after)|if (?:something|it) (?:goes wrong|peels|fails))\b/i,
    answer: () => "The guaranteed-price option comes with a work guarantee. If you pick a painter yourself, their own workmanship warranty applies, so ask what it covers and get it in writing before you book.",
  },
  {
    key: 'cleanup',
    re: /\b(?:clean ?up|clean(?:ing)? (?:up )?after|mess|dust|fumes?|smell|odor|low[- ]voc|vocs?)\b/i,
    answer: () => "Cleanup is part of the job: painters mask and cover as they go and leave the place tidy. Ask about low-odor paint if fumes are a concern; it's a common request and doesn't change much.",
  },
  {
    key: 'deposit',
    re: /\b(?:deposit|pay(?:ment)?\b[^.?!]{0,30}\b(?:up ?front|when|how)|when (?:do|would) i pay|how (?:do|would) i pay)\b/i,
    answer: () => "There's a small deposit when you book, and the balance is due when the job is done. You only pay a painter if you decide to book.",
  },
];

/**
 * The answer to a question the customer asked, or null when it isn't one of the common ones. Only called for questions: a statement
 * that happens to contain the same words ("I'll provide the paint") never gets an answer.
 */
export function faqAnswer(text: string, ctx: EstimatorContext): string | null {
  if (!looksLikeQuestion(text)) return null;
  // "do I have to pay anything / is this free": answered by the existing cost line, not this price answer
  if (/\b(?:free|charge (?:for|to)|cost (?:me )?anything|pay (?:anything|for this))\b/i.test(text)) return null;
  for (const f of FAQS) if (f.re.test(text)) return f.answer(ctx);
  return null;
}
