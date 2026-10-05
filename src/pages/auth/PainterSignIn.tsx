import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import SignInRoleToggle from '../../components/auth/SignInRoleToggle';

export default function PainterSignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
      } else {
        navigate('/painter/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg p-8">
        <SignInRoleToggle active="painter" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">Painter Sign In</h1>
        <p className="text-[var(--text-secondary)] text-center mt-2 mb-6">
          Sign in to manage your painter profile
        </p>

        {error && (
          <div className="bg-[var(--tint-critical-bg)] border border-[var(--tint-critical-border)] text-[var(--danger)] px-4 py-3 rounded mb-4 text-sm">
            {error}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-blue)]"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--accent-blue-ink)] font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link
            to="/painter-signup"
            className="block text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] text-sm font-medium"
          >
            Create a painter account
          </Link>
          <Link
            to="/auth/forgot-password?role=painter"
            className="block text-[var(--text-faint)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
