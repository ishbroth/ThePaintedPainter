// Two things from a question the estimator asks:
//   - splitPrompt: what is SPOKEN (just the question, without the long list of options that follows it, which voices stumble through)
//   - composerPrompt: a short rephrasing of the core question for the customer's own typing box ("Please estimate square feet")

const QUESTION_STEM = /\b(are|is|do|does|did|will|would|what|which|how|where|when|who|can|could|any|about)\b/i;
const LIST_SEPARATORS = /,|\bor\b/gi;

export interface PromptSplit {
  spoken: string;
  hint: string;
}

export const GENERIC_PROMPT = 'Type or talk here.';

/** Core question by topic, for when the wording itself doesn't give it away. */
const TOPIC_PROMPTS: Record<string, string> = {
  project_type: 'Inside, outside, or both?',
  which_rooms: 'Which rooms?',
  room_size: 'About how big is the room?',
  house_size: 'Please estimate square feet',
  surfaces: 'Which surfaces get painted?',
  trim_scope: 'What does the trim include?',
  condition: 'What shape are the surfaces in?',
  popcorn_extent: 'How many rooms have popcorn ceilings?',
  property_ownership: 'Do you live there, or is it a rental?',
  color_change: 'Same color, or a new one?',
  color_scope_clarify: 'How many colors?',
  reno_context: 'Where does the other work stand?',
  siding: 'What is the outside made of?',
  stories: 'How many stories?',
  location: 'ZIP code?',
  timeline_and_access: 'When, and is it occupied or empty?',
};

/** The final question in a message (an explanation that follows it is not the question). */
function coreQuestion(text: string): string {
  const flat = text.replace(/\[\[photo:[^\]]*\]\]/g, ' ').replace(/\s+/g, ' ');
  const questions = flat.match(/[^.!?]*\?/g);
  return (questions && questions[questions.length - 1].trim()) || flat;
}

/**
 * A short rephrasing of what is being asked, shown in the customer's own box in place of "Type or talk here.":
 * "Please estimate square feet", "How many doors?". Falls back to the generic invitation.
 */
export function composerPrompt(botText: string, topicId?: string | null): string {
  const q = coreQuestion(botText);
  if (/\b(square (?:feet|foot|footage)|sq\.? ?ft)\b/i.test(q)) return 'Please estimate square feet';
  if (/\blinear (?:feet|foot)\b/i.test(q)) return 'About how many linear feet?';
  const many = q.match(/\bhow many ((?!of\b)[a-z-]+(?: [a-z-]+)?)/i);
  if (many) {
    const noun = many[1].replace(/\b(are|is|do|does|did|will|would|you|we|there|need|needs|get|getting|in|on|to|that|of)\b.*$/i, '').trim();
    if (noun) return `How many ${noun}?`;
  }
  if (/\b(living here|live here|rental|renting)\b/i.test(q)) return 'Do you live there, or is it a rental?';
  if (/\bzip\b/i.test(q)) return 'ZIP code?';
  if (/\b(stories|story)\b/i.test(q)) return 'How many stories?';
  if (/\b(interior or exterior|inside,? (?:the )?outside|inside or outside)\b/i.test(q)) return 'Inside, outside, or both?';
  if (/\bwhich rooms?\b/i.test(q)) return 'Which rooms?';
  if (/\bwhen would you like\b|\btimeline\b/i.test(q)) {
    return /occupied|furnished|empty|vacant/i.test(q) ? 'When, and is it occupied or empty?' : 'When would you like it done?';
  }
  return (topicId && TOPIC_PROMPTS[topicId]) || GENERIC_PROMPT;
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
