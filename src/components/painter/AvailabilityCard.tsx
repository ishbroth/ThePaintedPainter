import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { fmtRange, todayIso } from '../../lib/dates';

interface Range { start: string; end: string }

const inputClass =
  'px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';
const MAX_RANGES = 12;

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-[var(--accent)]' : 'bg-[var(--input-border)]'}`}
    >
      <span className={`absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[26px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/**
 * "I'm booked" controls.
 *   Pause leads (switch)
 *     - pause completely: you don't appear in any search until you turn it back on
 *     - pause until a date: you still appear, but only for customers whose dates fit (customers with
 *       flexible dates see you marked "available from <date>")
 *   Blocked dates: calendar ranges you're unavailable, applied whether or not leads are paused.
 * Saved straight to the painter's own row (these aren't verified fields).
 */
export default function AvailabilityCard() {
  const { user } = useAuth();
  const [painterId, setPainterId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<'completely' | 'until'>('completely');
  const [until, setUntil] = useState('');
  const [ranges, setRanges] = useState<Range[]>([]);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  // "keep accepting jobs even when I'm booked": null until we know the database has it
  const [acceptsBooked, setAcceptsBooked] = useState<boolean | null>(null);
  const [crew, setCrew] = useState<number | null>(null);
  const [confirmSmallCrew, setConfirmSmallCrew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const today = todayIso();

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
        if (data.paused_until) { setMode('until'); setUntil(data.paused_until); }
        setRanges(Array.isArray(data.blackout_dates) ? (data.blackout_dates as Range[]).filter((r) => r.end >= today) : []);
        // read separately, so a database that does not have the column yet cannot break the rest of this card
        supabase
          .from('painters')
          .select('crew_size, accepts_when_booked')
          .eq('id', data.id)
          .maybeSingle()
          .then(({ data: extra, error }) => {
            if (error || !extra) return;
            setCrew(typeof extra.crew_size === 'number' ? extra.crew_size : Number(extra.crew_size) || null);
            setAcceptsBooked(!!extra.accepts_when_booked);
          });
      });
  }, [user, today]);

  const addRange = () => {
    if (!newStart || !newEnd) return;
    if (newEnd < newStart) return setMessage({ kind: 'error', text: 'The end date has to be on or after the start date.' });
    if (ranges.length >= MAX_RANGES) return setMessage({ kind: 'error', text: `You can block up to ${MAX_RANGES} date ranges.` });
    setRanges((prev) => [...prev, { start: newStart, end: newEnd }].sort((a, b) => a.start.localeCompare(b.start)));
    setNewStart('');
    setNewEnd('');
    setMessage(null);
  };

  const save = async () => {
    if (!painterId) return;
    if (paused && mode === 'until' && !until) return setMessage({ kind: 'error', text: 'Pick the date you\'ll be available again, or choose "Pause completely".' });
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('painters')
      .update({
        leads_paused: paused,
        paused_until: paused && mode === 'until' ? until : null,
        blackout_dates: ranges,
      })
      .eq('id', painterId);
    let bookedError = null;
    if (acceptsBooked !== null) {
      ({ error: bookedError } = await supabase.from('painters').update({ accepts_when_booked: acceptsBooked }).eq('id', painterId));
    }
    setSaving(false);
    if (error || bookedError) return setMessage({ kind: 'error', text: 'We couldn\'t save that. Please try again.' });
    setMessage({
      kind: 'ok',
      text: !paused
        ? 'Saved. You\'re taking leads.'
        : mode === 'completely'
        ? 'Saved. You won\'t appear in searches until you turn leads back on.'
        : `Saved. You'll appear only for customers whose dates fit, and be shown as available from ${until}.`,
    });
  };

  if (!painterId) return null;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Availability</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Pause new leads</p>
          <p className="text-xs text-[var(--text-faint)]">Booked up? Turn this on so customers don't send you jobs you can't take. Jobs you've already accepted aren't affected.</p>
        </div>
        <Toggle on={paused} onChange={(v) => { setPaused(v); setMessage(null); }} />
      </div>

      {paused && (
        <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
          <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input type="radio" checked={mode === 'completely'} onChange={() => setMode('completely')} className="mt-1" />
            <span><strong className="text-[var(--text-primary)]">Pause completely</strong><br />You won't appear in any search until you switch leads back on.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input type="radio" checked={mode === 'until'} onChange={() => setMode('until')} className="mt-1" />
            <span>
              <strong className="text-[var(--text-primary)]">Booked until a date</strong><br />
              You'll still appear for customers whose dates fall after it, and for customers with flexible dates (shown as "available from" that day).
            </span>
          </label>
          {mode === 'until' && (
            <input type="date" min={today} value={until} onChange={(e) => { setUntil(e.target.value); setMessage(null); }} className={inputClass} />
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Blocked dates</p>
        <p className="text-xs text-[var(--text-faint)] mb-3">Vacation, another big job, anything. You won't appear for customers who need those days.</p>
        {ranges.length > 0 && (
          <ul className="mb-3 space-y-2">
            {ranges.map((r, i) => (
              <li key={`${r.start}-${r.end}`} className="flex items-center justify-between text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-3 py-2">
                <span>{fmtRange(r.start, r.end)}</span>
                <button type="button" onClick={() => setRanges((prev) => prev.filter((_, j) => j !== i))} className="text-[var(--danger)] text-xs" aria-label="Remove">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-[var(--text-faint)] mb-1">From</label>
            <input type="date" min={today} value={newStart} onChange={(e) => { setNewStart(e.target.value); if (newEnd && newEnd < e.target.value) setNewEnd(e.target.value); }} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-faint)] mb-1">To</label>
            <input type="date" min={newStart || today} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className={inputClass} />
          </div>
          <button type="button" onClick={addRange} disabled={!newStart || !newEnd} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-sm disabled:opacity-50">
            Add
          </button>
        </div>
      </div>

      {acceptsBooked !== null && (
        <div className="border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Keep accepting jobs even when I'm booked</p>
              <p className="text-xs text-[var(--text-faint)]">
                Customers see painters whose calendars are open for their dates first. If every painter nearby is booked, painters with this on are offered the job.
                Crews of 3 or more are offered any job; crews of 1 to 2 only get smaller jobs, after the larger crews.
              </p>
            </div>
            <Toggle
              on={acceptsBooked}
              onChange={(v) => {
                setMessage(null);
                if (v && (crew ?? 1) < 3) setConfirmSmallCrew(true);
                else setAcceptsBooked(v);
              }}
            />
          </div>
        </div>
      )}

      {confirmSmallCrew && (
        <div
          role="dialog"
          aria-label="Are you sure?"
          onClick={() => setConfirmSmallCrew(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-surface)] rounded-xl p-6 w-full max-w-md"
            style={{ boxSizing: 'border-box' }}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Are you sure?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              We don't guarantee you business, but if you do book more than one job on the same dates it can get tricky. With a crew of {crew ?? 1}, you'll only be
              offered smaller jobs, and only when every other painter in the area is already booked.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setAcceptsBooked(true); setConfirmSmallCrew(false); }}
                className="px-5 py-2 bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-lg text-sm"
              >
                Yes, keep accepting jobs
              </button>
              <button
                type="button"
                onClick={() => setConfirmSmallCrew(false)}
                className="px-5 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-ink)] font-semibold rounded-lg transition-colors text-sm"
        >
          {saving ? 'Saving…' : 'Save availability'}
        </button>
        {message && <span className={`text-sm ${message.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</span>}
      </div>
    </div>
  );
}
