import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Toggle } from './AvailabilityCalendar';

/**
 * "Keep accepting jobs even when I'm booked" (it used to sit in the availability card). Saved the moment it is switched, straight to the painter's own row.
 * Shown only once we know the database has the column, so one that does not cannot break the page.
 */
export default function BookedPreference() {
  const { user } = useAuth();
  const [painterId, setPainterId] = useState<string | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [crew, setCrew] = useState<number | null>(null);
  const [confirmSmallCrew, setConfirmSmallCrew] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('painters')
      .select('id, crew_size, accepts_when_booked')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) return;
        setPainterId(data.id);
        setCrew(typeof data.crew_size === 'number' ? data.crew_size : Number(data.crew_size) || null);
        setOn(!!data.accepts_when_booked);
      });
  }, [user]);

  const save = async (v: boolean) => {
    if (!painterId) return;
    const previous = on;
    setOn(v);
    setError('');
    const { error: err } = await supabase.from('painters').update({ accepts_when_booked: v }).eq('id', painterId);
    if (err) { setOn(previous); setError('Couldn\'t save. Try again.'); }
  };

  if (on === null) return null;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">Take jobs even when booked</p>
          <p className="text-[10px] leading-snug text-[var(--text-faint)]">
            If every painter nearby is booked, you can still be offered the job. Crews of 3+ get any job; crews of 1–2 get smaller jobs, after bigger crews.
          </p>
        </div>
        <Toggle
          on={on}
          label="Take jobs even when booked"
          onChange={(v) => { if (v && (crew ?? 1) < 3) setConfirmSmallCrew(true); else void save(v); }}
        />
      </div>
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}

      {confirmSmallCrew && (
        <div
          role="dialog"
          aria-label="Are you sure?"
          onClick={() => setConfirmSmallCrew(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg-surface)] rounded-xl p-5 w-full max-w-md" style={{ boxSizing: 'border-box' }}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">Are you sure?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Double-booking the same dates can get tricky. With a crew of {crew ?? 1}, you'll only be offered smaller jobs, and only when every other painter nearby is booked.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { void save(true); setConfirmSmallCrew(false); }} className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-lg text-sm">
                Yes, keep accepting
              </button>
              <button type="button" onClick={() => setConfirmSmallCrew(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
