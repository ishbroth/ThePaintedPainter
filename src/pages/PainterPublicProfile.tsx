import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPainterDetail, type PainterDetail } from '../lib/realPainterMatcher';

// ---------------------------------------------------------------------------
// Star display helper
// ---------------------------------------------------------------------------
function Stars({ rating, size = 'text-lg' }: { rating: number; size?: string }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <span className={`${size} text-[var(--accent)] inline-flex items-center`}>
      {'★'.repeat(full)}
      {hasHalf && '½'}
      {'☆'.repeat(empty)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badge helper
// ---------------------------------------------------------------------------
function Badge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
        active
          ? 'bg-green-900/40 text-green-400 border border-green-700'
          : 'bg-gray-800 text-[var(--text-faint)] border border-gray-700'
      }`}
    >
      {active ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lightbox component
// ---------------------------------------------------------------------------
function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-[var(--text-primary)] text-3xl font-bold hover:text-[var(--text-secondary)] z-50"
        aria-label="Close"
      >
        &times;
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-primary)] text-4xl font-bold hover:text-[var(--text-secondary)] z-50"
          aria-label="Previous image"
        >
          &#8249;
        </button>
      )}

      <img
        src={images[index]}
        alt={`Portfolio ${index + 1}`}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-primary)] text-4xl font-bold hover:text-[var(--text-secondary)] z-50"
          aria-label="Next image"
        >
          &#8250;
        </button>
      )}

      <div className="absolute bottom-4 text-[var(--text-secondary)] text-sm">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
//
// One page for every painter on the network (real and demonstration alike), loaded from the same
// painter-detail function the results use. Private details (phone, address, license number) are never shown.
// ---------------------------------------------------------------------------
const PainterPublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  // the answer remembers which painter it is for, so a different link shows "Loading" until its own answer arrives
  const [loaded, setLoaded] = useState<{ id: string; detail: PainterDetail | null } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchPainterDetail(id).then((detail) => {
      if (!cancelled) setLoaded({ id, detail });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = loaded && loaded.id === id ? loaded : null;
  const painter = current?.detail ?? null;

  if (!current) {
    return <div className="min-h-[60vh] flex items-center justify-center text-[var(--text-secondary)]">Loading…</div>;
  }

  // 404 (also what a removed painter's old link shows)
  if (!painter) {
    return (
      <div className="text-[var(--text-primary)] min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Painter Not Found</h1>
        <p className="text-[var(--text-secondary)]">This painter isn't on the network right now.</p>
        <Link to="/painters-map" className="cta-button mt-4">
          Browse Painters Map
        </Link>
      </div>
    );
  }

  const images = painter.photos.map((ph) => ph.url);
  const { license, insurance, bond, workersComp, certifications } = painter.credentials;

  return (
    <div className="text-[var(--text-primary)]">
      <section className="bg-[var(--bg-chrome)] py-16 border-b border-[var(--border)]">
        <div className="container-custom text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{painter.companyName}</h1>
          <p className="text-[var(--text-secondary)] text-lg mb-4">{[painter.city, painter.state].filter(Boolean).join(', ')}</p>

          <div className="flex items-center justify-center gap-3 mb-4">
            {painter.rating.count > 0 && painter.rating.average !== null ? (
              <>
                <Stars rating={painter.rating.average} size="text-2xl" />
                <span className="text-[var(--text-primary)] font-semibold text-lg">{painter.rating.average.toFixed(1)}</span>
                <span className="text-[var(--text-secondary)]">({painter.rating.count} review{painter.rating.count === 1 ? '' : 's'})</span>
              </>
            ) : (
              <span className="text-[var(--text-secondary)]">No reviews yet</span>
            )}
          </div>

          {painter.yearsInBusiness != null && (
            <span className="inline-block bg-[var(--accent)] text-[var(--accent-ink)] font-bold px-4 py-1.5 rounded-full text-sm">
              {painter.yearsInBusiness} Years in Business
            </span>
          )}
        </div>
      </section>

      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Company Info</h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {painter.crewSize != null && (
              <div className="bg-[var(--bg-surface)] rounded-lg p-5 border border-[var(--border)]">
                <p className="text-[var(--text-secondary)] text-sm mb-1">Crew Size</p>
                <p className="text-[var(--text-primary)] font-semibold">{painter.crewSize} members</p>
              </div>
            )}
            {painter.jobsPerMonth != null && (
              <div className="bg-[var(--bg-surface)] rounded-lg p-5 border border-[var(--border)]">
                <p className="text-[var(--text-secondary)] text-sm mb-1">Jobs per month</p>
                <p className="text-[var(--text-primary)] font-semibold">{painter.jobsPerMonth}</p>
              </div>
            )}
            {painter.warranty && (
              <div className="bg-[var(--bg-surface)] rounded-lg p-5 border border-[var(--border)]">
                <p className="text-[var(--text-secondary)] text-sm mb-1">Warranty</p>
                <p className="text-[var(--text-primary)] font-semibold">{painter.warranty}</p>
              </div>
            )}
            {painter.offersEstimates != null && (
              <div className="bg-[var(--bg-surface)] rounded-lg p-5 border border-[var(--border)]">
                <p className="text-[var(--text-secondary)] text-sm mb-1">Free estimates</p>
                <p className="text-[var(--text-primary)] font-semibold">{painter.offersEstimates ? 'Yes' : 'No'}</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Badge label="Licensed" active={license.has} />
            <Badge label="Insured" active={insurance.has} />
            <Badge label="Bonded" active={bond.has} />
            <Badge label="Workers' comp" active={workersComp.has} />
          </div>
          {certifications.length > 0 && (
            <p className="text-center text-[var(--text-secondary)] text-sm mt-4">Certifications: {certifications.join(', ')}</p>
          )}
        </div>
      </section>

      {painter.bio && (
        <section className="py-12 bg-[var(--bg-surface)]">
          <div className="container-custom max-w-3xl">
            <h2 className="text-2xl font-bold mb-6 text-center">About Us</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed text-center">{painter.bio}</p>
          </div>
        </section>
      )}

      {painter.services.length > 0 && (
        <section className="py-12">
          <div className="container-custom max-w-3xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Services Offered</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {painter.services.map((service) => (
                <span
                  key={service}
                  className="bg-[var(--border)] text-[var(--text-primary)] px-4 py-2 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--accent)] transition-colors"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {images.length > 0 && (
        <section className="py-12 bg-[var(--bg-surface)]">
          <div className="container-custom">
            <h2 className="text-2xl font-bold mb-8 text-center">Portfolio</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="overflow-hidden rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <img src={img} alt={painter.photos[i]?.caption || `Portfolio ${i + 1}`} className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300" />
                </button>
              ))}
            </div>
          </div>

          {lightboxIndex !== null && (
            <Lightbox
              images={images}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onPrev={() => setLightboxIndex((prev) => (prev !== null ? (prev - 1 + images.length) % images.length : 0))}
              onNext={() => setLightboxIndex((prev) => (prev !== null ? (prev + 1) % images.length : 0))}
            />
          )}
        </section>
      )}

      <section className="py-12">
        <div className="container-custom max-w-3xl">
          <h2 className="text-2xl font-bold mb-2 text-center">Customer Reviews</h2>
          {painter.reviews.length === 0 ? (
            <p className="text-center text-[var(--text-secondary)] mt-4">No reviews yet.</p>
          ) : (
            <div className="space-y-6 mt-6">
              {painter.reviews.map((review, i) => (
                <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{review.reviewer}</p>
                      <p className="text-[var(--text-faint)] text-sm">{review.date}</p>
                    </div>
                    <Stars rating={review.rating} />
                  </div>
                  {review.title && <p className="font-medium text-[var(--text-primary)] mb-1">{review.title}</p>}
                  {review.body && <p className="text-[var(--text-secondary)] leading-relaxed">{review.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 bg-[var(--bg-chrome)] text-center border-t border-[var(--border)]">
        <div className="container-custom">
          <h2 className="text-2xl font-bold mb-4">Interested in {painter.companyName}?</h2>
          <p className="text-[var(--text-secondary)] mb-8">Get a free price or browse more painters in your area.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className="cta-button">
              Get a Price
            </Link>
            <Link
              to="/painters-map"
              className="inline-block px-6 py-3 border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Back to Painters Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PainterPublicProfile;
