// Does the customer limit the job to something specific ("just the stair rail", "baseboards only", "only the fence")?
// A bare "just" in ordinary speech ("honestly just want it done right", "just a quick question") is NOT a scope limit,
// and treating it as one used to shrink whole-house jobs down to a single item.

const NOT_A_LIMIT = [
  'got', 'have', 'had', 'looking', 'trying', 'hoping', 'curious', 'checking', 'wondering', 'be', 'get', 'did', 'do', 'really', 'so',
  'ask', 'asking', 'to', 'in case', 'because', 'thinking', 'moved', 'bought', 'would', 'let', 'say', 'said', 'told', 'tell', 'think',
  'know', 'see', 'figure', 'a quick', 'a question', 'a little', 'a bit', 'one more', 'making', 'started', 'wanted to know',
];
// "want it done", "need this by Friday", "like to know": wanting something OF the job, not limiting it
const WANT_IT = '(?:want|need|wanted|needed|hope|like|would like)s?\\s+(?:it|this|that|them|things|to|you|me|us|some|a\\s+(?:price|quote|estimate|ballpark)|the\\s+(?:job|work|price))\\b';

const LEADING = new RegExp(`\\b(?:only|just)\\s+(?!${WANT_IT})(?!(?:${NOT_A_LIMIT.join('|')})\\b)[a-z0-9]`, 'i');
// "baseboards only", "pressure washing only", "walls only please", "Mondays only."
const TRAILING = /(?:[a-z0-9'-]+\s+){1,5}only(?=\s*(?:$|[.,;:!?)]|please\b|thanks\b|thank\b|for\b|no\b|and\b|-|—))/i;

export function hasScopeLimiter(text: string): boolean {
  return LEADING.test(text) || TRAILING.test(text) || /\bnothing else\b|\bthat'?s (?:all|it)\b/i.test(text);
}
