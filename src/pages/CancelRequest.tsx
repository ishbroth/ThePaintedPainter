import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../lib/supabase';

/** "No thanks, cancel my request" from the painter-declined email. Pressing the button cancels. */
export default function CancelRequest() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/cancel-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify({ token, ...body }),
    });
    return { ok: res.ok, json: await res.json() };
  };

  useEffect(() => {
    if (!token) return setActive(false);
    call({ preview: true }).then(({ ok }) => setActive(ok));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const cancel = async () => {
    setBusy(true);
    const { ok, json } = await call({});
    setBusy(false);
    if (!ok) return setError(json.error || 'Could not cancel. Please try again.');
    setDone(true);
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6" style={{ minHeight: '60vh' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 16px' }}>Cancel your request</h1>
      {active === null && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {active === false && !done && <p style={{ color: 'var(--text-secondary)' }}>This request is no longer active (it may have expired or already been cancelled).</p>}
      {active && !done && (
        <>
          <p style={{ color: 'var(--text-secondary)' }}>Cancel your painter request? Nothing has been charged. You can start a new search any time.</p>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            onClick={cancel}
            disabled={busy}
            style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Cancelling…' : 'Yes, cancel my request'}
          </button>
        </>
      )}
      {done && <p style={{ color: 'var(--text-primary)' }}>Your request is cancelled. No charge was made.</p>}
      <p style={{ marginTop: 20 }}><Link to="/" style={{ color: 'var(--accent-blue)' }}>Back to The Painted Painter</Link></p>
    </div>
  );
}
