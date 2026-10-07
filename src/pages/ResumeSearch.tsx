import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabaseUrl } from '../lib/supabase';

/**
 * "See all my matching painters" from the painter-declined email. Asks the customer to sign in (or create
 * an account with the same email they used), then rebuilds their saved search results, minus the painter
 * who declined, until the 72-hour window ends.
 */
export default function ResumeSearch() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !session || !token) return;
    let cancelled = false;
    fetch(`${supabaseUrl}/functions/v1/resume-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'We couldn\'t load your search.');
        if (cancelled) return;
        navigate('/quote-results', {
          replace: true,
          state: { ...json.state, resumeToken: token, expiresAt: Date.parse(json.expiresAt) },
        });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'We couldn\'t load your search.'));
    return () => { cancelled = true; };
  }, [loading, session, token, navigate]);

  if (!token) return <Navigate to="/" replace />;
  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>;
  if (!session) return <Navigate to={`/auth/sign-in?next=${encodeURIComponent(`/resume-search?token=${token}`)}&reason=resume`} replace />;

  return (
    <div className="max-w-xl mx-auto p-6" style={{ minHeight: '50vh' }}>
      {error ? (
        <>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <p><Link to="/" style={{ color: 'var(--accent-blue)' }}>Start a new search</Link></p>
        </>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>Loading your search results…</p>
      )}
    </div>
  );
}
