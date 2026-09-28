import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabaseUrl } from '../../lib/supabase';

interface JobPhoto {
  url: string;
  description: string;
  label: string;
}

interface Offer {
  id: string;
  zip: string | null;
  payoutAmount: number | null;
  timelineLabel: string | null;
  preferredDate: string | null;
  phaseLabel: string | null;
  photos: JobPhoto[];
}

interface Job {
  id: string;
  status: 'painter_accepted' | 'confirmed' | 'completed';
  price: number | null;
  payoutAmount: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  address: string;
  scheduledDate: string | null;
  preferredDate: string | null;
  phaseLabel: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  photos: JobPhoto[];
}

interface PainterProjectsData {
  companyName: string;
  offers: Offer[];
  confirmed: Job[];
  completed: Job[];
  totalEarnings: number;
  rating: { avgRating: number; reviewCount: number };
}

const currency = (n: number | null) =>
  n == null ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < Math.round(rating) ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 6px' }}>{label}</p>
      <p style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 700, margin: '32px 0 14px' }}>{children}</h2>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-faint)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
      {text}
    </div>
  );
}

function PhotoThumbnails({ photos }: { photos: JobPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {photos.map((p, i) => (
        <a key={i} href={p.url} target="_blank" rel="noreferrer" title={p.description}>
          <img
            src={p.url}
            alt={p.description || p.label}
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </a>
      ))}
    </div>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>
          {offer.phaseLabel || 'Painting job'} {offer.zip ? `— ${offer.zip}` : ''}
        </p>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', margin: 0 }}>
          {offer.timelineLabel || 'Timeline not specified'}
          {offer.preferredDate ? ` · Requested start: ${offer.preferredDate}` : ''}
        </p>
        <PhotoThumbnails photos={offer.photos} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', margin: '0 0 4px' }}>{currency(offer.payoutAmount)}</p>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem', margin: 0 }}>Respond from the offer email</p>
      </div>
    </div>
  );
}

function JobCard({ job, onMarkCompleted, marking }: { job: Job; onMarkCompleted?: (id: string) => void; marking: boolean }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>{job.phaseLabel || 'Painting job'}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>{job.address}</p>
          {job.customerName && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 2px' }}>
              {job.customerName}
              {job.customerEmail && <> · <a href={`mailto:${job.customerEmail}`} style={{ color: 'var(--accent-blue)' }}>{job.customerEmail}</a></>}
              {job.customerPhone && <> · <a href={`tel:${job.customerPhone}`} style={{ color: 'var(--accent-blue)' }}>{job.customerPhone}</a></>}
            </p>
          )}
          <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', margin: 0 }}>
            {job.status === 'completed'
              ? `Completed ${job.completedAt ?? ''}`
              : `${job.scheduledDate ? `Scheduled: ${job.scheduledDate}` : job.preferredDate ? `Requested: ${job.preferredDate}` : 'Date not yet set'}`}
          </p>
          <PhotoThumbnails photos={job.photos} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 4px' }}>{currency(job.payoutAmount ?? job.price)}</p>
          {job.status === 'painter_accepted' && (
            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-border)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Awaiting customer deposit
            </span>
          )}
          {job.status === 'confirmed' && onMarkCompleted && (
            <button
              onClick={() => onMarkCompleted(job.id)}
              disabled={marking}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: marking ? 'not-allowed' : 'pointer' }}
            >
              {marking ? 'Marking…' : 'Mark Completed & Paid'}
            </button>
          )}
          {job.status === 'completed' && (
            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: 'var(--tint-success-bg)', border: '1px solid var(--tint-success-border)', color: 'var(--success)', fontSize: '0.75rem' }}>
              Done
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PainterProjects() {
  const { session } = useAuth();
  const [data, setData] = useState<PainterProjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = () => {
    if (!session?.access_token) return;
    setLoading(true);
    fetch(`${supabaseUrl}/functions/v1/get-painter-projects`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load projects');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [session?.access_token]);

  const handleMarkCompleted = async (jobId: string) => {
    if (!session?.access_token) return;
    setMarkingId(jobId);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/mark-job-completed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to mark job completed');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark job completed');
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading your projects…</p>;
  if (error && !data) return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px' }}>My Projects</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 20px' }}>
        Incoming offers, your schedule, completed jobs, and your rating — all in one place.
      </p>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <StatCard label="Incoming Offers" value={String(data.offers.length)} />
        <StatCard label="Confirmed Jobs" value={String(data.confirmed.length)} />
        <StatCard label="Total Earned" value={currency(data.totalEarnings)} sub={`${data.completed.length} completed job${data.completed.length === 1 ? '' : 's'}`} />
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 6px' }}>Your Rating</p>
          {data.rating.reviewCount > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 700 }}>{data.rating.avgRating.toFixed(1)}</span>
                <Stars rating={data.rating.avgRating} />
              </div>
              <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', margin: '4px 0 0' }}>{data.rating.reviewCount} review{data.rating.reviewCount === 1 ? '' : 's'}</p>
            </>
          ) : (
            <p style={{ color: 'var(--text-faint)', fontSize: '0.9rem', margin: 0 }}>No reviews yet</p>
          )}
        </div>
      </div>

      <SectionHeading>Incoming Offers</SectionHeading>
      {data.offers.length === 0 ? (
        <EmptyState text="No incoming offers right now — new jobs in your area will show up here." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.offers.map((o) => <OfferCard key={o.id} offer={o} />)}
        </div>
      )}

      <SectionHeading>Confirmed &amp; Upcoming</SectionHeading>
      {data.confirmed.length === 0 ? (
        <EmptyState text="No confirmed jobs yet. Once you accept an offer and the customer pays their deposit, it'll show up here." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.confirmed.map((j) => (
            <JobCard key={j.id} job={j} onMarkCompleted={handleMarkCompleted} marking={markingId === j.id} />
          ))}
        </div>
      )}

      <SectionHeading>Completed</SectionHeading>
      {data.completed.length === 0 ? (
        <EmptyState text="Completed jobs will show up here once you mark them done." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.completed.map((j) => <JobCard key={j.id} job={j} marking={false} />)}
        </div>
      )}
    </div>
  );
}
