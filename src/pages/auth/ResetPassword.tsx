import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Step 2 of password reset. Supabase's emailed link returns here with a
// recovery session in the URL; supabase-js picks it up automatically, after
// which updateUser({ password }) sets the new password.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords don\'t match.');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    setDone(true);
    // They're signed in via the recovery session; sign out so they log in fresh with the new password.
    await supabase.auth.signOut();
    setTimeout(() => navigate('/auth/customer-sign-in'), 2500);
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">Choose a new password</h1>

        {done ? (
          <p className="text-[var(--text-secondary)] text-center mt-4">Password updated. Taking you to sign in…</p>
        ) : !ready ? (
          <p className="text-[var(--text-secondary)] text-center mt-4">
            This reset link is invalid or has expired.{' '}
            <Link to="/auth/forgot-password" className="text-[var(--accent-blue)] underline">Request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {error && (
              <div className="bg-[var(--tint-critical-bg)] border border-[var(--tint-critical-border)] text-[var(--danger)] px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (8+ characters)"
              className="w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 text-[var(--accent-blue-ink)] font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
