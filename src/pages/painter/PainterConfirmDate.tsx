import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseUrl, supabaseAnonKey } from '../../lib/supabase';

interface JobPrefill {
  jobId: string;
  zipCode: string;
  guaranteedPrice: number;
  customerPreferredDate: string | null;
  scheduledDate: string | null;
  phaseLabel: string | null;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/**
 * Landed on right after a painter accepts a job (see claim-job's redirect).
 * Deliberately masked — no customer name/address/phone here, same privacy
 * boundary as the rest of the pre-deposit claim flow.
 */
const PainterConfirmDate = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const painterId = searchParams.get('painter_id');

  const [job, setJob] = useState<JobPrefill | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token || !painterId) {
      setError('Missing link information. Please use the link from your email.');
      setLoading(false);
      return;
    }
    fetch(`${supabaseUrl}/functions/v1/confirm-painter-date?token=${encodeURIComponent(token)}&painter_id=${encodeURIComponent(painterId)}`, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load job details');
        setJob(data);
        setDate(data.scheduledDate || data.customerPreferredDate || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load job details'))
      .finally(() => setLoading(false));
  }, [token, painterId]);

  const handleSubmit = async () => {
    if (!token || !painterId || !date) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/confirm-painter-date`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, painterId, scheduledDate: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm date');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>Loading job details…</div>;
  }

  if (error && !job) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        <h1>Confirm Start Date</h1>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  if (!job) return null;

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        <h1>Date confirmed!</h1>
        <p>We've let the customer know and asked them to confirm and pay the deposit — you'll get their full contact details as soon as they do.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <h1>You accepted this job{job.phaseLabel ? ` — ${job.phaseLabel}` : ''}!</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        One last step — set the start date so the customer can confirm and pay the deposit.
      </p>

      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 24, margin: '20px 0' }}>
        <p>ZIP: <strong>{job.zipCode}</strong></p>
        <p>Job price: <strong>{currency(job.guaranteedPrice)}</strong></p>
        {job.customerPreferredDate && (
          <p>Customer requested: <strong>{job.customerPreferredDate}</strong></p>
        )}
      </div>

      <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Start date
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-page)', color: 'var(--text-primary)', width: '100%', maxWidth: 220 }}
      />

      {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || !date}
          style={{
            padding: '12px 24px',
            background: 'var(--accent-blue)',
            color: 'var(--accent-blue-ink)',
            border: 'none',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: submitting || !date ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Confirming…' : 'Confirm Start Date'}
        </button>
      </div>
    </div>
  );
};

export default PainterConfirmDate;
