// ============================================================================
// Customer timing: specific dates, ranges, and "my dates are flexible"
// ============================================================================
// The chat used to recognize only three buckets (ASAP / this month / no rush).
// This pulls actual dates out of what the customer types so they can be matched
// against painters' availability:
//   "June 3rd"                       -> start June 3
//   "between June 3 and June 7"      -> June 3 to June 7
//   "June 3 to 7", "6/3 - 6/7"       -> same
//   "the week of June 3"             -> June 3 to June 7
//   "in 2 weeks", "tomorrow", "next Monday"
//   "my dates are flexible"          -> flexible (with or without a date to center on)
// Dates without a year resolve to the next time that date occurs. Everything is
// returned as YYYY-MM-DD in the customer's local calendar.
// ============================================================================

export interface ParsedTiming {
  startDate?: string;
  endDate?: string;
  flexible?: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORD = '(?:st|nd|rd|th)?';

const FLEXIBLE_RE =
  /\b(?:(?:my |our |the )?dates?(?: are| is)? flexible|flexible (?:on |with |about )?(?:the )?(?:dates?|timing|schedule|timeline)|i'?m flexible|we'?re flexible|totally flexible|very flexible|any ?(?:time|day|date) (?:works|is fine|is good)|open to (?:any|different|other) dates?|whatever dates? work)\b/i;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

interface Hit { index: number; end: number; date: Date; hasYear: boolean }

/** A calendar date for month/day, in `year` if given, else the next occurrence on or after today. */
function resolve(month: number, day: number, year: number | null, today: Date): Date | null {
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  const build = (y: number) => {
    const d = new Date(y, month, day);
    return d.getMonth() === month ? d : null; // rejects Feb 30 etc.
  };
  if (year) return build(year < 100 ? 2000 + year : year);
  const thisYear = build(today.getFullYear());
  if (thisYear && thisYear >= today) return thisYear;
  return build(today.getFullYear() + 1);
}

function findDates(text: string, today: Date): Hit[] {
  const hits: Hit[] = [];
  const push = (m: RegExpExecArray, date: Date | null, hasYear: boolean) => {
    if (date) hits.push({ index: m.index, end: m.index + m[0].length, date, hasYear });
  };

  // "June 3", "Jun 3rd, 2026"
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})${ORD}(?:,?\\s*(\\d{4}))?\\b`, 'gi'))) {
    push(m as RegExpExecArray, resolve(MONTHS[m[1].toLowerCase()], Number(m[2]), m[3] ? Number(m[3]) : null, today), !!m[3]);
  }
  // "3rd of June", "15 December 2026"
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s*(\\d{4}))?`, 'gi'))) {
    push(m as RegExpExecArray, resolve(MONTHS[m[2].toLowerCase()], Number(m[1]), m[3] ? Number(m[3]) : null, today), !!m[3]);
  }
  // 2026-06-03
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    push(m as RegExpExecArray, resolve(Number(m[2]) - 1, Number(m[3]), Number(m[1]), today), true);
  }
  // 6/3, 6/3/26, 6/3/2026 — a bare "1/2" is too often "1/2 bath", so a bare m/d needs a date-ish word before it
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const before = text.slice(Math.max(0, m.index! - 24), m.index!).toLowerCase();
    if (!m[3] && !/\b(on|by|before|after|starting|start|from|between|to|until|through|around|week of|dates?|date)\s*$/.test(before)) continue;
    push(m as RegExpExecArray, resolve(Number(m[1]) - 1, Number(m[2]), m[3] ? Number(m[3]) : null, today), !!m[3]);
  }

  // drop overlaps (e.g. "June 3" also matched inside "June 3, 2026"), keep the longer
  hits.sort((a, b) => a.index - b.index || b.end - a.end);
  const kept: Hit[] = [];
  for (const h of hits) {
    if (kept.length && h.index < kept[kept.length - 1].end) continue;
    kept.push(h);
  }
  return kept;
}

export function extractTiming(text: string, now: Date = new Date()): ParsedTiming {
  const today = startOfDay(now);
  const t = text.toLowerCase();
  const out: ParsedTiming = {};

  if (FLEXIBLE_RE.test(text)) out.flexible = true;

  // "June 3 to 7" / "June 3-7": second part is a bare day in the same month
  const shortRange = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})${ORD}\\s*(?:to|through|thru|until|till|-|–|—)\\s*(\\d{1,2})${ORD}\\b(?!\\s*(?:am|pm|:|\\/))`, 'i').exec(text);
  if (shortRange) {
    const month = MONTHS[shortRange[1].toLowerCase()];
    const start = resolve(month, Number(shortRange[2]), null, today);
    if (start) {
      const end = new Date(start.getFullYear(), month, Number(shortRange[3]));
      if (end >= start && end.getMonth() === month) return { ...out, startDate: iso(start), endDate: iso(end) };
    }
  }

  const hits = findDates(text, today);
  if (hits.length >= 1) {
    const first = hits[0];
    let start = first.date;
    let end: Date | null = null;

    if (/\bweek of\s*$/.test(t.slice(Math.max(0, first.index - 12), first.index))) {
      end = addDays(start, 4);
    } else if (hits.length >= 2) {
      const between = t.slice(first.end, hits[1].index);
      if (/^\s*(?:,?\s*)?(?:to|through|thru|until|till|and|-|–|—|or)\s*$/.test(between)) {
        end = hits[1].date;
        // "Dec 28 to Jan 3" with no years: the second date is the next occurrence after the first
        if (end < start && !hits[1].hasYear) end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate());
      }
    }

    // "done by Dec 15" / "before Dec 15": a deadline, not a start date
    const lead = t.slice(Math.max(0, first.index - 18), first.index);
    if (!end && /\b(?:by|before|no later than|deadline(?: is)?|done by|finished by|complete by)\s*$/.test(lead)) {
      return { ...out, flexible: true, endDate: iso(start) };
    }

    if (start >= today) {
      out.startDate = iso(start);
      if (end && end >= start) out.endDate = iso(end);
      return out;
    }
  }

  // Relative phrases
  let m: RegExpExecArray | null;
  if ((m = /\bin (?:about |around )?(\d{1,2}|a|one|two|three|four|five|six) (day|week|month)s?\b/.exec(t))) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const n = words[m[1]] ?? Number(m[1]);
    const days = m[2] === 'day' ? n : m[2] === 'week' ? n * 7 : n * 30;
    return { ...out, startDate: iso(addDays(today, days)) };
  }
  if (/\btomorrow\b/.test(t)) return { ...out, startDate: iso(addDays(today, 1)) };
  if ((m = new RegExp(`\\bnext (${Object.keys(WEEKDAYS).join('|')})\\b`).exec(t))) {
    const target = WEEKDAYS[m[1]];
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return { ...out, startDate: iso(addDays(today, diff + 0)) };
  }
  if (/\bnext month\b/.test(t)) {
    return { ...out, startDate: iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)) };
  }
  return out;
}

/** The coarse bucket a specific start date implies, for pricing (rush premium) and availability. */
export function timelineFromStart(startDate: string, now: Date = new Date()): 'asap' | 'this_month' | 'no_rush' {
  const today = startOfDay(now).getTime();
  const days = Math.round((new Date(`${startDate}T00:00:00`).getTime() - today) / 86_400_000);
  if (days <= 7) return 'asap';
  if (days <= 45) return 'this_month';
  return 'no_rush';
}
