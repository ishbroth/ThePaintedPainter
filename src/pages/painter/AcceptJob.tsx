import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../../lib/supabase';

interface Preview {
  open: boolean;
  zip: string | null;
  payoutAmount: number | null;
  timelineLabel: string | null;
  preferredDate: string | null;
  qa: { question: string; answer: string }[];
  photos: { url: string; description: string; label: string }[];
}

const money = (n: number | null) =>
  n == null ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/**
 * Where "Accept this job" in the offer email lands. Opening the page only shows
 * the job; the job is claimed when the painter presses the button. (An email
 * link that accepted on open would be triggered by mail scanners that
 * pre-fetch links.)
 */
export default function AcceptJob() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const painterId = params.get('painter_id');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  const endpoint = `${supabaseUrl}/functions/v1/claim-job`;
  const headers = { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` };

  useEffect(() => {
    if (!token || !painterId) {
      setError('This link is incomplete. Please use the link from your email.');
      return;
    }
    fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ token, painterId, preview: true }) })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load this job.');
        setPreview(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this job.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, painterId]);

  const accept = async () => {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ token, painterId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not accept this job.');
      const next = new URL(json.dateConfirmUrl);
      window.location.assign(`${next.pathname}${next.search}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept this job.');
      setAccepting(false);
    }
  };

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6" style={{ minHeight: '60vh' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px' }}>New job offer</h1>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!preview && !error && <p style={{ color: 'var(--text-secondary)' }}>Loading the job…</p>}

      {preview && (
        <>
          <div style={card}>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 4px' }}>Near ZIP {preview.zip ?? 'N/A'}</p>
            <p style={{ color: 'var(--accent)', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 8px' }}>You'd be paid {money(preview.payoutAmount)}</p>
            <p style={{ color: 'var(--text-faint)', fontSize: '0.9rem', margin: 0 }}>
              {preview.timelineLabel || 'Timeline not specified'}
              {preview.preferredDate ? ` · Requested start: ${preview.preferredDate}` : ''}
            </p>
          </div>

          {preview.qa.length > 0 && (
            <div style={card}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 8px' }}>Job details</p>
              {preview.qa.map((item, i) => (
                <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0' }}>
                  <strong>{item.question}:</strong> {item.answer}
                </p>
              ))}
            </div>
          )}

          {preview.photos.length > 0 && (
            <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {preview.photos.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" title={p.description}>
                  <img src={p.url} alt={p.description || p.label} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                </a>
              ))}
            </div>
          )}

          {preview.open ? (
            <>
              <button
                onClick={accept}
                disabled={accepting}
                style={{ width: '100%', padding: '14px 20px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: accepting ? 'not-allowed' : 'pointer', opacity: accepting ? 0.6 : 1 }}
              >
                {accepting ? 'Accepting…' : 'Accept this job'}
              </button>
              <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 10 }}>
                First come, first served. After accepting you'll choose a start date; the customer then confirms and pays their deposit.
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--danger)' }}>This job has already been taken. Keep an eye out for the next one!</p>
          )}
        </>
      )}
    </div>
  );
}
