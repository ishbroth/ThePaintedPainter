import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import type { EstimatorContext, EstimateBreakdown } from '../lib/types';
import type { Assumption } from '../lib/chatEstimator/defaultAssumptions';
import type { MatchedSituation } from '../lib/pricing/situations';
import { fetchPainterResults, type PainterResult, type PainterResults } from '../lib/realPainterMatcher';
import { estimateDayRange } from '../lib/duration';
import PainterResultCard from '../components/results/PainterResultCard';
import { buildResponseSummary, timelineLabel } from '../lib/chatEstimator/responseSummary';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { hapticMedium } from '../lib/haptics';
import { QUOTE_RESULT_KEY, QUOTE_EXPIRES_KEY, PRICE_HOLD_MINUTES } from '../lib/chatEstimator/persistence';

interface LocationState {
  estimate: EstimateBreakdown;
  ctx: EstimatorContext;
  assumptions: Assumption[];
  matchedSituations: MatchedSituation[];
  transcript: string;
  expiresAt?: number;
  /** Set when reloaded from a "your painter declined" email: ties claims to that 72-hour window. */
  resumeToken?: string;
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

/** "Nov 3 – Nov 7", "Flexible", "As soon as possible"... for the line under the price. */
function timingSummary(ctx: EstimatorContext): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (ctx.startDate) {
    const span = ctx.endDate && ctx.endDate !== ctx.startDate ? `${fmt(ctx.startDate)} – ${fmt(ctx.endDate)}` : `starting ${fmt(ctx.startDate)}`;
    return ctx.datesFlexible ? `flexible, around ${span}` : span;
  }
  if (ctx.datesFlexible) return 'dates are flexible';
  return timelineLabel(ctx.timeline);
}

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
    ? 'var(--danger)'
    : msLeft < 5 * 60 * 1000
    ? 'var(--accent)'
    : 'var(--accent-blue)';

  const [results, setResults] = useState<PainterResults | null>(null);
  const [resultsFailed, setResultsFailed] = useState(false);
  const painterMatches: PainterResult[] | null = results ? results.painters : resultsFailed ? [] : null;

  const loadResults = useCallback(() => {
    if (!state) return () => {};
    let cancelled = false;
    fetchPainterResults(state.ctx, state.estimate.total, state.resumeToken).then((r) => {
      if (cancelled) return;
      if (!r) return setResultsFailed(true);
      setResults(r);
      // The server decides how long these prices can be claimed; the countdown follows it.
      expiresAtRef.current = r.holdUntil;
      try {
        sessionStorage.setItem(QUOTE_EXPIRES_KEY, String(r.holdUntil));
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => loadResults(), [loadResults]);

  const [claimTarget, setClaimTarget] = useState<
    { selectionType: 'specific_painter'; painter: { id: string; company_name: string }; price: number; priceToken: string } | { selectionType: 'guaranteed' } | null
  >(null);

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const { estimate, ctx, assumptions } = state;
  const duration = results?.duration ?? estimateDayRange(estimate.total);

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
              Get a fresh price →
            </button>
          ) : (
            <>Pick a painter and lock in this price before it expires.</>
          )}
        </div>
      </div>

      {/* Hero / price */}
      <div className="quote-results-hero">
        <h1>Your Estimate</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {describeJob(ctx)}
        </p>
        <div className="quote-results-price">{currency(estimate.total)}</div>
        <div className="quote-results-range">
          Likely range: {currency(estimate.lowRange)} – {currency(estimate.highRange)}
        </div>
        <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Estimated time on site: <strong>about {duration.low === duration.high ? duration.low : `${duration.low}–${duration.high}`} working day{duration.high === 1 ? '' : 's'}</strong>
          {' · '}Your timing: <strong>{timingSummary(ctx)}</strong>
        </div>
      </div>

      {state.resumeToken && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-blue)', borderRadius: 10, padding: '12px 16px', margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Your previous painter couldn't take this job. Pick another painter below before the countdown ends.
        </div>
      )}

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
              <span style={{ color: 'var(--accent-blue)' }}>{currency(estimate.total)}</span>
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
              {painterMatches.length} painter{painterMatches.length === 1 ? '' : 's'} in your area, nearest first. Pick
              one to claim their guaranteed price.
            </>
          ) : (
            <>There are no preferred painters in your area yet — but The Painted Painter will work on finding one for your price.</>
          )}
        </p>
      </div>

      {(painterMatches ?? []).map((m) => (
        <PainterResultCard
          key={m.id}
          result={m}
          disabled={expired}
          onSelect={() => {
            if (expired) return;
            hapticMedium();
            setClaimTarget({ selectionType: 'specific_painter', painter: { id: m.id, company_name: m.companyName }, price: m.price, priceToken: m.priceToken });
          }}
        />
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
            <p className="mystery-painter-desc" style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
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
              background: expired ? 'var(--border-strong)' : 'var(--accent-blue)',
              color: expired ? 'var(--text-faint)' : 'var(--accent-blue-ink)',
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
          guaranteedPrice={claimTarget.selectionType === 'specific_painter' ? claimTarget.price : (results?.mystery.price ?? Math.round(estimate.total))}
          priceToken={claimTarget.selectionType === 'specific_painter' ? claimTarget.priceToken : (results?.mystery.priceToken ?? '')}
          resumeToken={state.resumeToken}
          resumeState={{ ctx, estimate, assumptions }}
          onPriceExpired={() => { setClaimTarget(null); setResults(null); loadResults(); }}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Claim Your Price modal
// ---------------------------------------------------------------------------

type ClaimTarget =
  | { selectionType: 'specific_painter'; painter: { id: string; company_name: string }; price: number; priceToken: string }
  | { selectionType: 'guaranteed' };

const ClaimPriceModal = ({
  target,
  ctx,
  guaranteedPrice,
  priceToken,
  resumeToken,
  resumeState,
  onPriceExpired,
  onClose,
}: {
  target: ClaimTarget;
  ctx: EstimatorContext;
  guaranteedPrice: number;
  priceToken: string;
  resumeToken?: string;
  resumeState: unknown;
  onPriceExpired: () => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState(ctx.contactName || '');
  const [email, setEmail] = useState(ctx.contactEmail || '');
  const [phone, setPhone] = useState(ctx.contactPhone || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state_, setState_] = useState(ctx.state || '');
  const [preferredDate, setPreferredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ notifiedCount: number } | null>(null);
  const { user } = useAuth();

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
          preferredDate: preferredDate || undefined,
          customerId: user?.id,
          photos: ctx.photos.length > 0 ? ctx.photos : undefined,
          priceToken,
          resumeToken,
          resumeState,
          timing: { startDate: ctx.startDate || null, endDate: ctx.endDate || null, flexible: ctx.datesFlexible, timeline: ctx.timeline || null },
        },
      });

      if (invokeError || data?.error) {
        // supabase-js hides the body of non-2xx responses; read it so the customer sees the real reason.
        let body: { error?: string; code?: string } | null = data ?? null;
        const res = (invokeError as { context?: Response } | null)?.context;
        if (!body && res && typeof res.json === 'function') body = await res.json().catch(() => null);
        if (body?.code === 'price_expired') {
          setError('This price has expired, so we\'re refreshing your results.');
          setTimeout(onPriceExpired, 1200);
          return;
        }
        setError(body?.error || invokeError?.message || 'Something went wrong. Please try again.');
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
        style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 28, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <>
            <h2 style={{ marginTop: 0 }}>You're all set!</h2>
            <p>
              We've notified {result.notifiedCount} painter{result.notifiedCount === 1 ? '' : 's'}. As soon as one accepts,
              we'll email you at <strong>{email}</strong> so you can confirm and secure your painter.
            </p>
            <button onClick={onClose} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>
              {target.selectionType === 'specific_painter' ? `Claim your price with ${target.painter.company_name}` : 'Claim your guaranteed price'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Preferred start date (optional — the painter will confirm)
                </label>
                <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {error && <p style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ flex: 1, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
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
  border: '1px solid var(--border-strong)',
  background: 'var(--bg-page)',
  color: 'var(--text-primary)',
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
