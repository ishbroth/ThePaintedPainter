import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../lib/supabase';

interface Preview { companyName: string; city: string; state: string; price: number; expiresAt: string }

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/**
 * Lands from "Choose <painter>" in the email sent after a painter declined. Opening the page only
 * shows the choice; the job is sent to that painter when the button is pressed (so email link
 * scanners can't pick a painter for the customer).
 */
export default function ChoosePainter() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const painterId = params.get('painter');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/choose-painter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify({ token, painterId, ...body }),
    });
    return { ok: res.ok, json: await res.json() };
  };

  useEffect(() => {
    if (!token || !painterId) return setError('This link is incomplete. Please use the link from your email.');
    call({ preview: true }).then(({ ok, json }) => (ok ? setPreview(json) : setError(json.error || 'This link is no longer active.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, painterId]);

  const choose = async () => {
    setBusy(true);
    setError('');
    const { ok, json } = await call({});
    setBusy(false);
    if (!ok) return setError(json.error || 'Could not send your job. Please try again.');
    setDone(true);
  };

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6" style={{ minHeight: '60vh' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px' }}>Choose your painter</h1>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!preview && !error && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}

      {preview && !done && (
        <>
          <div style={card}>
            <p style={{ margin: '0 0 2px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{preview.companyName}</p>
            <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{preview.city}, {preview.state}</p>
            <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{money(preview.price)} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-faint)' }}>guaranteed price</span></p>
          </div>
          <button
            onClick={choose}
            disabled={busy}
            style={{ width: '100%', padding: '14px 20px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Sending…' : `Send my job to ${preview.companyName}`}
          </button>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 10 }}>
            Nothing is charged yet. They'll be asked to accept and send you their available dates; you confirm and pay your deposit after that.
            This choice is available until {new Date(preview.expiresAt).toLocaleString()}.
          </p>
        </>
      )}

      {done && preview && (
        <div style={card}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>Sent to {preview.companyName}</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>We've emailed them your job. You'll get an email as soon as they respond.</p>
        </div>
      )}
      <p style={{ marginTop: 20 }}><Link to="/" style={{ color: 'var(--accent-blue)' }}>Back to The Painted Painter</Link></p>
    </div>
  );
}
