import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { createDepositCheckout } from '../lib/payments/stripe';
import { addDaysIso, fmtDate, fmtRange, todayIso } from '../lib/dates';
import AddToCalendar from '../components/AddToCalendar';

interface JobDetails {
  jobId: string;
  status: string;
  guaranteedPrice: number;
  depositAmount: number;
  depositStatus: string;
  scheduledDate: string | null;
  scheduledEndDate: string | null;
  phaseLabel: string | null;
  dateState: 'awaiting_painter_dates' | 'painter_offered' | 'customer_countered' | 'agreed';
  availability: null | { mode: 'exact'; windows: { start: string; end: string }[]; note?: string } | { mode: 'flexible'; around: string; flexDays: number; note?: string };
  counter: null | { start: string; end: string; note?: string };
  estimatedDays: number | null;
  customerTiming: string;
  // Contact details arrive only after the deposit is paid.
  painter: { companyName: string; ownerName?: string; email?: string; phone?: string } | null;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, margin: '16px 0' };
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--bg-page)', color: 'var(--text-primary)', width: '100%' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 };
const primaryBtn: React.CSSProperties = { padding: '12px 24px', background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { padding: '12px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' };

const ConfirmJob = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const paymentStatus = searchParams.get('payment');

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [windowIndex, setWindowIndex] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [counterStart, setCounterStart] = useState('');
  const [counterEnd, setCounterEnd] = useState('');
  const [counterNote, setCounterNote] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing confirmation link. Please use the link from your email.');
      setLoading(false);
      return null;
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/get-job-by-token?token=${encodeURIComponent(token)}`, {
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load job details');
      setJob(data);
      return data as JobDetails;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Back from Stripe: the webhook confirms the job a moment after the redirect, so poll briefly.
  useEffect(() => {
    if (paymentStatus !== 'success' || !job || job.depositStatus === 'paid') return;
    let tries = 0;
    const id = setInterval(async () => {
      tries++;
      const j = await load();
      if (j?.depositStatus === 'paid' || tries >= 12) clearInterval(id);
    }, 2500);
    return () => clearInterval(id);
  }, [paymentStatus, job?.depositStatus, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/customer-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ token, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong.');
      setSuggesting(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const url = await createDepositCheckout(token);
      if (!url) {
        setError('We couldn\'t start checkout. Please try again in a moment.');
        return;
      }
      window.location.href = url;
    } catch {
      setError('Something went wrong starting checkout. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="confirm-job-page" style={{ padding: 40 }}><p>Loading job details…</p></div>;

  if (error && !job) {
    return (
      <div className="confirm-job-page" style={{ padding: 40 }}>
        <h1>Confirm Your Job</h1>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }
  if (!job) return null;

  const paid = job.depositStatus === 'paid' || job.status === 'confirmed' || job.status === 'completed';
  const today = todayIso();
  const avail = job.availability;
  const estimate = job.estimatedDays ? `about ${job.estimatedDays} working day${job.estimatedDays === 1 ? '' : 's'}` : null;

  return (
    <div className="confirm-job-page" style={{ maxWidth: 580, margin: '0 auto', padding: '40px 20px' }}>
      <h1>{paid ? 'Your project is confirmed' : 'Confirm your dates'}</h1>

      {paymentStatus === 'cancelled' && !paid && <p style={{ color: 'var(--accent)' }}>Payment was cancelled. You can try again below.</p>}
      {paymentStatus === 'success' && !paid && <p style={{ color: 'var(--text-secondary)' }}>Payment received. Confirming your booking…</p>}

      {/* ---------- PAID ---------- */}
      {paid && (
        <>
          <p style={{ color: 'var(--success)' }}>Deposit received. {job.painter?.companyName} has your details and will be in touch.</p>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>{job.painter?.companyName}</h2>
            {job.painter?.ownerName && <p style={{ margin: '0 0 6px' }}>{job.painter.ownerName}</p>}
            {job.painter?.email && (
              <p style={{ margin: 0 }}>
                Email: <a href={`mailto:${job.painter.email}`}>{job.painter.email}</a><br />
                Phone: <a href={`tel:${job.painter.phone}`}>{job.painter.phone}</a>
              </p>
            )}
          </div>
          {job.scheduledDate && (
            <>
              <p>Work happens: <strong>{fmtRange(job.scheduledDate, job.scheduledEndDate)}</strong></p>
              <AddToCalendar event={{ uid: job.jobId, title: `Painting project${job.painter ? ` — ${job.painter.companyName}` : ''}`, date: job.scheduledDate, endDate: job.scheduledEndDate }} />
            </>
          )}
          <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Remaining balance: {currency(job.guaranteedPrice - job.depositAmount)}, paid directly to your painter.
          </p>
        </>
      )}

      {/* ---------- NOT PAID YET ---------- */}
      {!paid && (
        <>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>{job.painter?.companyName}</h2>
            <p style={{ margin: '0 0 4px' }}>Job price: <strong>{currency(job.guaranteedPrice)}</strong> · Deposit due: <strong>{currency(job.depositAmount)}</strong></p>
            <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Your timing: {job.customerTiming}{estimate ? ` · Expected time on site: ${estimate}` : ''}
            </p>
            <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.8rem' }}>Your painter's contact details are shared once your deposit is paid.</p>
          </div>

          {job.dateState === 'awaiting_painter_dates' && (
            <div style={card}>
              <p style={{ margin: 0 }}>Your painter is choosing when they can start. We'll email you the moment their dates are in.</p>
            </div>
          )}

          {job.dateState === 'customer_countered' && job.counter && (
            <div style={card}>
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Waiting on your painter</p>
              <p style={{ margin: 0 }}>You suggested {fmtRange(job.counter.start, job.counter.end)}. We've asked your painter to accept or offer other dates, and we'll email you.</p>
            </div>
          )}

          {(job.dateState === 'painter_offered' || job.dateState === 'agreed') && avail && (
            <div style={card}>
              {job.dateState === 'agreed' && job.scheduledDate ? (
                <>
                  <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Your dates</p>
                  <p style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{fmtRange(job.scheduledDate, job.scheduledEndDate)}</p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
                    {avail.mode === 'exact' ? 'Your painter is available:' : 'Your painter is flexible — pick your start date'}
                  </p>
                  {avail.note && <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>“{avail.note}”</p>}

                  {avail.mode === 'exact' ? (
                    <>
                      {avail.windows.map((w, i) => (
                        <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                          <input type="radio" name="window" checked={windowIndex === i} onChange={() => setWindowIndex(i)} />
                          <span>{fmtRange(w.start, w.end)}</span>
                        </label>
                      ))}
                      <button style={{ ...primaryBtn, marginTop: 8, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => act({ action: 'accept', windowIndex })}>
                        Use these dates
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        They can start any day from {fmtDate(addDaysIso(avail.around, -avail.flexDays) < today ? today : addDaysIso(avail.around, -avail.flexDays))} to {fmtDate(addDaysIso(avail.around, avail.flexDays))}
                        {estimate ? `; the job takes ${estimate}` : ''}.
                      </p>
                      <label style={label}>Your start date</label>
                      <input
                        type="date"
                        style={input}
                        value={startDate}
                        min={addDaysIso(avail.around, -avail.flexDays) < today ? today : addDaysIso(avail.around, -avail.flexDays)}
                        max={addDaysIso(avail.around, avail.flexDays)}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <button style={{ ...primaryBtn, marginTop: 10, opacity: busy || !startDate ? 0.6 : 1 }} disabled={busy || !startDate} onClick={() => act({ action: 'choose', startDate })}>
                        Use this start date
                      </button>
                    </>
                  )}
                </>
              )}

              {job.dateState === 'agreed' && (
                <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, marginRight: 10 }} disabled={busy} onClick={handleConfirmAndPay}>
                  {busy ? 'Starting checkout…' : `Confirm & pay ${currency(job.depositAmount)} deposit`}
                </button>
              )}

              {!suggesting && (
                <button style={{ ...secondaryBtn, marginTop: 10 }} onClick={() => setSuggesting(true)}>
                  {job.dateState === 'agreed' ? 'Change my dates' : 'None of these work — suggest other dates'}
                </button>
              )}

              {suggesting && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Suggest a timeframe</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={label}>From</label>
                      <input type="date" min={today} style={input} value={counterStart} onChange={(e) => { setCounterStart(e.target.value); if (counterEnd && counterEnd < e.target.value) setCounterEnd(e.target.value); }} />
                    </div>
                    <div>
                      <label style={label}>To</label>
                      <input type="date" min={counterStart || today} style={input} value={counterEnd} onChange={(e) => setCounterEnd(e.target.value)} />
                    </div>
                  </div>
                  <textarea rows={2} style={{ ...input, marginTop: 8 }} maxLength={500} placeholder="Anything your painter should know? (optional)" value={counterNote} onChange={(e) => setCounterNote(e.target.value)} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <button style={{ ...primaryBtn, opacity: busy || !counterStart || !counterEnd ? 0.6 : 1 }} disabled={busy || !counterStart || !counterEnd} onClick={() => act({ action: 'counter', start: counterStart, end: counterEnd, note: counterNote })}>
                      Send to my painter
                    </button>
                    <button style={secondaryBtn} onClick={() => setSuggesting(false)}>Cancel</button>
                  </div>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-faint)', fontSize: '0.8rem' }}>Your painter will be emailed to accept or offer other dates. We'll email you either way.</p>
                </div>
              )}
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        </>
      )}
    </div>
  );
};

export default ConfirmJob;
