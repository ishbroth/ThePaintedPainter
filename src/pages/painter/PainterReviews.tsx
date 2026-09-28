import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  customer_name: string | null;
  created_at: string;
}

function Stars({ rating, size = 'text-base' }: { rating: number; size?: string }) {
  return (
    <span className={`${size} text-[var(--accent)]`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < Math.round(rating) ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

export default function PainterReviews() {
  const { session } = useAuth();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('reviews')
      .select('id, rating, title, body, customer_name, created_at')
      .eq('painter_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setReviews(data ?? []);
        }
        setLoading(false);
      });
  }, [session?.user?.id]);

  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Reviews</h1>

      {loading && <p className="text-[var(--text-secondary)]">Loading reviews…</p>}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      {!loading && !error && reviews && (
        <>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 text-center mb-8">
            <p className="text-5xl font-bold text-[var(--text-primary)] mb-2">
              {reviews.length > 0 ? avgRating.toFixed(1) : '—'}
            </p>
            <Stars rating={avgRating} size="text-2xl" />
            <p className="text-[var(--text-secondary)] text-sm mt-2">
              Based on {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </p>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-faint)]">
              <p className="text-lg mb-2">No reviews yet</p>
              <p className="text-sm">Once you mark a job completed, the customer gets invited to leave a review — it'll show up here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-primary)] font-semibold text-sm">
                        {(review.customer_name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-[var(--text-primary)] font-semibold text-sm">{review.customer_name ?? 'A customer'}</p>
                        <p className="text-xs text-[var(--text-faint)]">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Stars rating={review.rating} />
                  </div>
                  {review.title && <p className="text-[var(--text-primary)] font-medium text-sm mb-1">{review.title}</p>}
                  {review.body && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{review.body}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
