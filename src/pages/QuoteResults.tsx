import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import type { EstimatorContext, EstimateBreakdown } from '../lib/types';
import type { Assumption } from '../lib/chatEstimator/defaultAssumptions';
import type { MatchedSituation } from '../lib/pricing/situations';
import { fetchNearbyPainters, type RealPainterMatch } from '../lib/realPainterMatcher';
import { buildResponseSummary, timelineLabel } from '../lib/chatEstimator/responseSummary';
import { supabase } from '../lib/supabase';
import { hapticMedium } from '../lib/haptics';
import { QUOTE_RESULT_KEY, QUOTE_EXPIRES_KEY, PRICE_HOLD_MINUTES } from '../lib/chatEstimator/persistence';

interface LocationState {
  estimate: EstimateBreakdown;
  ctx: EstimatorContext;
  assumptions: Assumption[];
  matchedSituations: MatchedSituation[];
  transcript: string;
  expiresAt?: number;
}

/** Falls back to the persisted quote if location.state is missing — e.g. a
 * back/forward navigation or reload dropped the in-memory router state. */
function loadState(locationState: LocationState | null): LocationState | null {
  if (locationState) return locationState;
  try {
    const saved = sessionStorage.getItem(QUOTE_RESULT_KEY);
    if (saved) return JSON.parse(saved) as LocationState;
  } catch {
    // Corrupt/unavailable storage — fall through to null (redirects home).
  }
  return null;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const QuoteResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = loadState(location.state as LocationState | null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Reuse the persisted expiry rather than resetting the clock on every
  // mount — otherwise a back/forward navigation back to this page would
  // quietly grant a fresh 45 minutes instead of counting down the real hold.
  const expiresAtRef = useRef<number>((() => {
    if (state?.expiresAt) return state.expiresAt;
    try {
      const saved = sessionStorage.getItem(QUOTE_EXPIRES_KEY);
      const n = saved ? parseInt(saved, 10) : NaN;
      if (isFinite(n) && n > Date.now()) return n;
    } catch {
      // ignore
    }
    return Date.now() + PRICE_HOLD_MINUTES * 60 * 1000;
  })());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = Math.max(0, expiresAtRef.current - now);
  const expired = msLeft === 0;
  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timerColor = expired
    ? '#e74c3c'
    : msLeft < 5 * 60 * 1000
    ? '#f5a623'
    : '#74b9ff';

  const [painterMatches, setPainterMatches] = useState<RealPainterMatch[] | null>(null);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    fetchNearbyPainters(state.ctx).then((matches) => {
      if (!cancelled) setPainterMatches(matches);
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const [claimTarget, setClaimTarget] = useState<
    { selectionType: 'specific_painter'; painter: RealPainterMatch['painter'] } | { selectionType: 'guaranteed' } | null
  >(null);

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const { estimate, ctx, assumptions } = state;

  // Group line items by category
  const grouped: Record<string, typeof estimate.lineItems> = {};
  for (const li of estimate.lineItems) {
    grouped[li.category] = grouped[li.category] ?? [];
    grouped[li.category].push(li);
  }

  return (
    <div className="quote-results-page">
      {/* Price-hold countdown */}
      <div
        className="price-hold-banner"
        style={{
          borderColor: timerColor,
          background: expired
            ? 'rgba(231, 76, 60, 0.08)'
            : 'rgba(116, 185, 255, 0.06)',
        }}
      >
        <div className="price-hold-label" style={{ color: timerColor }}>
          {expired ? 'Price expired' : 'Price locked for'}
        </div>
        <div className="price-hold-timer" style={{ color: timerColor }}>
          {expired ? '00:00' : `${pad(minutes)}:${pad(seconds)}`}
        </div>
        <div className="price-hold-msg">
          {expired ? (
            <button
              className="price-hold-refresh"
              onClick={() => {
                hapticMedium();
                navigate('/');
              }}
            >
              Get a fresh quote →
            </button>
          ) : (
            <>Pick a painter and lock in this price before it expires.</>
          )}
        </div>
      </div>

      {/* Hero / price */}
      <div className="quote-results-hero">
        <h1>Your Estimate</h1>
        <p style={{ color: '#a9b0b6', fontSize: '0.9rem' }}>
          {describeJob(ctx)}
        </p>
        <div className="quote-results-price">{currency(estimate.total)}</div>
        <div className="quote-results-range">
          Likely range: {currency(estimate.lowRange)} – {currency(estimate.highRange)}
        </div>
        <span className="quote-results-confidence">
          {estimate.confidence} confidence · {estimate.confidenceNote}
        </span>
      </div>

      {/* Collapsed breakdown */}
      <button
        className="breakdown-toggle"
        onClick={() => {
          setBreakdownOpen((v) => !v);
          hapticMedium();
        }}
      >
        <span>Price Breakdown</span>
        <span className={`breakdown-caret ${breakdownOpen ? 'open' : ''}`}>▶</span>
      </button>

      {breakdownOpen && (
        <div className="breakdown-panel">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="breakdown-section">
              <h3>{category}</h3>
              {items.map((li, i) => (
                <div key={i} className="breakdown-line">
                  <span className="breakdown-line-desc">{li.description}</span>
                  <span className="breakdown-line-amt">{currency(li.amount)}</span>
                </div>
              ))}
            </div>
          ))}

          {estimate.multipliers.length > 0 && (
            <div className="breakdown-section">
              <h3>Adjustments</h3>
              {estimate.multipliers.map((m, i) => (
                <div key={i} className="breakdown-line">
                  <span className="breakdown-line-desc">{m.label}</span>
                  <span className="breakdown-line-amt">×{m.factor.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {assumptions.length > 0 && (
            <div className="breakdown-section">
              <h3>What's Automatically Included</h3>
              {assumptions.map((a, i) => (
                <div key={i} className="breakdown-assumption">
                  <span className="breakdown-assumption-label">✓ {a.label}</span>
                  {a.reason}
                </div>
              ))}
            </div>
          )}

          <div className="breakdown-section">
            <h3>Total</h3>
            <div className="breakdown-line" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
              <span>Guaranteed price (10% below market)</span>
              <span style={{ color: '#74b9ff' }}>{currency(estimate.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Real painter list */}
      <div className="painter-list-header">
        <h2>Painters who can do this job</h2>
        <p>
          {painterMatches === null ? (
            <>Finding painters near you…</>
          ) : painterMatches.length > 0 ? (
            <>
              {painterMatches.length} painter{painterMatches.length === 1 ? '' : 's'} in your area. Pick one to
              claim your price at {currency(estimate.total)}.
            </>
          ) : (
            <>There are no preferred painters in your area yet — but The Painted Painter will work on finding one for your price.</>
          )}
        </p>
      </div>

      {(painterMatches ?? []).map((m) => (
        <div
          key={m.painter.id}
          style={{
            cursor: expired ? 'not-allowed' : 'pointer',
            opacity: expired ? 0.55 : 1,
          }}
          onClick={() => {
            if (expired) return;
            hapticMedium();
            setClaimTarget({ selectionType: 'specific_painter', painter: m.painter });
          }}
        >
          <PainterCard match={m} />
        </div>
      ))}

      {/* Mystery painter */}
      <div
        className="mystery-painter-card"
        style={{ opacity: expired ? 0.55 : 1 }}
      >
        <div>
          <div className="mystery-painter-title">
            Mystery Painter
            <span className="mystery-badge">Guaranteed Price</span>
          </div>
          <p className="mystery-painter-desc">
            {(painterMatches?.length ?? 0) > 0 ? (
              <>
                Accept the guaranteed price and we'll match you with a verified, licensed painter who
                bids on your job. You won't choose the painter in advance — we fan the job out to every
                qualified painter in the area and confirm the first one available. Guaranteed coverage,
                best price.
              </>
            ) : (
              <>
                Accept the guaranteed price and we'll actively recruit a verified, licensed painter in
                your area to take the job at this rate — we don't have one in our roster there yet,
                but we guarantee the price regardless.
              </>
            )}
          </p>
          {(painterMatches?.length ?? 0) > 0 && (
            <p className="mystery-painter-desc" style={{ marginTop: 8, fontSize: '0.8rem', color: '#74b9ff' }}>
              {painterMatches!.length} painter{painterMatches!.length === 1 ? '' : 's'} in our pool could bid on this job.
            </p>
          )}
        </div>
        <div className="mystery-painter-price">
          <div className="mystery-painter-price-main">{currency(estimate.total)}</div>
          <div className="mystery-painter-price-save">
            Save vs. listed painters
          </div>
          <button
            style={{
              marginTop: 10,
              padding: '10px 18px',
              background: expired ? '#3a4046' : '#74b9ff',
              color: expired ? '#6e7479' : '#0b1620',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontFamily: 'Cabin, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontSize: '0.8rem',
              cursor: expired ? 'not-allowed' : 'pointer',
            }}
            disabled={expired}
            onClick={() => {
              hapticMedium();
              setClaimTarget({ selectionType: 'guaranteed' });
            }}
          >
            {expired ? 'Expired' : 'Book Guaranteed'}
          </button>
        </div>
      </div>

      {claimTarget && (
        <ClaimPriceModal
          target={claimTarget}
          ctx={ctx}
          guaranteedPrice={estimate.total}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </div>
  );
};

const PainterCard = ({ match }: { match: RealPainterMatch }) => {
  const { painter, reasons } = match;
  return (
    <div className="painter-card">
      <div>
        <div className="painter-card-name">{painter.company_name}</div>
        <div className="painter-card-meta">
          <span>{painter.city}, {painter.state}</span>
          <span>{painter.years_in_business ?? '?'} yrs</span>
          <span>Crew of {painter.crew_size ?? '?'}</span>
        </div>
        <div className="painter-card-tags">
          {reasons.slice(0, 3).map((r, i) => (
            <span key={i} className="painter-card-tag">{r}</span>
          ))}
        </div>
      </div>
      <div>
        <div className="painter-card-cta">Claim your price →</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Claim Your Price modal
// ---------------------------------------------------------------------------

type ClaimTarget =
  | { selectionType: 'specific_painter'; painter: RealPainterMatch['painter'] }
  | { selectionType: 'guaranteed' };

const ClaimPriceModal = ({
  target,
  ctx,
  guaranteedPrice,
  onClose,
}: {
  target: ClaimTarget;
  ctx: EstimatorContext;
  guaranteedPrice: number;
  onClose: () => void;
}) => {
  const [name, setName] = useState(ctx.contactName || '');
  const [email, setEmail] = useState(ctx.contactEmail || '');
  const [phone, setPhone] = useState(ctx.contactPhone || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state_, setState_] = useState(ctx.state || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ notifiedCount: number } | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !streetAddress.trim() || !city.trim() || !state_.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('submit-quote-claim', {
        body: {
          selectionType: target.selectionType,
          selectedPainterId: target.selectionType === 'specific_painter' ? target.painter.id : undefined,
          guaranteedPrice,
          quoteZip: ctx.zipCode,
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim(), streetAddress: streetAddress.trim(), city: city.trim(), state: state_.trim() },
          timeline: ctx.timeline,
          timelineLabel: timelineLabel(ctx.timeline),
          qa: buildResponseSummary(ctx),
        },
      });

      if (invokeError || data?.error) {
        setError(data?.error || invokeError?.message || 'Something went wrong. Please try again.');
        return;
      }

      setResult({ notifiedCount: data.notifiedCount });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1f2937', borderRadius: 14, padding: 28, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <>
            <h2 style={{ marginTop: 0 }}>You're all set!</h2>
            <p>
              We've notified {result.notifiedCount} painter{result.notifiedCount === 1 ? '' : 's'}. As soon as one accepts,
              we'll email you at <strong>{email}</strong> so you can confirm and secure your painter.
            </p>
            <button onClick={onClose} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#74b9ff', color: '#0b1620', fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>
              {target.selectionType === 'specific_painter' ? `Claim your price with ${target.painter.company_name}` : 'Claim your guaranteed price'}
            </h2>
            <p style={{ color: '#a9b0b6', fontSize: '0.9rem' }}>
              We'll keep your contact info private until a painter accepts the job.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              <input placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              <input placeholder="Street address" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
                <input placeholder="State" value={state_} onChange={(e) => setState_(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>

            {error && <p style={{ color: '#e74c3c', marginTop: 10 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #3a4046', background: 'transparent', color: '#a9b0b6', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ flex: 1, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#74b9ff', color: '#0b1620', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Submitting…' : 'Claim This Price'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const inputStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #3a4046',
  background: '#111827',
  color: '#fff',
  fontSize: '0.9rem',
};

function describeJob(ctx: EstimatorContext): string {
  const pieces: string[] = [];
  if (ctx.projectType === 'both') pieces.push('Interior + Exterior');
  else if (ctx.projectType) pieces.push(ctx.projectType.charAt(0).toUpperCase() + ctx.projectType.slice(1));
  if (ctx.squareFeet) pieces.push(`${ctx.squareFeet.toLocaleString()} sqft`);
  else if (ctx.selectedRooms.length > 0) pieces.push(`${ctx.selectedRooms.length} rooms`);
  if (ctx.projectCondition === 'new_construction') pieces.push('new construction');
  else if (ctx.projectCondition === 'renovation') pieces.push('renovation');
  if (ctx.zipCode) pieces.push(`ZIP ${ctx.zipCode}`);
  return pieces.join(' · ');
}

export default QuoteResults;
