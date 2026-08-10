import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import type { EstimatorContext, EstimateBreakdown } from '../lib/types';
import type { Assumption } from '../lib/chatEstimator/defaultAssumptions';
import type { MatchedSituation } from '../lib/pricing/situations';
import { matchPainters, type PainterMatch } from '../lib/painterMatcher';
import { hapticMedium } from '../lib/haptics';

const PRICE_HOLD_MINUTES = 45;

interface LocationState {
  estimate: EstimateBreakdown;
  ctx: EstimatorContext;
  assumptions: Assumption[];
  matchedSituations: MatchedSituation[];
  transcript: string;
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
  const state = location.state as LocationState | null;
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Lock the expiry to the mount time so re-renders don't reset the clock.
  const expiresAtRef = useRef<number>(Date.now() + PRICE_HOLD_MINUTES * 60 * 1000);
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

  const matchResult = useMemo(() => {
    if (!state) return null;
    const market = Math.round(state.estimate.total / 0.9);
    return matchPainters(state.ctx, market, state.estimate.total);
  }, [state]);

  if (!state || !matchResult) {
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

      {/* Hotwire-style painter list */}
      <div className="painter-list-header">
        <h2>Painters who can do this job</h2>
        <p>
          {matchResult.top.length > 0 ? (
            <>
              {matchResult.top.length} painter{matchResult.top.length === 1 ? '' : 's'} priced near
              your guaranteed rate. Tap to see their profile, portfolio, and lock in.
            </>
          ) : (
            <>No direct matches in your area yet — the Mystery Painter below can still guarantee this price.</>
          )}
        </p>
      </div>

      {matchResult.top.map((m) => (
        <Link
          to={expired ? '#' : `/painters/${m.painter.id}`}
          key={m.painter.id}
          style={{
            textDecoration: 'none',
            pointerEvents: expired ? 'none' : undefined,
            opacity: expired ? 0.55 : 1,
          }}
          onClick={(e) => {
            if (expired) {
              e.preventDefault();
              return;
            }
            hapticMedium();
          }}
        >
          <PainterCard match={m} guaranteedPrice={estimate.total} />
        </Link>
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
            Accept the guaranteed price and we'll match you with a verified, licensed painter who
            bids on your job. You won't choose the painter in advance — we fan the job out to every
            qualified painter in the area and confirm the first one available. Guaranteed coverage,
            best price.
          </p>
          <p className="mystery-painter-desc" style={{ marginTop: 8, fontSize: '0.8rem', color: '#74b9ff' }}>
            {matchResult.mysteryPool.length} painter{matchResult.mysteryPool.length === 1 ? '' : 's'} in our pool could bid on this job.
          </p>
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
            onClick={() => hapticMedium()}
          >
            {expired ? 'Expired' : 'Book Guaranteed'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PainterCard = ({
  match,
  guaranteedPrice,
}: {
  match: PainterMatch;
  guaranteedPrice: number;
}) => {
  const { painter, painterPrice, reasons, priceDelta } = match;
  const vsGuaranteed =
    painterPrice === guaranteedPrice
      ? 'at guaranteed price'
      : priceDelta > 0
      ? `${Math.round(priceDelta * 100)}% above guaranteed`
      : `${Math.round(-priceDelta * 100)}% below guaranteed`;
  return (
    <div className="painter-card">
      <div>
        <div className="painter-card-name">{painter.company_name}</div>
        <div className="painter-card-meta">
          <span className="painter-card-rating">
            {'★'.repeat(Math.round(painter.rating))} {painter.rating.toFixed(1)} ({painter.review_count})
          </span>
          <span>{painter.city}, {painter.state}</span>
          <span>{painter.years_experience} yrs</span>
          <span>Crew of {painter.crew_size}</span>
        </div>
        <div className="painter-card-tags">
          {reasons.slice(0, 3).map((r, i) => (
            <span key={i} className="painter-card-tag">{r}</span>
          ))}
        </div>
      </div>
      <div>
        <div className="painter-card-price">{currency(painterPrice)}</div>
        <div className="painter-card-cta" style={{ color: priceDelta <= 0 ? '#74b9ff' : '#a9b0b6' }}>
          {vsGuaranteed}
        </div>
        <div className="painter-card-cta">View profile →</div>
      </div>
    </div>
  );
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
