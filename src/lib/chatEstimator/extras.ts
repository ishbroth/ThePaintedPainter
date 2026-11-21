// ============================================================================
// Side items a customer mentions in passing ("no, but I have one shelf in the kitchen I need painted")
// ============================================================================
// The question being asked ("baseboards?") gets its answer from the usual readers. This catalog is separate: it notices a small item named
// along the way, whatever question is pending, so it is written into the job notes the painters see and acknowledged out loud instead of
// being dropped. It never changes which questions are asked next, so a mention can't pull the conversation off its path.

interface ExtraKind { key: string; re: RegExp; label: string }

// Order matters: the first kind to match a stretch of text claims it. Things the estimator already prices and asks about (doors, windows,
// closets, cabinets, trim, crown, chair rail, wainscoting, built-ins, fireplaces, furniture) are NOT here.
const EXTRA_KINDS: ExtraKind[] = [
  { key: 'shelf', re: /\b(?:floating |wall |wood |wooden |corner |open |kitchen |pantry )?shel(?:f|ves)\b(?! (?:in|inside|of) (?:the |my |our )?closets?)/, label: 'shelf' },
  { key: 'radiator', re: /\bradiators?\b/, label: 'radiator' },
  { key: 'pipes', re: /\b(?:exposed )?pipes?\b|\bductwork\b|\bducts?\b/, label: 'pipes or ductwork' },
  { key: 'vent', re: /\bvents?\b|\bregisters?\b|\bgrilles?\b/, label: 'vent or register' },
  { key: 'fan', re: /\bceiling fans?\b/, label: 'ceiling fan' },
  { key: 'banister', re: /\bbanisters?\b|\bnewel posts?\b|\bbalusters?\b|\bspindles?\b/, label: 'banister' },
  { key: 'stair_risers', re: /\b(?:stair )?risers?\b|\bstair treads?\b/, label: 'stair risers or treads' },
  { key: 'door_frame', re: /\bdoor ?frames?\b|\bdoor casings?\b/, label: 'door frames' },
  { key: 'window_sill', re: /\b(?:window )?sills?\b|\bwindow (?:frames?|casings?|trim)\b/, label: 'window sills or frames' },
  { key: 'mailbox', re: /\bmail ?box(?:es)?\b/, label: 'mailbox' },
  { key: 'trellis', re: /\btrell(?:is|ises)\b|\bpergolas?\b|\barbors?\b/, label: 'trellis or pergola' },
  { key: 'mirror_frame', re: /\bmirror frames?\b/, label: 'mirror frame' },
  { key: 'headboard', re: /\bhead ?boards?\b/, label: 'headboard' },
  { key: 'bar_top', re: /\bbar tops?\b|\bcounter ?tops?\b|\bbutcher blocks?\b/, label: 'bar or counter top' },
  { key: 'beams', re: /\bbeams?\b|\brafters?\b/, label: 'beams' },
  { key: 'wall_art', re: /\b(?:accent|feature|stripe[sd]?|mural|chalkboard)\b/, label: 'accent or feature wall' },
  { key: 'garage', re: /\bgarage (?:walls?|interior|inside)\b/, label: 'garage walls' },
  { key: 'basement', re: /\bbasement\b|\bcrawl ?space\b/, label: 'basement' },
  { key: 'attic', re: /\battic\b/, label: 'attic' },
  { key: 'laundry', re: /\blaundry\b/, label: 'laundry room' },
];

const NUM_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const PLACE = /\b(?:in|on|by|near|next to|inside|along|under|above)\s+(?:the\s+|my\s+|our\s+|a\s+)?((?:[a-z]+\s+){0,2}(?:kitchen|bathroom|bedroom|living room|dining room|hallway|hall|entry|foyer|office|garage|basement|attic|laundry(?: room)?|stairs?|staircase|closet|pantry|den|nursery|porch|patio|deck))\b/;
/** The words before an item in its own clause (after any "but", comma-free of a full stop) rule it out: "no radiators or shelves", "without any vents". */
const RULED_OUT = /\b(?:no|not|without|skip|never|nothing|don'?t (?:need|want|have)|except)\b/i;
function ruledOut(before: string): boolean {
  const clause = before.split(/\bbut\b|[.;!?]/).pop() ?? '';
  return RULED_OUT.test(clause);
}

/** What small items the text names: "one shelf in the kitchen", "the radiator in the hall". Items the customer ruled out ("no radiators") are left out. */
export function detectExtras(text: string): string[] {
  const low = text.toLowerCase();
  const found: string[] = [];
  for (const kind of EXTRA_KINDS) {
    const m = kind.re.exec(low);
    if (!m) continue;
    if (ruledOut(low.slice(0, m.index))) continue;
    const before = low.slice(Math.max(0, m.index - 24), m.index);
    const n = /(?:^|\s)(a|an|one|single|two|couple|three|four|five|six|seven|eight|nine|ten|\d{1,2})(?:\s+(?:of\s+(?:the|my|our)\s+)?(?:[a-z-]+\s+){0,2})?$/.exec(before);
    const count = n ? (NUM_WORDS[n[1]] ?? parseInt(n[1], 10)) : null;
    const place = PLACE.exec(low.slice(m.index));
    const where = place ? ` in the ${place[1]}` : '';
    // the vague "accent/feature" words only count when a wall is named with them
    if (kind.key === 'wall_art' && !/\bwall\b/.test(low)) continue;
    // "vent"/"register"/"duct" are only side items when they are to be painted
    if (['vent', 'pipes', 'beams', 'radiator', 'fan', 'laundry', 'basement', 'attic', 'garage'].includes(kind.key) && !/\b(?:paint|painted|painting|need|needs|want|include|also|plus|too)\b/.test(low)) continue;
    const label = count && count > 1 && !kind.label.endsWith('s') ? (kind.label === 'shelf' ? 'shelves' : kind.label + 's') : kind.label;
    found.push(`${count ? (count === 1 ? 'one' : String(count)) + ' ' : ''}${label}${where}`);
  }
  return found;
}
