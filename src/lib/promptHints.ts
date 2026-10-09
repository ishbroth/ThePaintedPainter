// Splits a question into what is SPOKEN (just the question) and a HINT (the options that follow it), which is shown, subdued,
// in the box where the customer types. Reading "stucco, wood, Hardie board, vinyl, brick, or a mix?" aloud is a mouthful.

const QUESTION_STEM = /\b(are|is|do|does|did|will|would|what|which|how|where|when|who|can|could|any|about)\b/i;
const LIST_SEPARATORS = /,|\bor\b/gi;

export interface PromptSplit {
  spoken: string;
  hint: string;
}

/** Topic fallbacks for questions whose options are already part of a short question. */
const TOPIC_HINTS: Record<string, string> = {
  project_type: 'inside, outside, or both',
  property_ownership: 'I live here, it’s a rental, or I’m selling',
  timeline_and_access: 'ASAP, a date or range, or flexible – and occupied, furnished, or empty',
  color_change: 'same color, or a different one',
  siding: 'stucco, wood, Hardie board, vinyl, brick',
  stories: 'one story, two stories, or taller',
};

export function topicHint(topicId: string | null | undefined): string {
  return (topicId && TOPIC_HINTS[topicId]) || '';
}

function listLike(s: string): boolean {
  return (s.match(LIST_SEPARATORS) ?? []).length >= 2;
}

function clean(s: string): string {
  return s.replace(/\s{2,}/g, ' ').trim();
}

export function splitPrompt(text: string): PromptSplit {
  let spoken = text;
  const hints: string[] = [];

  // (a specific date or range, ASAP, or tell me your dates are flexible)
  spoken = spoken.replace(/\(([^)]{8,})\)/g, (_m, inner: string) => {
    hints.push(inner);
    return '';
  });

  // "...Which room? Bedroom, living room, kitchen, bathroom, something else?"
  const tail = spoken.match(/^(.*\?)\s+([A-Z][^?.!]*\?)$/s);
  if (tail && listLike(tail[2])) {
    spoken = tail[1];
    hints.push(tail[2].replace(/\?$/, ''));
  } else {
    // "How are the walls looking right now — smooth and ready, or any holes, cracks…?"
    const dash = spoken.match(/^(.*?[.!?]\s+)?([^.!?]*?)\s[—–]\s([^.!?—–]*\?)$/s);
    if (dash && QUESTION_STEM.test(dash[2]) && dash[2].length >= 15 && listLike(dash[3])) {
      spoken = `${dash[1] ?? ''}${dash[2]}?`;
      hints.push(dash[3].replace(/\?$/, ''));
    }
  }

  return { spoken: clean(spoken), hint: clean(hints.join(' · ')) };
}
