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

/** Five stars filled to the exact rating, for over a photo (matches the painter's own profile listing hero). */
function StarBar({ value }: { value: number }) {
  return (
    <span aria-label={`${value.toFixed(1)} out of 5 stars`} className="relative inline-block leading-none" style={{ fontSize: 15, letterSpacing: 1 }}>
      <span style={{ color: 'rgba(255,255,255,0.35)' }}>★★★★★</span>
      <span className="absolute left-0 top-0 overflow-hidden whitespace-nowrap" style={{ width: `${Math.max(0, Math.min(5, value)) / 5 * 100}%`, color: '#fbbf24' }}>★★★★★</span>
    </span>
  );
}

/**
 * The listing's cover photo: stretches the full width of the card, cropped short to keep the list slim, with the
 * company name, place and rating laid over it — like the painter's own profile hero. Not swipeable here (that's what
 * "see details" opens into); this is just the one cover shot.
 */
function CoverPhoto({ result }: { result: PainterResult }) {
  const cover = result.photos[0];
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 7', background: '#000' }}>
      {cover ? (
        <img src={cover} alt={`${result.companyName} — cover photo`} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div role="img" aria-label={`${result.companyName} has not added photos yet`} className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-page)', color: 'var(--border-strong)' }}>
          <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true">
            <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-x-0 top-0 px-3 pt-2 pb-6" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0))' }}>
        {result.workedWithBefore && (
          <span style={{ display: 'inline-block', marginBottom: 4, padding: '1px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: 'rgba(116, 185, 255, 0.35)', border: '1px solid rgba(255,255,255,0.6)' }}>
            ★ Worked with before
          </span>
        )}
        <h3 className="text-white drop-shadow" style={{ fontFamily: "'Cabin', sans-serif", fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          {result.companyName}
        </h3>
        <p className="text-white/85" style={{ fontSize: '0.78rem', margin: '1px 0 0' }}>{result.city}, {result.state}</p>
        <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: '0.75rem' }}>
          {result.rating.average != null ? (
            <>
              <StarBar value={result.rating.average} />
              <strong className="text-white">{result.rating.average.toFixed(1)}</strong>
              <span className="text-white/75">({result.rating.count})</span>
            </>
          ) : (
            <span className="text-white/80">New · no reviews yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** The full-size gallery in "see details": one photo at a time, swipe or scroll sideways, with dots showing how far through you are. */
function PhotoGallery({ photos, name }: { photos: { url: string; caption: string }[]; name: string }) {
  const [current, setCurrent] = useState(0);
  if (photos.length === 0) return null;
  const here = photos[Math.min(current, photos.length - 1)];
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ background: '#000' }}>
      <div
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', aspectRatio: '4 / 3' }}
      >
        {photos.map((photo, i) => (
          <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 w-full h-full" style={{ scrollSnapAlign: 'start' }}>
            <img src={photo.url} alt={photo.caption || `${name} — project photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
      {here.caption && <p className="absolute inset-x-3 bottom-6 text-center text-white drop-shadow truncate pointer-events-none" style={{ fontSize: '0.75rem' }}>{here.caption}</p>}
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1 pointer-events-none" aria-label={`Photo ${Math.min(current, photos.length - 1) + 1} of ${photos.length}`}>
          {photos.map((_photo, i) => (
            <span key={i} className="rounded-full transition-all" style={{ width: i === current ? 8 : 6, height: i === current ? 8 : 6, background: i === current ? '#fff' : 'rgba(255,255,255,0.45)' }} />
          ))}
        </div>
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

/** One review on The Painted Painter, as a clickable row: opens the full review in a popup rather than inline. */
function ReviewRow({ r, onOpen }: { r: PainterDetail['reviews'][number]; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="w-full text-left block"
      style={{ padding: '10px 0', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Stars value={r.rating} />
        {r.title && <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{r.title}</strong>}
        {r.photos.length > 0 && <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>📷 {r.photos.length}</span>}
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem', margin: '2px 0 0' }}>{r.reviewer} · {r.date}</p>
    </button>
  );
}

/** One review popup: the full text, with an X to close and go back to the list. */
function ReviewPopup({ r, onClose }: { r: PainterDetail['reviews'][number]; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 20px 16px', maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--bg-page)', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer' }}
        >
          ✕
        </button>
        <div className="flex items-center gap-2 flex-wrap pr-8">
          <Stars value={r.rating} size={16} />
          {r.title && <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{r.title}</strong>}
        </div>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', margin: '4px 0 12px' }}>{r.reviewer} · {r.date}</p>
        {r.body && <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, whiteSpace: 'pre-wrap' }}>{r.body}</p>}
        {r.photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {r.photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Photo ${i + 1} from this review`} loading="lazy" className="rounded-md object-cover" style={{ width: 84, height: 84 }} />
              </a>
            ))}
          </div>
        )}
      </div>
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
  const [openReview, setOpenReview] = useState<PainterDetail['reviews'][number] | null>(null);

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

      {d.photos.length > 0 && (
        <>
          <p style={sectionTitle}>Photos of their work</p>
          <PhotoGallery photos={d.photos} name={d.companyName} />
        </>
      )}

      <p style={sectionTitle}>
        Reviews
        {d.rating.average != null && (
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            {' '}— <Stars value={d.rating.average} /> {d.rating.average.toFixed(1)} from {d.rating.count} review{d.rating.count === 1 ? '' : 's'} on The Painted Painter
          </span>
        )}
      </p>
      {d.reviews.length === 0 && d.external.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: '0.88rem', margin: 0 }}>No reviews yet — reviews appear here after a completed job.</p>
      ) : (
        <>
          {d.reviews.map((r, i) => <ReviewRow key={i} r={r} onOpen={() => setOpenReview(r)} />)}
          {d.external.length > 0 && (
            <>
              <p style={{ color: 'var(--text-faint)', fontSize: '0.72rem', margin: '10px 0 2px' }}>Reported by the painter, from other sites:</p>
              {d.external.map((e) => (
                <a
                  key={e.source}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  onClick={(ev) => ev.stopPropagation()}
                  className="flex items-center justify-between"
                  style={{ padding: '8px 0', borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {SOURCE_LABEL[e.source]}
                    {e.rating != null && <> · <span style={{ color: 'var(--accent)' }}>★</span> {e.rating.toFixed(1)}</>}
                    {e.count != null && <span style={{ color: 'var(--text-faint)' }}> ({e.count.toLocaleString()})</span>}
                  </span>
                  <span style={{ color: 'var(--accent-blue)', fontSize: '0.78rem' }}>Open on {SOURCE_LABEL[e.source]} ↗</span>
                </a>
              ))}
            </>
          )}
        </>
      )}

      <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginTop: 16 }}>
        Phone and email are shared once you and the painter confirm the job by email.
      </p>

      {openReview && <ReviewPopup r={openReview} onClose={() => setOpenReview(null)} />}
    </div>
  );
}

/**
 * One painter in the results, laid out like a hotel listing: the cover photo stretches across the top with the name,
 * place and rating over it, cropped short to keep the list slim; the rest (price, Select, why it's a match) sits
 * underneath. "See details" expands credentials, business facts, a full swipeable photo gallery, and actual reviews.
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
      style={{ background: 'var(--bg-surface)', border: result.workedWithBefore ? '2px solid var(--accent-blue)' : '1px solid var(--border)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}
    >
      <CoverPhoto result={result} />

      <div className="p-3 flex flex-col sm:flex-row gap-3 justify-between cursor-pointer" onClick={toggle}>
        <div className="min-w-0">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 4px' }}>{result.reasons[0]}</p>

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
            <div className="hidden md:flex flex-wrap gap-2 mt-2">
              {result.reasons.slice(1).map((r) => (
                <span key={r} style={{ background: 'var(--bg-page)', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 999 }}>
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 flex-shrink-0">
          <div className="sm:text-right">
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

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '7px 14px', color: 'var(--accent-blue)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}
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
