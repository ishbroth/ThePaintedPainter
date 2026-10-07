import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { publicSiteUrl } from '../../lib/platform';

// Step 1 of password reset: ask for the email and send Supabase's reset link,
// which lands on /auth/reset-password.
export default function ForgotPassword() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${publicSiteUrl()}/auth/reset-password`,
    });
    setLoading(false);
    // Don't reveal whether the address has an account; only surface real failures (e.g. rate limiting).
    if (resetError && resetError.status !== 400) setError(resetError.message);
    else setSent(true);
  };


  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">Reset your password</h1>

        {sent ? (
          <p className="text-[var(--text-secondary)] text-center mt-4">
            If there's an account for <strong>{email.trim()}</strong>, we've emailed a link to reset your password.
          </p>
        ) : (
          <>
            <p className="text-[var(--text-secondary)] text-center mt-2 mb-6">
              Enter your email and we'll send you a link to choose a new password.
            </p>
            {error && (
              <div className="bg-[var(--tint-critical-bg)] border border-[var(--tint-critical-border)] text-[var(--danger)] px-4 py-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 text-[var(--accent-blue-ink)] font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link to="/auth/sign-in" className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] text-sm font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
