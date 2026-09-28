import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

interface JobInfo {
  customerName: string | null;
  painterCompanyName: string;
  phaseLabel: string | null;
  completedAt: string | null;
  alreadyReviewed: boolean;
}

function Stars({ rating, hoverRating, onPick, onHover }: {
  rating: number;
  hoverRating: number;
  onPick: (n: number) => void;
  onHover: (n: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onPick(star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={() => onHover(0)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '2.2rem', lineHeight: 1 }}
        >
          <span style={{ color: star <= (hoverRating || rating) ? 'var(--accent)' : 'var(--border-strong)' }}>★</span>
        </button>
      ))}
    </div>
  );
}

const LeaveReview = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [job, setJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing review link. Please use the link from your email.');
      setLoading(false);
      return;
    }
    fetch(`${supabaseUrl}/functions/v1/get-job-by-review-token?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load job details');
        setJob(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load job details'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || rating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, title: title.trim() || undefined, body: body.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const wrapStyle: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '48px 20px' };

  if (loading) return <div style={wrapStyle}><p style={{ color: 'var(--text-secondary)' }}>Loading…</p></div>;

  if (error && !job) {
    return (
      <div style={wrapStyle}>
        <h1 style={{ color: 'var(--text-primary)' }}>Leave a Review</h1>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  if (!job) return null;

  if (job.alreadyReviewed || submitted) {
    return (
      <div style={{ ...wrapStyle, textAlign: 'center' }}>
        <h1 style={{ color: 'var(--text-primary)' }}>
          {submitted ? 'Thanks for your feedback!' : "You've already reviewed this job"}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {submitted
            ? `Your review of ${job.painterCompanyName} has been submitted.`
            : `Your review of ${job.painterCompanyName} is already on file.`}
        </p>
        <Link
          to="/"
          style={{ display: 'inline-block', marginTop: 20, padding: '12px 24px', background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}
        >
          Back to The Painted Painter
        </Link>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <h1 style={{ color: 'var(--text-primary)', marginBottom: 4 }}>How did it go?</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        {job.customerName ? `Hi ${job.customerName.split(' ')[0]}, y` : 'Y'}our project{job.phaseLabel ? ` (${job.phaseLabel})` : ''} with{' '}
        <strong style={{ color: 'var(--accent)' }}>{job.painterCompanyName}</strong> was marked complete. Let us know how it went.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 10 }}>
            Rating <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <Stars rating={rating} hoverRating={hoverRating} onPick={setRating} onHover={setHoverRating} />
          {rating === 0 && (
            <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 6 }}>Click a star to set your rating</p>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="reviewTitle" style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 6 }}>
            Review Title
          </label>
          <input
            id="reviewTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarize your experience"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="reviewBody" style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 6 }}>
            Your Review
          </label>
          <textarea
            id="reviewBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Tell others about your experience..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </div>

        {error && <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>}

        <button
          type="submit"
          disabled={rating === 0 || submitting}
          style={{
            padding: '12px 28px',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: rating === 0 ? 'var(--border-strong)' : 'var(--accent)',
            color: 'var(--accent-ink)',
            cursor: rating === 0 || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
};

export default LeaveReview;
