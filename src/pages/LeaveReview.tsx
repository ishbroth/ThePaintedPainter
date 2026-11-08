import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { compressImage, uploadQuotePhoto } from '../lib/chatEstimator/photoUpload';

const MAX_PHOTOS = 6;

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
  const [photos, setPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;
    setPhotoError('');
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setPhotoError(`Up to ${MAX_PHOTOS} photos.`);
    setPhotos((prev) => [...prev, ...files.slice(0, room).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  }

  function removePhoto(i: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  useEffect(
    () => () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || rating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const uploaded: { url: string }[] = [];
      for (const p of photos) {
        const small = await compressImage(p.file).catch(() => p.file);
        uploaded.push({ url: await uploadQuotePhoto(small) });
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, title: title.trim() || undefined, body: body.trim() || undefined, photos: uploaded }),
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

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 8 }}>
            Photos (optional)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                <img src={p.previewUrl} alt={`Attached photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label="Remove photo"
                  style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: 80, height: 80, borderRadius: 8, border: '2px dashed var(--border-strong)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1, color: 'var(--accent)' }}>+</span>
                <span style={{ fontSize: '0.7rem' }}>Add</span>
              </button>
            )}
          </div>
          {photoError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 6 }}>{photoError}</p>}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onPickPhotos} style={{ display: 'none' }} />
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
