// ============================================================================
// Reviewing the conversation before a price goes out
// ============================================================================
// A price (and then a deposit and a painter's time) should only come from a conversation about an actual painting job.
// Before the price is shown, the whole conversation is checked: profanity or abuse, "I don't need anything painted", replies
// that make no sense, or nothing that adds up to a job. If it fails, the customer is asked to try again and nothing goes to
// painters. (The same word lists are used again on the server when a price is claimed: see supabase/functions/_shared.)
// ============================================================================

import { supabase } from '../supabase';

export type ReviewReason = 'abusive' | 'dismissive' | 'nonsense' | 'no_project';

export interface ReviewResult {
  ok: boolean;
  reason?: ReviewReason;
}

export interface ReviewedMessage {
  text: string;
  /** The estimator understood something from it (it acknowledged a fact). */
  recognized: boolean;
}

/** Strong words: one is enough. */
const STRONG = [
  'fuck', 'fucker', 'fucking', 'fucked', 'fck', 'fuk', 'motherfucker', 'shit', 'shithead', 'bullshit', 'bitch', 'bitches', 'asshole', 'assholes',
  'dumbass', 'jackass', 'cunt', 'dick', 'dickhead', 'prick', 'whore', 'slut', 'bastard', 'retard', 'retarded', 'faggot', 'nigger', 'nigga',
  'piss', 'pissed', 'wtf', 'stfu', 'gtfo',
];
/** Mild words: it takes more than one. */
const MILD = ['damn', 'dammit', 'goddamn', 'hell', 'crap', 'ass', 'idiot', 'stupid', 'dumb', 'suck', 'sucks', 'moron', 'screw'];
/** Insults aimed at the assistant (or its mother) read as abuse. */
const INSULT_PHRASES = [/\byour (mom|mother|momma|mama|mum)\b/i, /\byou (suck|are stupid|are dumb|idiot|moron)\b/i, /\b(shut up|go to hell|piss off|screw you|f+u+c+k+ (you|off))\b/i];

/** @ $ 0 1 3 * and repeated letters ("fuuuck", "b1tch", "f*ck") cannot be used to slip a word through. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/5/g, 's').replace(/!/g, 'i')
    .replace(/[*#%^+_.\-]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

export function profanityScan(text: string): { strong: number; mild: number; insult: boolean } {
  const n = normalize(text);
  const words = n.split(/[^a-z]+/).filter(Boolean);
  let strong = 0;
  let mild = 0;
  for (const w of words) {
    if (STRONG.includes(w) || STRONG.includes(w.replace(/(.)\1/g, '$1'))) strong++;
    else if (MILD.includes(w)) mild++;
  }
  return { strong, mild, insult: INSULT_PHRASES.some((re) => re.test(text) || re.test(n)) };
}

/** "I don't need anything painted", "I need nothing", "it doesn't exist", "just testing": not a painting job. */
const DISMISSIVE = [
  /\b(i\s+)?(don'?t|do not|dont|didn'?t)\s+(really\s+)?(need|want)\s+(anything|a thing|any|painting|nothing)/i,
  /\bi\s+need\s+nothing\b/i,
  /\bnothing\s+(needs?\s+)?(to be\s+)?(painted|to paint)\b/i,
  /\b(it|that|this|the (house|place|property))\s+(doesn'?t|does not|dont)\s+(even\s+)?(exist|real)\b/i,
  /\b(not|isn'?t)\s+(a\s+)?real\b/i,
  /\bjust\s+(testing|kidding|messing|playing|curious what happens)\b/i,
  /\b(testing|test)\s+(this|the)\s+(thing|bot|site|chat)\b/i,
  /^\s*(neither|none|nothing|no one|nobody)\s*[.!]?\s*$/i,
];

export function dismissiveCount(messages: string[]): number {
  return messages.filter((m) => DISMISSIVE.some((re) => re.test(m))).length;
}

/** Local checks that need no network. */
export function reviewLocally(messages: ReviewedMessage[]): ReviewResult {
  let strong = 0;
  let mild = 0;
  let insulted = false;
  for (const m of messages) {
    const s = profanityScan(m.text);
    strong += s.strong;
    mild += s.mild;
    if (s.insult) insulted = true;
  }
  if (strong > 0 || insulted || mild >= 2) return { ok: false, reason: 'abusive' };

  if (dismissiveCount(messages.map((m) => m.text)) >= 2) return { ok: false, reason: 'dismissive' };

  // Nonsense and off-topic chatter are the AI reviewer's call: word lists and "was it recognized" ratios misfire on terse real customers.
  return { ok: true };
}

/** The price must be for something: at least one real item beyond the bare minimum service charge. */
export function hasPaintingScope(lineItems: { description: string }[]): boolean {
  return lineItems.some((l) => !/Minimum service charge/i.test(l.description));
}

/** The AI's read of the whole conversation (catches nonsense and off-topic chatter the word lists can't). Null when it can't be reached. */
export async function reviewWithAI(messages: string[]): Promise<ReviewResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('review-conversation', { body: { messages: messages.slice(-40).map((m) => m.slice(0, 400)) } });
    if (error || !data || typeof data.ok !== 'boolean') return null;
    return data.ok ? { ok: true } : { ok: false, reason: (['abusive', 'dismissive', 'nonsense', 'no_project'] as const).includes(data.reason) ? data.reason : 'nonsense' };
  } catch {
    return null;
  }
}

export function retryMessage(reason: ReviewReason | undefined): string {
  switch (reason) {
    case 'abusive':
      return "Hmm… let's keep this friendly and try that again. What do you need painted?";
    case 'dismissive':
      return "Hmm… it sounds like there may not be a painting project right now. If there is one, can we try that again? What do you need painted?";
    case 'no_project':
      return "Hmm… I couldn't tell what you'd like painted, so I can't give you a price yet. Can we try that again? What do you need painted?";
    default:
      return "Hmm… that didn't quite add up to a painting project. Can we try that again? What do you need painted?";
  }
}
