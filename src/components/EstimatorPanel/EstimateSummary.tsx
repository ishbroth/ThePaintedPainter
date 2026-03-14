import { useState } from 'react';
import type { EstimateBreakdown } from '../../lib/types';
import { formatCurrency } from '../../lib/estimateEngine';
import ConfidenceIndicator from './ConfidenceIndicator';

interface EstimateSummaryProps {
  estimate: EstimateBreakdown;
  onRestart: () => void;
  isSaving: boolean;
  saveError: string | null;
}

const EstimateSummary = ({ estimate, onRestart, isSaving, saveError }: EstimateSummaryProps) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Group line items by category
  const grouped = estimate.lineItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, typeof estimate.lineItems>
  );

  return (
    <div className="estimator-summary">
      <div className="estimator-summary-header">
        <div className="estimator-check-icon">&#10003;</div>
        <h3>Your Painting Estimate</h3>
      </div>

      <div className="estimator-estimate-display">
        <div className="estimator-estimate-total">
          <span className="estimator-estimate-label">Estimated Total</span>
          <span className="estimator-estimate-amount">{formatCurrency(estimate.total)}</span>
          <span className="estimator-estimate-range">
            Range: {formatCurrency(estimate.lowRange)} - {formatCurrency(estimate.highRange)}
          </span>
        </div>

        <ConfidenceIndicator level={estimate.confidence} />
        <p className="estimator-confidence-note">{estimate.confidenceNote}</p>

        <button
          className="estimator-breakdown-toggle"
          onClick={() => setShowBreakdown(!showBreakdown)}
          type="button"
        >
          {showBreakdown ? 'Hide' : 'Show'} Breakdown {showBreakdown ? '\u25B2' : '\u25BC'}
        </button>

        {showBreakdown && (
          <div className="estimator-breakdown">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="estimator-breakdown-group">
                <h4 className="estimator-breakdown-category">{category}</h4>
                {items.map((item, i) => (
                  <div key={i} className="estimator-breakdown-item">
                    <span>{item.description}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            ))}

            <div className="estimator-breakdown-subtotal">
              <span>Subtotal</span>
              <span>{formatCurrency(estimate.subtotal)}</span>
            </div>

            {estimate.multipliers.length > 0 && (
              <div className="estimator-breakdown-multipliers">
                <h4 className="estimator-breakdown-category">Adjustments</h4>
                {estimate.multipliers.map((m, i) => (
                  <div key={i} className="estimator-breakdown-item">
                    <span>{m.label}</span>
                    <span>{((m.factor - 1) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="estimator-result-note">
        This is a ballpark estimate based on the information provided. A free on-site visit will
        provide an exact quote. Prices may vary based on paint selection, surface condition, and
        other factors discovered during inspection.
      </p>

      {isSaving && <p className="estimator-saving">Saving your estimate...</p>}
      {saveError && <p className="estimator-save-error">{saveError}</p>}

      <div className="estimator-result-actions">
        <a href="tel:6197242702" className="estimator-call-btn">
          Call (619) 724-2702
        </a>
        <button className="estimator-restart-btn" onClick={onRestart} type="button">
          Start Over
        </button>
      </div>
    </div>
  );
};

export default EstimateSummary;
