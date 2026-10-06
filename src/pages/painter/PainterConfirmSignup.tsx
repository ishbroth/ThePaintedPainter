import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../../lib/supabase';

// Landing page for the link in the painter sign-up confirmation email. The
// account is only created when the button is pressed (not on page load), so
// email scanners that open links can't confirm anyone by accident.
export default function PainterConfirmSignup() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const confirm = async () => {
    setState('working');
    setError('');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/confirm-painter-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not confirm your email.');
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm your email.');
      setState('error');
    }
  };

  return (
    <div className="text-[var(--text-primary)]" style={{ minHeight: '60vh', padding: '64px 20px', textAlign: 'center' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {!token && <p style={{ color: 'var(--danger)' }}>This confirmation link is incomplete. Please use the link from your email.</p>}

        {token && state !== 'done' && (
          <>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 12px' }}>Confirm your email</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
              One last step. Confirming creates your account and sends your application to our team for review.
            </p>
            <button
              onClick={confirm}
              disabled={state === 'working'}
              style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, cursor: state === 'working' ? 'not-allowed' : 'pointer', opacity: state === 'working' ? 0.6 : 1 }}
            >
              {state === 'working' ? 'Confirming…' : 'Confirm email & submit application'}
            </button>
            {state === 'error' && <p style={{ color: 'var(--danger)', marginTop: 16 }}>{error}</p>}
          </>
        )}

        {state === 'done' && (
          <>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 12px' }}>Your account is created</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
              Thanks, we've created your account and your application is being reviewed. You will be notified when you're approved to join The Painted Painter's network!
            </p>
            <Link
              to="/auth/sign-in"
              style={{ display: 'inline-block', padding: '12px 24px', borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, textDecoration: 'none' }}
            >
              Sign in to profile
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
