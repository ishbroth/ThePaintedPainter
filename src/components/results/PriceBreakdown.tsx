import type { CSSProperties } from 'react';
import type { Assumption } from '../../lib/chatEstimator/defaultAssumptions';
import type { PriceEditorView, EditorRow } from '../../lib/priceEditing';

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const signed = (n: number) => `${n < 0 ? '−' : '+'}${currency(Math.abs(n))}`;

interface Props {
  view: PriceEditorView;
  assumptions: Assumption[];
  /** False for old saved prices that can't be recalculated (the chat wording they were built from wasn't kept). */
  canEdit: boolean;
  edited: boolean;
  disabled?: boolean;
  onToggleItem: (key: string) => void;
  onToggleRoom: (key: string) => void;
  onReset: () => void;
}

const toggleStyle = (removed: boolean, disabled: boolean): CSSProperties => ({
  marginLeft: 10,
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: '0.74rem',
  fontWeight: 700,
  border: `1px solid ${removed ? 'var(--accent-blue)' : 'var(--border-strong)'}`,
  background: removed ? 'rgba(116, 185, 255, 0.12)' : 'transparent',
  color: removed ? 'var(--accent-blue)' : 'var(--text-secondary)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  whiteSpace: 'nowrap',
});

/** The "Price Breakdown" panel: main items and rooms can be taken off and added back; surcharges recalculate on their own. */
export default function PriceBreakdown({ view, assumptions, canEdit, edited, disabled, onToggleItem, onToggleRoom, onReset }: Props) {
  const { current, rows, rooms, originalTotal, canRemoveMore } = view;
  const estimate = current.estimate;

  const rowByKey = new Map<string, EditorRow>(rows.map((r) => [r.key, r]));
  const grouped: Record<string, { key?: string; description: string; amount: number; removedRow?: EditorRow }[]> = {};
  for (const li of estimate.lineItems) {
    (grouped[li.category] ??= []).push({ key: li.key, description: li.description, amount: li.amount });
  }
  for (const r of rows) {
    if (r.removed) (grouped[r.category] ??= []).push({ key: r.key, description: r.label, amount: r.amount, removedRow: r });
  }

  const renderToggle = (row: EditorRow | undefined) => {
    if (!canEdit || !row) return null;
    const blocked = !row.removed && !canRemoveMore;
    return (
      <button
        type="button"
        disabled={disabled || blocked}
        title={blocked ? 'At least one item has to stay on the price.' : undefined}
        style={toggleStyle(row.removed, !!disabled || blocked)}
        onClick={() => onToggleItem(row.key)}
      >
        {row.removed ? `Add back ${signed(row.change)}` : `Take off ${signed(row.change)}`}
      </button>
    );
  };

  return (
    <div className="breakdown-panel">
      {canEdit && (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Changed your mind? Take a room or item off to see the new price right away, and add it back any time.
          Surcharges and adjustments are recalculated for you. The amount shown on each button includes the surcharges that applied to that
          item, and it can differ from the item's own line: a smaller job can lose the multi-room rate, need extra masking, or reach the
          minimum service charge.
          {edited && (
            <>
              {' '}
              <button type="button" onClick={onReset} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
                Reset to the original price ({currency(originalTotal)})
              </button>
            </>
          )}
        </div>
      )}

      {canEdit && rooms.length > 0 && (
        <div className="breakdown-section">
          <h3>Rooms in this price</h3>
          {rooms.map((r) => {
            const blocked = !r.removed && rooms.filter((x) => !x.removed).length <= 1;
            return (
              <div key={r.key} className="breakdown-line" style={{ opacity: r.removed ? 0.55 : 1 }}>
                <span className="breakdown-line-desc" style={{ textDecoration: r.removed ? 'line-through' : 'none' }}>{r.label}</span>
                <span className="breakdown-line-amt">
                  <button
                    type="button"
                    disabled={disabled || blocked}
                    style={toggleStyle(r.removed, !!disabled || blocked)}
                    onClick={() => onToggleRoom(r.key)}
                  >
                    {r.removed ? `Add back ${signed(r.change)}` : `Take off ${signed(r.change)}`}
                  </button>
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: '0.76rem', color: 'var(--text-faint)', marginTop: 6 }}>
            Based on a typical layout for your home's size. Taking a room off removes its walls, ceiling, trim, doors and windows.
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="breakdown-section">
          <h3>{category}</h3>
          {items.map((li, i) => {
            const row = li.key ? rowByKey.get(li.key) : undefined;
            const removed = !!li.removedRow;
            return (
              <div key={`${li.key ?? 'x'}-${i}`} className="breakdown-line" style={{ opacity: removed ? 0.55 : 1 }}>
                <span className="breakdown-line-desc" style={{ textDecoration: removed ? 'line-through' : 'none' }}>{li.description}</span>
                <span className="breakdown-line-amt">
                  <span style={{ textDecoration: removed ? 'line-through' : 'none' }}>{currency(li.amount)}</span>
                  {renderToggle(row)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {(estimate.multipliers.length > 0 || estimate.volumeEfficiency) && (
        <div className="breakdown-section">
          <h3>Adjustments</h3>
          {estimate.volumeEfficiency && (
            <div className="breakdown-line">
              <span className="breakdown-line-desc">Multi-room volume rate (already applied to the interior items above)</span>
              <span className="breakdown-line-amt">−{Math.round((1 - estimate.volumeEfficiency) * 100)}%</span>
            </div>
          )}
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
        {edited && (
          <div className="breakdown-line" style={{ color: 'var(--text-secondary)' }}>
            <span>Original price</span>
            <span style={{ textDecoration: 'line-through' }}>{currency(originalTotal)}</span>
          </div>
        )}
        <div className="breakdown-line" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
          <span>Guaranteed price (10% below market)</span>
          <span style={{ color: 'var(--accent-blue)' }}>{currency(estimate.total)}</span>
        </div>
      </div>
    </div>
  );
}
