import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../../lib/supabase';
import { addDaysIso, fmtDate, fmtRange, todayIso } from '../../lib/dates';

interface JobInfo {
  status: string;
  dateState: 'awaiting_painter_dates' | 'painter_offered' | 'customer_countered' | 'agreed';
  zip: string | null;
  payoutAmount: number | null;
  estimatedDays: number;
  crewSize: number | null;
  customerTiming: string;
  availability: null | { mode: 'exact'; windows: { start: string; end: string }[]; note?: string } | { mode: 'flexible'; around: string; flexDays: number; note?: string };
  counter: null | { start: string; end: string; note?: string };
  scheduled: null | { start: string; end: string | null };
}

const FLEX_CHOICES = [3, 7, 14, 30];
const money = (n: number | null) => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));

const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 };
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--bg-page)', color: 'var(--text-primary)', width: '100%' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 };
const primary: React.CSSProperties = { padding: '12px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, cursor: 'pointer' };
const secondary: React.CSSProperties = { padding: '12px 20px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' };

/**
 * Where a painter lands after accepting a job (and from the customer's "suggested different dates"
 * email). They tell the customer when they're available: exact date windows, or "my dates are
 * flexible" around a date. We compare against the estimated job length for THEIR crew and ask them
 * to confirm if the dates look unrealistic.
 */
export default function PainterAvailability() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const painterId = params.get('painter_id');

  const [job, setJob] = useState<JobInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [mode, setMode] = useState<'exact' | 'flexible'>('exact');
  const [windows, setWindows] = useState<{ start: string; end: string }[]>([{ start: '', end: '' }]);
  const [around, setAround] = useState('');
  const [flexDays, setFlexDays] = useState(7);
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(true);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/painter-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify({ token, painterId, ...body }),
    });
    return { status: res.status, json: await res.json() };
  }, [token, painterId]);

  const load = useCallback(async () => {
    if (!token || !painterId) return setError('This link is incomplete. Please use the link from your email.');
    const { status, json } = await call({ action: 'get' });
    if (status !== 200) return setError(json.error || 'Could not load this job.');
    setJob(json);
    // Pre-fill from what they offered before.
    const a = json.availability;
    if (a?.mode === 'exact') { setMode('exact'); setWindows(a.windows); }
    if (a?.mode === 'flexible') { setMode('flexible'); setAround(a.around); setFlexDays(a.flexDays); }
    if (a?.note) setNote(a.note);
    setShowForm(json.dateState !== 'customer_countered' && json.dateState !== 'painter_offered' && json.dateState !== 'agreed');
  }, [call, token, painterId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (confirmRealistic = false) => {
    setBusy(true);
    setError('');
    const body = mode === 'exact'
      ? { action: 'offer', mode, windows: windows.filter((w) => w.start && w.end), note, confirmRealistic }
      : { action: 'offer', mode, around, flexDays, note, confirmRealistic };
    const { status, json } = await call(body);
    setBusy(false);
    if (status === 409 && json.needsConfirm) {
      setNeedsConfirm(json.message);
      return;
    }
    if (status !== 200) return setError(json.error || 'Could not send your dates.');
    setNeedsConfirm(null);
    setConfirmed(false);
    setDone('Sent! We emailed the customer your availability. You\'ll get a message as soon as they confirm and pay their deposit.');
    load();
  };

  const acceptCounter = async () => {
    setBusy(true);
    const { status, json } = await call({ action: 'accept_counter' });
    setBusy(false);
    if (status !== 200) return setError(json.error || 'Could not accept those dates.');
    setDone('Done! The customer was emailed to pay their deposit and lock in those dates.');
    load();
  };

  if (error && !job) return <div className="max-w-xl mx-auto p-6"><p style={{ color: 'var(--danger)' }}>{error}</p></div>;
  if (!job) return <div className="max-w-xl mx-auto p-6"><p style={{ color: 'var(--text-secondary)' }}>Loading…</p></div>;

  const canEdit = job.status === 'painter_accepted';
  const today = todayIso();

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6">
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px' }}>When can you do this job?</h1>

      <div style={card}>
        <p style={{ margin: '0 0 4px', color: 'var(--accent)', fontWeight: 700, fontSize: '1.2rem' }}>You'd be paid {money(job.payoutAmount)}</p>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Near ZIP {job.zip} · Customer's timing: <strong>{job.customerTiming}</strong>
        </p>
        <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          We estimate about <strong>{job.estimatedDays} working day{job.estimatedDays === 1 ? '' : 's'}</strong> on site
          {job.crewSize ? ` for a crew of ${job.crewSize}` : ''}.
        </p>
      </div>

      {done && <div style={{ ...card, borderColor: 'var(--success)', color: 'var(--text-primary)' }}>{done}</div>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {!canEdit && (
        <div style={card}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {job.status === 'confirmed'
              ? 'This job is confirmed. To change the date, use your dashboard.'
              : 'This job can\'t be scheduled right now.'}{' '}
            <Link to="/painter/dashboard/projects" style={{ color: 'var(--accent-blue)' }}>Go to your projects</Link>
          </p>
        </div>
      )}

      {canEdit && job.dateState === 'customer_countered' && job.counter && (
        <div style={card}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-primary)' }}>The customer suggested different dates</p>
          <p style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '1.05rem' }}>{fmtRange(job.counter.start, job.counter.end)}</p>
          {job.counter.note && <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>“{job.counter.note}”</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={primary} disabled={busy} onClick={acceptCounter}>Accept these dates</button>
            <button style={secondary} onClick={() => setShowForm(true)}>Offer other dates</button>
          </div>
        </div>
      )}

      {canEdit && (job.dateState === 'painter_offered' || job.dateState === 'agreed') && !showForm && (
        <div style={card}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {job.dateState === 'agreed' ? 'Dates agreed' : 'Waiting on the customer'}
          </p>
          {job.scheduled && <p style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>{fmtRange(job.scheduled.start, job.scheduled.end)}</p>}
          {job.availability?.mode === 'exact' && !job.scheduled && (
            <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)' }}>You offered: {job.availability.windows.map((w) => fmtRange(w.start, w.end)).join(' or ')}</p>
          )}
          {job.availability?.mode === 'flexible' && !job.scheduled && (
            <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)' }}>You're flexible around {fmtDate(job.availability.around)} (±{job.availability.flexDays} days).</p>
          )}
          <p style={{ margin: '0 0 12px', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
            {job.dateState === 'agreed' ? 'Waiting for the customer to pay their deposit.' : 'They\'ll confirm their dates and pay their deposit.'}
          </p>
          <button style={secondary} onClick={() => setShowForm(true)}>Change what I offered</button>
        </div>
      )}

      {canEdit && showForm && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {(['exact', 'flexible'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setNeedsConfirm(null); setConfirmed(false); }}
                style={{ ...secondary, ...(mode === m ? { background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', border: 'none' } : {}) }}
              >
                {m === 'exact' ? 'I have exact dates' : 'My dates are flexible'}
              </button>
            ))}
          </div>

          {mode === 'exact' ? (
            <>
              <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Give up to 3 windows when you could do the work. The customer picks one, or suggests another timeframe.
              </p>
              {windows.map((w, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <div>
                    <label style={label}>Available from</label>
                    <input type="date" min={today} value={w.start} style={input} onChange={(e) => setWindows((p) => p.map((x, j) => (j === i ? { ...x, start: e.target.value, end: x.end && x.end < e.target.value ? e.target.value : x.end } : x)))} />
                  </div>
                  <div>
                    <label style={label}>Done by</label>
                    <input type="date" min={w.start || today} value={w.end} style={input} onChange={(e) => setWindows((p) => p.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  </div>
                  {windows.length > 1 && <button type="button" style={{ ...secondary, padding: '10px 12px' }} onClick={() => setWindows((p) => p.filter((_, j) => j !== i))} aria-label="Remove window">✕</button>}
                </div>
              ))}
              {windows.length < 3 && (
                <button type="button" style={{ ...secondary, padding: '8px 14px', marginBottom: 8 }} onClick={() => setWindows((p) => [...p, { start: '', end: '' }])}>+ Add another window</button>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Pick a date you'd like to work around and how flexible you are. The customer chooses the exact start date inside that window when they confirm.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={label}>Around this date</label>
                  <input type="date" min={today} value={around} style={input} onChange={(e) => setAround(e.target.value)} />
                </div>
                <div>
                  <label style={label}>Give or take</label>
                  <select value={flexDays} style={input} onChange={(e) => setFlexDays(Number(e.target.value))}>
                    {FLEX_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
              </div>
              {around && <p style={{ margin: '8px 0 0', color: 'var(--text-faint)', fontSize: '0.85rem' }}>The customer could start between {fmtDate(addDaysIso(around, -flexDays) < today ? today : addDaysIso(around, -flexDays))} and {fmtDate(addDaysIso(around, flexDays))}.</p>}
            </>
          )}

          <div style={{ marginTop: 12 }}>
            <label style={label}>Note to the customer (optional)</label>
            <textarea rows={2} style={input} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I can bring a crew of 3 so it'll go faster" />
          </div>

          {needsConfirm && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--tint-warning-bg)' }}>
              <p style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: '0.92rem' }}>{needsConfirm}</p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                Yes, I can complete this job in that time
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              style={{ ...primary, opacity: busy || (needsConfirm !== null && !confirmed) ? 0.5 : 1 }}
              disabled={busy || (needsConfirm !== null && !confirmed) || (mode === 'exact' ? !windows.some((w) => w.start && w.end) : !around)}
              onClick={() => submit(needsConfirm !== null && confirmed)}
            >
              {busy ? 'Sending…' : 'Send my availability'}
            </button>
            {(job.dateState !== 'awaiting_painter_dates') && <button style={secondary} onClick={() => setShowForm(false)}>Cancel</button>}
          </div>
        </div>
      )}
    </div>
  );
}
