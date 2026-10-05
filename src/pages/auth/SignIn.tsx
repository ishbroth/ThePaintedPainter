import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import { dashboardPathForRole } from '../../lib/auth/roleRoutes.ts';

/**
 * One sign-in for everyone. There's no customer/painter choice to make: the
 * account's own role (set when it was created) decides where it lands, so a
 * painter who signs in is taken to the painter dashboard and a customer to the
 * customer one.
 */
export default function SignIn() {
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Once the session and profile are loaded (right after signing in, or if
  // they were already signed in), send them to the right place.
  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate(dashboardPathForRole(profile.role), { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) setError(signInError.message);
      // On success the effect above redirects as soon as the profile loads.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const signedInButNoProfile = !authLoading && user && !profile;

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">Sign In</h1>
        <p className="text-[var(--text-secondary)] text-center mt-2 mb-6">Welcome back</p>

        {error && (
          <div className="bg-[var(--tint-critical-bg)] border border-[var(--tint-critical-border)] text-[var(--danger)] px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        {signedInButNoProfile && (
          <div className="bg-[var(--tint-critical-bg)] border border-[var(--tint-critical-border)] text-[var(--danger)] px-4 py-3 rounded mb-4 text-sm">
            You're signed in, but we couldn't load your profile. Please try again in a moment or contact support.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-blue)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-blue)]"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--accent-blue-ink)] font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link
            to="/auth/customer-sign-up"
            className="block text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] text-sm font-medium"
          >
            Create a customer account
          </Link>
          <Link
            to="/painter-signup"
            className="block text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] text-sm font-medium"
          >
            Apply to join as a painter
          </Link>
          <Link
            to="/auth/forgot-password"
            className="block text-[var(--text-faint)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
