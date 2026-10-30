import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../lib/supabase';

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** "Cancel request" from the "we received your request" email: asks once more, then closes the request. */
export default function CancelClaim() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'done'>('loading');
  const [price, setPrice] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/cancel-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify({ token, ...body }),
    });
    return { ok: res.ok, json: (await res.json().catch(() => ({}))) as { error?: string; price?: number; code?: string } };
  };

  useEffect(() => {
    if (!token) {
      setMessage('This link is not valid.');
      setState('unavailable');
      return;
    }
    call({ preview: true }).then(({ ok, json }) => {
      if (ok) {
        setPrice(typeof json.price === 'number' ? json.price : null);
        setState('ready');
      } else {
        setMessage(json.error || 'This request can no longer be cancelled.');
        setState('unavailable');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const cancel = async () => {
    setBusy(true);
    const { ok, json } = await call({});
    setBusy(false);
    if (!ok) {
      setMessage(json.error || 'We could not cancel it. Please try again.');
      setConfirming(false);
      if (json.code === 'not_cancellable' || json.code === 'already_cancelled') setState('unavailable');
      return;
    }
    setState('done');
  };

  const heading: React.CSSProperties = { color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px' };
  const text: React.CSSProperties = { color: 'var(--text-secondary)' };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6" style={{ minHeight: '60vh' }}>
      <h1 style={heading}>Cancel your request</h1>
      {state === 'loading' && <p style={text}>Loading…</p>}
      {state === 'unavailable' && <p style={text}>{message}</p>}
      {state === 'ready' && !confirming && (
        <>
          <p style={text}>
            This closes your request{price ? ` for ${money(price)}` : ''}. The painters will no longer be able to accept it, and nothing has been charged.
          </p>
          {message && <p style={{ color: 'var(--danger)' }}>{message}</p>}
          <button
            onClick={() => setConfirming(true)}
            style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Cancel request
          </button>
        </>
      )}
      {state === 'ready' && confirming && (
        <>
          <p style={{ ...text, fontWeight: 700, color: 'var(--text-primary)' }}>Are you sure you want to lose this guaranteed price?</p>
          <p style={text}>Once it is cancelled you would need to get a new price, and it may not be the same.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button
              onClick={cancel}
              disabled={busy}
              style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {busy ? 'Cancelling…' : 'Yes, cancel and lose my price'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              style={{ padding: '12px 22px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
            >
              No, keep my request
            </button>
          </div>
        </>
      )}
      {state === 'done' && <p style={{ color: 'var(--text-primary)' }}>Your request is cancelled. Nothing was charged. You are welcome to get a new price any time.</p>}
      <p style={{ marginTop: 20 }}><Link to="/" style={{ color: 'var(--accent-blue)' }}>Back to The Painted Painter</Link></p>
    </div>
  );
}
