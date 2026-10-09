import { useState } from 'react';
import { fetchPainterDetail, type ExternalReview, type PainterDetail, type PainterResult } from '../../lib/realPainterMatcher';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const SOURCE_LABEL: Record<ExternalReview['source'], string> = { google: 'Google', yelp: 'Yelp', facebook: 'Facebook' };
const SIZE_LABEL: Record<string, string> = {
  small: 'Small (1-2 rooms)',
  medium: 'Medium (whole house interior)',
  large: 'Large (full interior + exterior)',
  commercial: 'Commercial',
};

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} out of 5 stars`} style={{ color: 'var(--accent)', fontSize: size, letterSpacing: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (i < Math.round(value) ? '★' : '☆')).join('')}
    </span>
  );
}

/** Portfolio photos like the room photos on a hotel listing: swipe/arrow through, with a counter. */
function PhotoCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [i, setI] = useState(0);

  if (photos.length === 0) {
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return (
      <div
        style={{ background: 'var(--bg-page)', color: 'var(--text-faint)' }}
        className="w-full h-full min-h-[11rem] flex flex-col items-center justify-center gap-1"
      >
        <span style={{ fontSize: '2rem', fontWeight: 700, opacity: 0.6 }}>{initials}</span>
        <span style={{ fontSize: '0.75rem' }}>No photos yet</span>
      </div>
    );
  }

  const go = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setI((cur) => (cur + delta + photos.length) % photos.length);
  };
  const arrow: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: '32px',
  };

  return (
    <div className="relative w-full h-full min-h-[11rem]" style={{ background: '#000' }}>
      <img src={photos[i]} alt={`${name} — project photo ${i + 1}`} className="w-full h-full object-cover absolute inset-0" loading="lazy" />
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => go(-1, e)} style={{ ...arrow, left: 8 }}>‹</button>
          <button type="button" aria-label="Next photo" onClick={(e) => go(1, e)} style={{ ...arrow, right: 8 }}>›</button>
          <span
            style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}
          >
            {i + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  );
}

function ExternalChips({ items }: { items: ExternalReview[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((e) => (
        <a
          key={e.source}
          href={e.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(ev) => ev.stopPropagation()}
          title={`Reported by the painter — open ${SOURCE_LABEL[e.source]} to check`}
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.78rem', borderRadius: 999, padding: '2px 10px', textDecoration: 'none' }}
        >
          {SOURCE_LABEL[e.source]}
          {e.rating != null && (
            <>
              {' '}
              <span style={{ color: 'var(--accent)' }}>★</span> {e.rating.toFixed(1)}
            </>
          )}
          {e.count != null && <span style={{ color: 'var(--text-faint)' }}> ({e.count.toLocaleString()})</span>}
        </a>
      ))}
    </div>
  );
}

function ReviewItem({ r }: { r: PainterDetail['reviews'][number] }) {
  const [open, setOpen] = useState(false);
  const body = r.body ?? '';
  const long = body.length > 180;
  return (
    <div className="py-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Stars value={r.rating} />
        {r.title && <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{r.title}</strong>}
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem', margin: '2px 0 6px' }}>
        {r.reviewer} · {r.date}
      </p>
      {body && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, whiteSpace: 'pre-wrap' }}>
          {open || !long ? body : `${body.slice(0, 180).trimEnd()}…`}
          {long && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              style={{ marginLeft: 6, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {open ? 'Show less' : 'Read full review'}
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm" style={{ borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-faint)', width: '9rem', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{children}</span>
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return on ? <span style={{ color: 'var(--success)' }}>✓ </span> : <span style={{ color: 'var(--text-faint)' }}>— </span>;
}

function Details({ d }: { d: PainterDetail }) {
  const c = d.credentials;
  const detailBits = (...bits: (string | null | undefined)[]) => bits.filter(Boolean).join(' · ');
  const sectionTitle: React.CSSProperties = { color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', margin: '18px 0 6px' };

  return (
    <div>
      {d.bio && <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: '0 0 4px' }}>{d.bio}</p>}

      <p style={sectionTitle}>Licensing &amp; coverage</p>
      <Row label="Licensed"><Check on={c.license.has} />{c.license.has ? detailBits(c.license.state && `State of ${c.license.state}`, c.license.expires && `valid through ${c.license.expires}`) || 'Yes' : 'Not reported'}</Row>
      <Row label="Insured"><Check on={c.insurance.has} />{c.insurance.has ? detailBits(c.insurance.company, c.insurance.coverage && `${c.insurance.coverage} coverage`) || 'Yes' : 'Not reported'}</Row>
      <Row label="Bonded"><Check on={c.bond.has} />{c.bond.has ? detailBits(c.bond.company, c.bond.amount) || 'Yes' : 'Not reported'}</Row>
      <Row label="Workers' comp"><Check on={c.workersComp.has} />{c.workersComp.has ? c.workersComp.carrier || 'Yes' : 'Not reported'}</Row>
      {c.certifications.length > 0 && <Row label="Certifications">{c.certifications.join(', ')}</Row>}

      <p style={sectionTitle}>The business</p>
      {d.crewSize != null && <Row label="Crew size">{d.crewSize}</Row>}
      {d.yearsInBusiness != null && <Row label="Years in business">{d.yearsInBusiness}</Row>}
      {d.jobsPerMonth != null && <Row label="Jobs per month">About {d.jobsPerMonth}</Row>}
      {d.maxProjectSize && <Row label="Largest project">{SIZE_LABEL[d.maxProjectSize] ?? d.maxProjectSize}</Row>}
      {d.services.length > 0 && <Row label="Services">{d.services.join(', ')}</Row>}
      {d.warranty && <Row label="Warranty">{d.warranty}</Row>}
      {d.offersEstimates && <Row label="Estimates">Free estimates</Row>}

      {d.photos.length > 1 && (
        <>
          <p style={sectionTitle}>Photos of their work</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {d.photos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={p.caption}>
                <img src={p.url} alt={p.caption || 'Project photo'} loading="lazy" className="w-full h-20 object-cover rounded-md" />
              </a>
            ))}
          </div>
        </>
      )}

      <p style={sectionTitle}>
        Reviews on The Painted Painter
        {d.rating.average != null && (
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            {' '}— <Stars value={d.rating.average} /> {d.rating.average.toFixed(1)} from {d.rating.count} review{d.rating.count === 1 ? '' : 's'}
          </span>
        )}
      </p>
      {d.reviews.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: '0.88rem', margin: 0 }}>No reviews yet — reviews appear here after a completed job.</p>
      ) : (
        d.reviews.map((r, i) => <ReviewItem key={i} r={r} />)
      )}

      <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginTop: 16 }}>
        Phone and email are shared once you and the painter confirm the job by email.
      </p>
    </div>
  );
}

/**
 * One painter in the results, laid out like a hotel on a booking site: photos on the
 * left, basics in the middle (name, city, ratings), price and select on the right.
 * "See details" expands credentials, business facts and actual review text.
 */
export default function PainterResultCard({
  result,
  disabled,
  onSelect,
}: {
  result: PainterResult;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PainterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading) {
      setLoading(true);
      setFailed(false);
      const d = await fetchPainterDetail(result.id);
      if (d) setDetail(d);
      else setFailed(true);
      setLoading(false);
    }
  };

  return (
    <div
      style={{ background: 'var(--bg-surface)', border: result.workedWithBefore ? '2px solid var(--accent-blue)' : '1px solid var(--border)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}
    >
      <div className="flex flex-col md:flex-row">
        <div className="md:w-72 md:flex-shrink-0 h-48 md:h-auto relative">
          <PhotoCarousel photos={result.photos} name={result.companyName} />
        </div>

        <div className="flex-1 p-4 flex flex-col md:flex-row gap-4 justify-between cursor-pointer" onClick={toggle}>
          <div className="min-w-0">
            {result.workedWithBefore && (
              <span style={{ display: 'inline-block', marginBottom: 6, padding: '2px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(116, 185, 255, 0.14)', border: '1px solid var(--accent-blue)' }}>
                ★ You've worked with them before
              </span>
            )}
            <h3 style={{ fontFamily: "'Cabin', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>
              {result.companyName}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 8px' }}>
              {result.city}, {result.state} · {result.reasons[0]}
            </p>

            {result.rating.average != null ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <Stars value={result.rating.average} size={16} /> <strong>{result.rating.average.toFixed(1)}</strong>{' '}
                <span style={{ color: 'var(--text-faint)' }}>
                  ({result.rating.count} review{result.rating.count === 1 ? '' : 's'} on The Painted Painter)
                </span>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-faint)' }}>New on The Painted Painter · no reviews yet</p>
            )}

            <ExternalChips items={result.external} />
            {result.external.length > 0 && (
              <p style={{ color: 'var(--text-faint)', fontSize: '0.7rem', margin: '4px 0 0' }}>Other-site ratings are reported by the painter.</p>
            )}

            {result.availableFrom && (
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--accent)' }}>
                Booked until {new Date(`${result.availableFrom}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · available from then
              </p>
            )}

            {result.reasons.slice(1).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {result.reasons.slice(1).map((r) => (
                  <span key={r} style={{ background: 'var(--bg-page)', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 999 }}>
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 flex-shrink-0">
            <div className="md:text-right">
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent-blue)', lineHeight: 1.1 }}>{money(result.price)}</div>
              <div style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>guaranteed price</div>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              style={{
                background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
              }}
            >
              Select
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '10px 16px', color: 'var(--accent-blue)', fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left' }}
      >
        {open ? 'Hide details ▴' : 'See details — licensing, crew, reviews ▾'}
      </button>

      {open && (
        <div style={{ padding: '4px 16px 16px' }}>
          {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading details…</p>}
          {failed && <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>We couldn't load the details. Please try again.</p>}
          {detail && <Details d={detail} />}
        </div>
      )}
    </div>
  );
}
