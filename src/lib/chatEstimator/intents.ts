// ============================================================================
// Intent Classifier
// ============================================================================
// Classifies a user message before the engine decides what to do with it.
// A message can have multiple intents (e.g., scope_limiter + provide_info);
// we return them ranked.
//
// All matching is rules-based — no LLM. Patterns are tuned for painting
// conversations but are generous enough that edge cases fall back to
// `provide_info` (which means "try to extract facts and move on").
// ============================================================================

export type Intent =
  | 'greeting'
  | 'ask_clarification'     // "like what?" / "what do you mean?" / "huh?"
  | 'ask_example'           // "give me an example" / "such as?"
  | 'express_uncertainty'   // "not sure" / "I don't know" / "idk"
  | 'meta_cost'             // "how much do you charge?" / "is this free?"
  | 'meta_how_it_works'     // "how does this work?" / "what is this?"
  | 'meta_bot_check'        // "am I talking to a bot?" / "are you ai?"
  | 'meta_real_person'      // "can I talk to a real person?"
  | 'meta_time'             // "how long does this take?"
  | 'meta_privacy'          // "where does my info go?"
  | 'off_topic'             // genuinely unrelated
  | 'deflection'            // "just give me a ballpark" / "send it to my email"
  | 'negation'              // "no" / "none" / "nothing"
  | 'confirmation'          // "yes" / "yep" / "sure"
  | 'scope_limiter'         // "just walls, no trim" / "only the bedroom"
  | 'frustration'           // "this is stupid" / "you're not listening"
  | 'ready_to_finish'       // "that's all" / "nothing else" / "run the numbers"
  | 'restart'               // "start over" / "reset"
  | 'color_question'        // "what color should I pick?"
  | 'recommend_question'    // "what do you recommend?"
  | 'painter_question'      // "who's going to do it?" / "can I pick the painter?"
  | 'booking_question'      // "how do I book?" / "how do I lock this in?"
  | 'provide_info';         // default — the message carries job details

export interface IntentResult {
  /** Ordered list, most confident first. */
  intents: Intent[];
  /** Raw lowercased text for downstream matchers. */
  normalized: string;
  /** True if the user message looks like a direct question to the bot. */
  isQuestion: boolean;
}

function has(t: string, ...patterns: (string | RegExp)[]): boolean {
  return patterns.some((p) =>
    typeof p === 'string' ? t.includes(p) : p.test(t),
  );
}

export function classifyIntent(rawText: string): IntentResult {
  const text = rawText.trim();
  const t = text.toLowerCase();
  const intents: Intent[] = [];
  const isQuestion =
    t.endsWith('?') ||
    /^(what|how|why|when|where|who|can you|could you|do you|does this|is this|am i|are you)\b/.test(t);

  // Greeting
  if (/^(hi|hey|hello|yo|howdy|good (morning|afternoon|evening)|sup)\b[.!?,]*$/i.test(t)) {
    intents.push('greeting');
  }

  // Restart
  if (has(t, 'start over', 'restart', 'reset', 'begin again', 'wipe it', 'forget what i said',
    'clear this', 'clear it', 'clear the context', 'clear my info', 'clear everything', 'start fresh', 'start a new')) {
    intents.push('restart');
  }

  // Meta: cost
  if (
    has(t, /\bhow\s+much\s+(do|does|is|will).*(cost|charge|pay|run)/, /\bwhat('?s|\s+is)?\s+the\s+cost/,
      /\bis\s+this\s+free/, /\bdo\s+i\s+(have\s+to\s+)?pay/, /\bhow\s+much\s+is\s+this\b/)
  ) {
    intents.push('meta_cost');
  }

  // Meta: how it works
  if (
    has(t, /\bhow\s+does\s+this\s+work/, /\bwhat\s+is\s+this\b/, /\bhow\s+does\s+(your\s+)?(site|app|this)\s+work/,
      /\bwhat\s+are\s+you\b/, /\bexplain\s+how/)
  ) {
    intents.push('meta_how_it_works');
  }

  // Meta: bot check
  if (
    has(t, /\bam\s+i\s+talking\s+to\s+a\s+(bot|robot|person|human)/, /\bare\s+you\s+(a\s+)?(bot|ai|robot|real|human)/,
      /\bis\s+this\s+(a\s+)?(bot|ai)/, /\breal\s+person\b/, /\bchatgpt\b/)
  ) {
    if (/\bcan\s+i\s+talk\s+to\s+(a\s+)?(real|human|person)/.test(t)) {
      intents.push('meta_real_person');
    } else {
      intents.push('meta_bot_check');
    }
  }

  // Meta: real person direct ask
  if (
    !intents.includes('meta_real_person') &&
    has(t, /\b(speak|talk)\s+to\s+(a\s+)?(real|human|person|someone|isaac)/, /\bcall\s+me\b/, /\bphone\s+number\b/)
  ) {
    intents.push('meta_real_person');
  }

  // Meta: time
  if (has(t, /\bhow\s+long\s+(does|will)\s+this\s+take/, /\bhow\s+long\s+will\s+i\s+be\s+here/)) {
    intents.push('meta_time');
  }

  // Meta: privacy
  if (has(t, /\bwhere\s+does\s+my\s+(info|information|data)\s+go/, /\bwho\s+sees\s+this/, /\bis\s+this\s+private/)) {
    intents.push('meta_privacy');
  }

  // Painter / booking questions
  if (has(t, /\bwho('?s|\s+is)\s+(going\s+to|gonna)\s+(do|paint)/, /\bcan\s+i\s+(pick|choose)\s+(the|a)\s+painter/,
    /\bhow\s+do\s+i\s+(pick|choose)\s+a?\s+painter/)) {
    intents.push('painter_question');
  }
  if (has(t, /\bhow\s+do\s+i\s+book/, /\bhow\s+do\s+i\s+(lock|reserve)/, /\bwhen\s+do\s+i\s+pay/,
    /\bwhat\s+happens\s+(next|after)/)) {
    intents.push('booking_question');
  }

  // Color / recommendation questions
  if (has(t, /\bwhat\s+color/, /\bwhat\s+colors?\s+(do|should|would)/, /\bcolor\s+(advice|suggestion|ideas?|recommend)/)) {
    intents.push('color_question');
  }
  if (has(t, /\bwhat\s+(do|would)\s+you\s+recommend/, /\byour\s+recommendation/, /\bwhat\s+should\s+i/)) {
    intents.push('recommend_question');
  }

  // Clarification back to the bot
  if (has(t, /^like\s+what/, /^what\s+do\s+you\s+mean/, /^huh\??$/, /^what\??$/, /^sorry[?.,]?\s*$/,
    /\bwhat\s+are\s+you\s+asking/, /\brephrase/, /\bi\s+don'?t\s+understand/)) {
    intents.push('ask_clarification');
  }
  if (has(t, /^example/, /\bgive\s+me\s+(an\s+)?example/, /\blike\s+(what|how)\b.*\?$/, /^such\s+as\??$/, /^e\.?g\b/)) {
    intents.push('ask_example');
  }

  // Uncertainty
  if (has(t, /\bnot\s+sure\b/, /\bi\s+don'?t\s+know\b/, /^idk\b/, /^dunno\b/, /\bno\s+idea\b/,
    /\bmaybe\b/, /\bi\s+guess\b/, /\bcan'?t\s+remember\b/)) {
    intents.push('express_uncertainty');
  }

  // Deflection
  if (has(t, /\bjust\s+give\s+me\s+a\s+(ballpark|rough|quick)/, /\bsend\s+(it|me)\s+(to|via|by)?\s*email/,
    /\bcan\s+you\s+(just|maybe)\s+email/, /\bi'?ll\s+think\s+about\s+it/, /\bcall\s+me\s+(back|later)/)) {
    intents.push('deflection');
  }

  // Ready to finish
  if (has(t, /\bthat'?s\s+(it|all|everything)\b/, /\bnothing\s+else\b/, /\bgo\s+ahead\b/,
    /\brun\s+the\s+numbers?\b/, /\bfinish\s+it\b/, /\bi'?m\s+done\b/, /\bshow\s+me\s+the\s+price\b/,
    /^(no|nope|nothing)[\s.!]*(else)?[\s.!]*$/)) {
    // Careful: standalone "no" can be a negation; only treat as ready_to_finish if context implies it.
    // We'll let the engine decide based on what was just asked.
    if (/\b(else|nothing|all|it|everything)\b/.test(t) || /run the|show me the|i'?m done|go ahead/.test(t)) {
      intents.push('ready_to_finish');
    }
  }

  // Scope limiter — "just walls", "only the bedroom", "no trim"
  if (has(t, /\bjust\s+(the\s+)?(walls?|ceiling|trim|doors?|bedrooms?|rooms?)\b/,
    /\bonly\s+(the\s+)?(walls?|ceiling|trim|doors?|bedrooms?|rooms?)\b/,
    /\bno\s+(trim|doors?|ceiling|cabinets?)\b/,
    /\bskip\s+(the\s+)?(trim|doors?|ceiling|cabinets?)\b/,
    /\bnot\s+(the\s+)?(trim|doors?|ceiling|cabinets?)\b/)) {
    intents.push('scope_limiter');
  }

  // Negation — standalone no/none/not. Avoid catching scope_limiter; the engine resolves.
  if (/^(no|nope|nah|none|nothing)[\s.!?,]*$/i.test(t)) {
    intents.push('negation');
  }

  // Confirmation
  if (/^(yes|yeah|yep|yup|sure|ok(ay)?|sounds good|correct|right|that'?s right|exactly)[\s.!?,]*$/i.test(t)) {
    intents.push('confirmation');
  }

  // Frustration
  if (has(t, /\bthis\s+is\s+(stupid|dumb|ridiculous|pointless|annoying)\b/, /\byou'?re\s+not\s+listening\b/,
    /\bugh\b/, /\bnevermind\b/, /\bforget\s+it\b/)) {
    intents.push('frustration');
  }

  // Off-topic (very conservative — only obvious cases)
  if (
    intents.length === 0 &&
    has(t, /\bweather\b/, /\bhow('?s|\s+are)\s+you\b/, /\bwhat'?s\s+up\b/)
  ) {
    intents.push('off_topic');
  }

  // Default: the user is providing info
  if (intents.length === 0) {
    intents.push('provide_info');
  }

  return { intents, normalized: t, isQuestion };
}

/** Convenience: does this result include the given intent? */
export function hasIntent(r: IntentResult, intent: Intent): boolean {
  return r.intents.includes(intent);
}
