// ============================================================================
// Noticing when a conversation is going badly
// ============================================================================
// The estimator watches for the signs that it has let the customer down: they say they already answered ("I already said that", "like I said"),
// they say it misunderstood ("no, that's not what I meant", "that's not what I asked"), or it asked the same question twice. Each one is
// recorded on the chat state as a friction event. In the live conversation the engine uses it to stop and check its notes instead of asking again
// (chatEngine.ts); after the quote is done the events decide whether a short self-review of the transcript is worth running (selfReview.ts).
// ============================================================================

export type FrictionKind = 'repeat_complaint' | 'misunderstood' | 'bot_repeat';

export interface FrictionEvent {
  kind: FrictionKind;
  /** How many customer messages had been sent when it happened. */
  turn: number;
  /** What the customer said (cut short), for a complaint. */
  user?: string;
  /** What the estimator had just said (cut short). */
  bot?: string;
}

/** "I already told you", "like I said", "you already asked that", "stop asking". The customer is pointing at a question they already answered. */
const REPEAT_COMPLAINT: RegExp[] = [
  /\bi\s+(?:already|just|literally|clearly|did)\s+(?:told|said|answered|gave|mentioned|typed|wrote|stated|explained)\b/i,
  /\b(?:like|as)\s+i\s+(?:said|told|mentioned|stated|explained|already)\b/i,
  /\bi\s+said\s+(?:that\s+|this\s+)?(?:already|before|earlier|above|twice)\b/i,
  /\bi\s+(?:have\s+)?(?:told|said)\s+you\s+(?:that\s+|this\s+)?(?:already|before|twice|(?:two|three|\d+)\s+times)\b/i,
  /\byou\s+(?:already|just)\s+asked\b/i,
  /\byou\s+(?:asked|keep\s+asking)\s+(?:me\s+)?(?:that|this|the\s+same)\b/i,
  /\b(?:stop|quit)\s+asking\b/i,
  /\bwhy\s+(?:do|are)\s+you\s+(?:keep|still)\s+(?:asking|repeating)\b/i,
  /\b(?:asked|answered)\s+(?:that|this|it)\s+(?:already|twice|before)\b/i,
  /\bsame\s+question\s+(?:again|twice)\b/i,
  /\bagain\s*\?+\s*$/i,
  /\b(?:look|scroll)\s+(?:back|up)\b/i,
];

/** "No, that's not what I meant", "that's not what I asked": the estimator answered or assumed something other than what they meant. */
const MISUNDERSTOOD: RegExp[] = [
  /\bthat'?s\s+not\s+what\s+i\s+(?:meant|asked|said|wanted|was\s+asking)\b/i,
  /\bnot\s+what\s+i\s+(?:meant|asked|said|was\s+asking)\b/i,
  /\bno,?\s+(?:i\s+(?:said|meant)|that'?s\s+not|not\s+that)\b/i,
  /\byou(?:'re|\s+are)\s+not\s+(?:listening|understanding|getting)\b/i,
  /\byou\s+(?:misunderstood|don'?t\s+understand|didn'?t\s+(?:listen|understand|read|get))\b/i,
  /\bthat\s+(?:doesn'?t|does\s+not|didn'?t)\s+answer\b/i,
  /\bi\s+didn'?t\s+ask\s+(?:that|for\s+that|about\s+that)\b/i,
  /\bwrong\s+(?:answer|question)\b/i,
  /\bthat'?s\s+not\s+(?:my\s+question|the\s+question)\b/i,
];

/** The kind of friction a customer message shows (null for a normal message). A repeat complaint wins over "misunderstood" when both are there. */
export function detectFriction(text: string): Exclude<FrictionKind, 'bot_repeat'> | null {
  if (!text) return null;
  if (REPEAT_COMPLAINT.some((re) => re.test(text))) return 'repeat_complaint';
  if (MISUNDERSTOOD.some((re) => re.test(text))) return 'misunderstood';
  return null;
}

/** The question a bot message ends on, lower-cased and stripped, for comparing one message to another. Null when it asks nothing. */
export function questionOf(botText: string): string | null {
  const sentences = botText.replace(/\[\[[^\]]*\]\]/g, ' ').split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const q = [...sentences].reverse().find((s) => s.endsWith('?'));
  if (!q) return null;
  const norm = q.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  return norm.length >= 12 ? norm : null;
}

interface Turn { role: 'bot' | 'user'; text: string }

/** Every place the estimator asked a question it had already asked in this conversation (word for word). */
export function botRepeats(history: Turn[]): FrictionEvent[] {
  const out: FrictionEvent[] = [];
  const seen = new Map<string, number>();
  let userTurns = 0;
  for (const m of history) {
    if (m.role === 'user') { userTurns++; continue; }
    const q = questionOf(m.text);
    if (!q) continue;
    if (seen.has(q)) out.push({ kind: 'bot_repeat', turn: userTurns, bot: m.text.slice(0, 200) });
    else seen.set(q, userTurns);
  }
  return out;
}

/** What went wrong in a whole conversation: the friction logged live, plus every complaint in the customer's messages and every repeated question. */
export function collectFriction(history: Turn[], logged: FrictionEvent[] = []): FrictionEvent[] {
  const out: FrictionEvent[] = [...logged];
  let userTurns = 0;
  history.forEach((m, i) => {
    if (m.role !== 'user') return;
    userTurns++;
    const kind = detectFriction(m.text);
    if (kind && !out.some((e) => e.kind === kind && e.turn === userTurns)) {
      const before = [...history.slice(0, i)].reverse().find((h) => h.role === 'bot');
      out.push({ kind, turn: userTurns, user: m.text.slice(0, 200), bot: before?.text.slice(0, 200) });
    }
  });
  for (const e of botRepeats(history)) if (!out.some((o) => o.kind === 'bot_repeat' && o.turn === e.turn)) out.push(e);
  return out.slice(0, 20);
}
