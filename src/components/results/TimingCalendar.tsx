import { useState } from 'react';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => new Date(`${s}T00:00:00`);
const pretty = (s: string) => fromIso(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * The little calendar on the "Your timing" line. The customer taps the first and last day they find acceptable; painters whose own
 * calendars are open for those days come first (the results reload with the new dates).
 */
export default function TimingCalendar({
  start,
  end,
  changed,
  disabled,
  onApply,
  onClear,
}: {
  start: string | null;
  end: string | null;
  /** True when the dates on screen were picked here rather than given in the chat. */
  changed: boolean;
  disabled?: boolean;
  onApply: (start: string, end: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const today = iso(new Date());
  const [from, setFrom] = useState<string | null>(start && start >= today ? start : null);
  const [to, setTo] = useState<string | null>(end && end >= (start ?? today) ? end : null);
  const [month, setMonth] = useState(() => {
    const d = start && start >= today ? fromIso(start) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const pick = (day: string) => {
    if (!from || (from && to)) {
      setFrom(day);
      setTo(null);
    } else if (day < from) {
      setFrom(day);
    } else {
      setTo(day);
    }
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const blanks = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const canGoBack = iso(new Date(month.getFullYear(), month.getMonth(), 0)) >= today;

  const nav: React.CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', width: 30, height: 30, cursor: 'pointer', fontSize: 16 };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label="Choose the dates that work for you"
        title="Choose the dates that work for you"
        style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6, padding: 3, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', color: changed ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose your dates"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 18, width: '100%', maxWidth: 340, boxSizing: 'border-box', color: 'var(--text-primary)' }}
          >
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Which dates work for you?</p>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Tap the first and last day. Painters with an open calendar for those days are listed first.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button type="button" style={{ ...nav, opacity: canGoBack ? 1 : 0.35 }} disabled={!canGoBack} onClick={() => shift(-1)} aria-label="Previous month">‹</button>
              <strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
              <button type="button" style={nav} onClick={() => shift(1)} aria-label="Next month">›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, textAlign: 'center', fontSize: '0.78rem' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} style={{ color: 'var(--text-faint)', padding: '4px 0' }}>{d}</div>)}
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const past = day < today;
                const inRange = from && (to ? day >= from && day <= to : day === from);
                const edge = day === from || day === to;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={past}
                    onClick={() => pick(day)}
                    style={{
                      height: 34,
                      borderRadius: edge ? 8 : 4,
                      border: 'none',
                      cursor: past ? 'default' : 'pointer',
                      opacity: past ? 0.3 : 1,
                      background: edge ? 'var(--accent-blue)' : inRange ? 'color-mix(in srgb, var(--accent-blue) 28%, transparent)' : 'transparent',
                      color: edge ? 'var(--accent-blue-ink)' : 'var(--text-primary)',
                      fontWeight: edge ? 700 : 400,
                    }}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', minHeight: 20 }}>
              {from ? (to && to !== from ? `${pretty(from)} – ${pretty(to)}` : `${pretty(from)}${to ? '' : ': now tap the last day (or just apply for one day)'}`) : 'No dates chosen yet'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!from}
                onClick={() => { onApply(from!, to ?? from!); setOpen(false); }}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', fontWeight: 700, cursor: from ? 'pointer' : 'not-allowed', opacity: from ? 1 : 0.5 }}
              >
                Apply dates
              </button>
              {changed && (
                <button type="button" onClick={() => { onClear(); setFrom(null); setTo(null); setOpen(false); }} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Use my original timing
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
