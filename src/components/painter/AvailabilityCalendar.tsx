import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { addDaysIso, fmtRange, todayIso } from '../../lib/dates';

interface Range { start: string; end: string }
export interface JobSpan { start: string; end?: string | null }

const MAX_RANGES = 12;

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-[var(--accent)]' : 'bg-[var(--input-border)]'}`}
    >
      <span className={`absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const order = (a: string, b: string) => (a <= b ? { a, b } : { a: b, b: a });
const inRange = (day: string, r: Range) => r.start <= day && day <= r.end;

/** The days of a job as a set of YYYY-MM-DD strings (one day if it has no end date). */
function daysOf(span: JobSpan): string[] {
  const out: string[] = [];
  const end = span.end && span.end >= span.start ? span.end : span.start;
  for (let d = span.start, n = 0; d <= end && n < 120; d = addDaysIso(d, 1), n++) out.push(d);
  return out;
}

/** Add a blocked range, merging it with any it touches. */
function block(ranges: Range[], a: string, b: string): Range[] {
  let start = a;
  let end = b;
  const rest: Range[] = [];
  for (const r of ranges) {
    if (r.start <= addDaysIso(b, 1) && r.end >= addDaysIso(a, -1)) { if (r.start < start) start = r.start; if (r.end > end) end = r.end; }
    else rest.push(r);
  }
  return [...rest, { start, end }].sort((x, y) => x.start.localeCompare(y.start));
}

/** Take a span of days out of the blocked ranges (a range it cuts through is split in two). */
function unblock(ranges: Range[], a: string, b: string): Range[] {
  const out: Range[] = [];
  for (const r of ranges) {
    if (r.end < a || r.start > b) { out.push(r); continue; }
    if (r.start < a) out.push({ start: r.start, end: addDaysIso(a, -1) });
    if (r.end > b) out.push({ start: addDaysIso(b, 1), end: r.end });
  }
  return out;
}

/**
 * The painter's calendar: the days of their confirmed jobs in green, the days they have blacked out in black, and the switch that turns new jobs off.
 * Drag across dates (or tap a first and a last date) to select a stretch, then block it or free it up. Everything saves the moment it changes,
 * straight to the painter's own row (these aren't verified fields).
 */
export default function AvailabilityCalendar({ jobs }: { jobs: JobSpan[] }) {
  const { user } = useAuth();
  const today = todayIso();
  const [painterId, setPainterId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [until, setUntil] = useState('');
  const [untilMode, setUntilMode] = useState(false);
  const [ranges, setRanges] = useState<Range[]>([]);
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState<{ a: string; b: string } | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const drag = useRef<{ start: string; moved: boolean } | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('painters')
      .select('id, leads_paused, paused_until, blackout_dates')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPainterId(data.id);
        setPaused(!!data.leads_paused);
        if (data.paused_until) { setUntilMode(true); setUntil(data.paused_until); }
        setRanges(Array.isArray(data.blackout_dates) ? (data.blackout_dates as Range[]).filter((r) => r.end >= today) : []);
      });
  }, [user, today]);

  const jobDays = useMemo(() => new Set(jobs.flatMap(daysOf)), [jobs]);

  const flash = (kind: 'ok' | 'error', text: string) => {
    setNote({ kind, text });
    if (kind === 'ok') window.setTimeout(() => setNote((n) => (n && n.kind === 'ok' ? null : n)), 1800);
  };

  const persist = async (next: { paused: boolean; until: string; untilMode: boolean; ranges: Range[] }) => {
    if (!painterId) return;
    const { error } = await supabase
      .from('painters')
      .update({ leads_paused: next.paused, paused_until: next.paused && next.untilMode && next.until ? next.until : null, blackout_dates: next.ranges })
      .eq('id', painterId);
    if (error) flash('error', 'Couldn\'t save. Try again.');
    else flash('ok', 'Saved');
  };

  const current = () => ({ paused, until, untilMode, ranges });

  const setJobsOn = (on: boolean) => {
    setPaused(!on);
    void persist({ ...current(), paused: !on });
  };

  const applyBlock = (a: string, b: string) => {
    if (ranges.length >= MAX_RANGES && !ranges.some((r) => r.start <= addDaysIso(b, 1) && r.end >= addDaysIso(a, -1))) return flash('error', `Up to ${MAX_RANGES} blocked stretches.`);
    const next = block(ranges, a, b);
    setRanges(next);
    setSel(null);
    pending.current = null;
    void persist({ ...current(), ranges: next });
  };

  const applyUnblock = (a: string, b: string) => {
    const next = unblock(ranges, a, b);
    setRanges(next);
    setSel(null);
    pending.current = null;
    void persist({ ...current(), ranges: next });
  };

  // selecting: press on a day and drag, or tap a first day and then a last one
  const dayAt = (e: React.PointerEvent): string | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const day = el?.closest<HTMLElement>('[data-day]')?.dataset.day ?? null;
    return day && day >= today ? day : null;
  };
  const onDown = (e: React.PointerEvent) => {
    const day = dayAt(e);
    if (!day) return;
    drag.current = { start: day, moved: false };
    if (!pending.current) setSel({ a: day, b: day });
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const day = dayAt(e);
    if (!day) return;
    if (day !== d.start) d.moved = true;
    if (d.moved) { pending.current = null; setSel(order(d.start, day)); }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    if (pending.current && pending.current !== d.start) { setSel(order(pending.current, d.start)); pending.current = null; }
    else if (pending.current === d.start) { pending.current = null; setSel({ a: d.start, b: d.start }); }
    else { pending.current = d.start; setSel({ a: d.start, b: d.start }); }
  };

  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => iso(view.y, view.m, i + 1))];
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selHasFree = sel ? daysOf({ start: sel.a, end: sel.b }).some((d) => !ranges.some((r) => inRange(d, r))) : false;
  const selHasBlocked = sel ? ranges.some((r) => r.start <= sel.b && r.end >= sel.a) : false;

  if (!painterId) return null;

  const navBtn = 'w-7 h-7 rounded-md border border-[var(--border)] text-[var(--text-primary)] text-sm leading-none';

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Taking new jobs: {paused ? 'OFF' : 'ON'}</p>
          <p className="text-[11px] text-[var(--text-faint)]">{paused ? 'You are hidden from new offers.' : 'Switch off when you\'re booked.'}</p>
        </div>
        <Toggle on={!paused} onChange={setJobsOn} label="Taking new jobs" />
      </div>

      {paused && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <button
            type="button"
            onClick={() => { setUntilMode(false); void persist({ ...current(), untilMode: false }); }}
            className={`px-2.5 py-1 rounded-full border ${!untilMode ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : 'border-[var(--input-border)]'}`}
          >
            Off completely
          </button>
          <button
            type="button"
            onClick={() => setUntilMode(true)}
            className={`px-2.5 py-1 rounded-full border ${untilMode ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : 'border-[var(--input-border)]'}`}
          >
            Back on a date
          </button>
          {untilMode && (
            <input
              type="date"
              min={today}
              value={until}
              onChange={(e) => { setUntil(e.target.value); void persist({ ...current(), until: e.target.value, untilMode: true }); }}
              className="px-2 py-1 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-md text-[var(--text-primary)]"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button type="button" className={navBtn} aria-label="Previous month" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}>‹</button>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{monthLabel}</p>
        <button type="button" className={navBtn} aria-label="Next month" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}>›</button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-[3px] text-center text-[10px] text-[var(--text-faint)]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div
        className="mt-1 grid grid-cols-7 gap-[3px]"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null; }}
      >
        {cells.map((day, i) => {
          if (!day) return <span key={`b${i}`} />;
          const past = day < today;
          const isJob = jobDays.has(day);
          const isBlocked = ranges.some((r) => inRange(day, r));
          const isSel = !!sel && day >= sel.a && day <= sel.b;
          const style: React.CSSProperties = {
            height: 32,
            borderRadius: 6,
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: past ? 0.35 : 1,
            color: isJob || isBlocked ? '#fff' : 'var(--text-primary)',
            background: isJob
              ? 'var(--success)'
              : isBlocked
              ? 'repeating-linear-gradient(135deg, #000 0 5px, #2a2a2a 5px 10px)'
              : 'var(--bg-page)',
            border: day === today ? '1px solid var(--accent)' : '1px solid var(--border)',
            boxShadow: isSel ? 'inset 0 0 0 2px var(--accent-blue, var(--accent))' : isJob && isBlocked ? 'inset 0 -4px 0 #000' : undefined,
            fontWeight: isJob || isBlocked ? 700 : 400,
          };
          return <span key={day} data-day={day} style={style}>{Number(day.slice(8))}</span>;
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--text-faint)]">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--success)' }} />Job</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#000' }} />Blocked</span>
        </span>
        {note && <span className={note.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>{note.text}</span>}
      </div>

      {sel ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          <span className="text-xs text-[var(--text-primary)] mr-auto">{fmtRange(sel.a, sel.b).replace(/(\w{3}), /g, '').replace(/, \d{4}/g, '')}</span>
          {selHasFree && <button type="button" onClick={() => applyBlock(sel.a, sel.b)} className="px-3 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold">Block out</button>}
          {selHasBlocked && <button type="button" onClick={() => applyUnblock(sel.a, sel.b)} className="px-3 py-1 rounded-md border border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-semibold">Unblock</button>}
          <button type="button" onClick={() => { setSel(null); pending.current = null; }} className="px-2 py-1 text-xs text-[var(--text-faint)]">Clear</button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">Drag across dates, or tap a first and last date, to block or free them.</p>
      )}
    </div>
  );
}
