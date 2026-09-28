import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Supabase auth email links (confirm signup, magic link, password reset)
 * redirect back to the site with either `#access_token=...` (success — the
 * SDK already picks this up automatically, no code needed) or
 * `#error=...&error_code=...&error_description=...` (failure — e.g. an
 * expired or already-used link). The SDK does NOT surface that error case
 * anywhere; without this, a failed confirmation just silently lands on a
 * normal-looking homepage with zero explanation, which is exactly what
 * looks like "nothing happened."
 */
const ERROR_MESSAGES: Record<string, string> = {
  otp_expired: "That confirmation link has expired or was already used. Enter your email below and we'll send a new one.",
  access_denied: "That link is no longer valid. Enter your email below and we'll send a new one.",
};

/** Reads the redirect hash synchronously — window.location.hash is already
 * present at first render (it arrived via the page navigation itself, not
 * asynchronously afterward), so this belongs in a lazy useState initializer
 * rather than an effect+setState pair. */
function parseAuthRedirect(): { state: 'none' | 'error' | 'confirmed'; message: string } {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return { state: 'none', message: '' };

  const params = new URLSearchParams(hash.slice(1));
  const error = params.get('error');
  const errorCode = params.get('error_code');
  const type = params.get('type');
  const accessToken = params.get('access_token');

  if (error) {
    return {
      state: 'error',
      message:
        (errorCode && ERROR_MESSAGES[errorCode]) ||
        params.get('error_description')?.replace(/\+/g, ' ') ||
        "That link is no longer valid. Enter your email below and we'll send a new one.",
    };
  }
  if (accessToken && type === 'signup') {
    return { state: 'confirmed', message: '' };
  }
  return { state: 'none', message: '' };
}

const AuthRedirectBanner = () => {
  const [{ state, message }] = useState(parseAuthRedirect);
  const [email, setEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    // Clean the token/error out of the URL so a refresh doesn't re-trigger it.
    if (state !== 'none') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [state]);

  const handleResend = async () => {
    if (!email.trim()) return;
    setResendStatus('sending');
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResendStatus(error ? 'error' : 'sent');
  };

  if (state === 'none') return null;

  return (
    <div
      style={{
        background: state === 'error' ? 'var(--tint-critical-bg)' : 'var(--tint-success-bg)',
        borderBottom: `1px solid ${state === 'error' ? 'var(--tint-critical-border)' : 'var(--tint-success-border)'}`,
        padding: '10px 20px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {state === 'confirmed' ? (
        <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>
          Email confirmed — you're all set!
        </span>
      ) : resendStatus === 'sent' ? (
        <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>
          New confirmation email sent — check your inbox.
        </span>
      ) : (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <span style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{message}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--input-border)',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
          <button
            onClick={handleResend}
            disabled={resendStatus === 'sending' || !email.trim()}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: resendStatus === 'sending' ? 'not-allowed' : 'pointer',
            }}
          >
            {resendStatus === 'sending' ? 'Sending…' : 'Resend Email'}
          </button>
          {resendStatus === 'error' && (
            <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>Couldn't send — try again shortly.</span>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthRedirectBanner;
