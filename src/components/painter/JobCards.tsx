import { useState } from 'react';
import { Link } from 'react-router-dom';
import AddToCalendar from '../AddToCalendar';
import MessageButton from '../messaging/MessageButton';
import { fmtRange } from '../../lib/dates';

// The compact offer and job cards of the painter dashboard (what the old My Projects page showed, in less room).

export interface JobPhoto {
  url: string;
  description: string;
  label: string;
}

export interface Offer {
  id: string;
  zip: string | null;
  payoutAmount: number | null;
  timelineLabel: string | null;
  customerTiming?: string;
  estimatedDays?: number | null;
  preferredDate: string | null;
  phaseLabel: string | null;
  photos: JobPhoto[];
  acceptUrl: string;
}

export interface Job {
  id: string;
  status: 'painter_accepted' | 'confirmed' | 'completed';
  price: number | null;
  payoutAmount: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  address: string;
  scheduledDate: string | null;
  scheduledEndDate?: string | null;
  dateState?: 'awaiting_painter_dates' | 'painter_offered' | 'customer_countered' | 'agreed';
  estimatedDays?: number | null;
  preferredDate: string | null;
  phaseLabel: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  photos: JobPhoto[];
  setDateUrl: string | null;
  contract?: { draft: boolean; pending: boolean; accepted: boolean; declined: boolean };
}

export interface PainterProjectsData {
  companyName: string;
  offers: Offer[];
  confirmed: Job[];
  completed: Job[];
  totalEarnings: number;
  rating: { avgRating: number; reviewCount: number };
}

const currency = (n: number | null) =>
  n == null ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const box: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 };
const small: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '0 0 2px', lineHeight: 1.35 };
const linkBtn: React.CSSProperties = { color: 'var(--accent-blue)', fontSize: '0.78rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer' };

function PhotoThumbnails({ photos }: { photos: JobPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      {photos.map((p, i) => (
        <a key={i} href={p.url} target="_blank" rel="noreferrer" title={p.description}>
          <img src={p.url} alt={p.description || p.label} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
        </a>
      ))}
    </div>
  );
}

export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 2px' }}>
          {offer.phaseLabel || 'Painting job'}{offer.zip ? ` · ${offer.zip}` : ''}
        </p>
        <p style={{ ...small, color: 'var(--text-faint)' }}>
          {offer.customerTiming || offer.timelineLabel || 'Timing open'}
          {offer.estimatedDays ? ` · ~${offer.estimatedDays} day${offer.estimatedDays === 1 ? '' : 's'}` : ''}
        </p>
        <PhotoThumbnails photos={offer.photos} />
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem', margin: '0 0 4px' }}>{currency(offer.payoutAmount)}</p>
        <a
          href={offer.acceptUrl}
          style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 7, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none' }}
        >
          Accept
        </a>
      </div>
    </div>
  );
}

export function JobCard({ job, onMarkCompleted, onReschedule, marking, unread = 0, autoOpenMessages = false, onMessagesClosed, hideMessageButton = false }: {
  job: Job;
  onMarkCompleted?: (id: string) => void;
  onReschedule?: (id: string, date: string) => Promise<void>;
  marking: boolean;
  unread?: number;
  autoOpenMessages?: boolean;
  onMessagesClosed?: () => void;
  /** Messaging is shown separately (the Offers & messages section), so this card skips its own message button. */
  hideMessageButton?: boolean;
}) {
  const [newDate, setNewDate] = useState('');
  const [changing, setChanging] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const contract = job.contract;
  const contractLabel = contract?.declined && !contract.pending ? 'Contract · declined' : contract?.pending ? 'Contract · waiting' : contract?.accepted ? 'Contract · accepted' : 'Contract · prepare';
  const dateStatus = job.status === 'painter_accepted'
    ? (job.dateState === 'agreed' ? 'Awaiting deposit'
      : job.dateState === 'painter_offered' ? 'Waiting for customer dates'
      : job.dateState === 'customer_countered' ? 'Customer suggested new dates'
      : 'Send your dates')
    : null;

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 2px' }}>{job.phaseLabel || 'Painting job'}</p>
          <p style={small}>{job.address}</p>
          {job.customerName && (
            <p style={small}>
              {job.customerName}
              {job.customerPhone && <> · <a href={`tel:${job.customerPhone}`} style={{ color: 'var(--accent-blue)' }}>{job.customerPhone}</a></>}
              {job.customerEmail && <> · <a href={`mailto:${job.customerEmail}`} style={{ color: 'var(--accent-blue)' }}>email</a></>}
            </p>
          )}
          <p style={{ ...small, color: 'var(--text-faint)' }}>
            {job.status === 'completed'
              ? `Completed ${job.completedAt ?? ''}`
              : job.scheduledDate ? fmtRange(job.scheduledDate, job.scheduledEndDate)
              : job.preferredDate ? `Asked for: ${job.preferredDate}` : 'Dates not set'}
          </p>
        </div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', margin: 0, flexShrink: 0 }}>{currency(job.payoutAmount ?? job.price)}</p>
      </div>

      {dateStatus && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-border)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{dateStatus}</span>
          {job.setDateUrl && (
            <a href={job.setDateUrl} style={{ ...linkBtn, textDecoration: 'none' }}>
              {job.dateState === 'customer_countered' ? 'Review' : job.dateState === 'awaiting_painter_dates' ? 'Send dates' : 'Change'}
            </a>
          )}
        </div>
      )}

      <PhotoThumbnails photos={job.photos} />

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/painter/dashboard/contract/${job.id}`} style={{ ...linkBtn, textDecoration: 'none' }}>{contractLabel}</Link>
        {job.status === 'confirmed' && job.scheduledDate && (
          <AddToCalendar
            event={{ uid: job.id, title: `Paint job${job.customerName ? ` — ${job.customerName}` : ''}`, date: job.scheduledDate, endDate: job.scheduledEndDate, location: job.address }}
          />
        )}
        {job.status === 'confirmed' && onReschedule && !changing && (
          <button type="button" style={linkBtn} onClick={() => setChanging(true)}>Change date</button>
        )}
        {job.status === 'completed' && (
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--tint-success-bg)', border: '1px solid var(--tint-success-border)', color: 'var(--success)', fontSize: '0.7rem' }}>Done</span>
        )}
      </div>

      {changing && onReschedule && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={newDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setNewDate(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          />
          <button
            type="button"
            disabled={!newDate || rescheduling}
            onClick={async () => {
              setRescheduling(true);
              try { await onReschedule(job.id, newDate); setNewDate(''); setChanging(false); } finally { setRescheduling(false); }
            }}
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.78rem', cursor: !newDate || rescheduling ? 'not-allowed' : 'pointer' }}
          >
            {rescheduling ? 'Saving…' : 'Save'}
          </button>
          <button type="button" style={linkBtn} onClick={() => { setChanging(false); setNewDate(''); }}>Cancel</button>
        </div>
      )}

      {(job.status === 'confirmed' || job.status === 'painter_accepted') && (!hideMessageButton || (job.status === 'confirmed' && onMarkCompleted)) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {!hideMessageButton && <MessageButton jobId={job.id} role="painter" status={job.status} unread={unread} autoOpen={autoOpenMessages} onClosed={onMessagesClosed} />}
          {job.status === 'confirmed' && onMarkCompleted && (
            <button
              type="button"
              onClick={() => onMarkCompleted(job.id)}
              disabled={marking}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: marking ? 'not-allowed' : 'pointer' }}
            >
              {marking ? 'Marking…' : 'Mark completed & paid'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
