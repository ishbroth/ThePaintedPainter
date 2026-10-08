import { useState, type CSSProperties } from 'react';
import type { Assumption } from '../../lib/chatEstimator/defaultAssumptions';
import type { EstimatorContext } from '../../lib/types';
import type { PriceEditorView, EditorRow, FieldDef } from '../../lib/priceEditing';

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
  onSetField: (field: keyof EstimatorContext, value: string | number | null) => void;
  onReset: () => void;
}

const linkStyle = (disabled: boolean): CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: 0,
  marginLeft: 12,
  fontSize: '0.78rem',
  color: disabled ? 'var(--text-faint)' : 'var(--accent-blue)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  textDecoration: 'underline',
  whiteSpace: 'nowrap',
});

const inputStyle: CSSProperties = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--bg-page)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

/** The "Price Breakdown" panel: main items and rooms have small "edit" and "remove" links; surcharges recalculate on their own. */
export default function PriceBreakdown({ view, assumptions, canEdit, edited, disabled, onToggleItem, onToggleRoom, onSetField, onReset }: Props) {
  const { current, rows, rooms, originalTotal, canRemoveMore } = view;
  const estimate = current.estimate;
  const [openEdit, setOpenEdit] = useState<string | null>(null);

  const rowByKey = new Map<string, EditorRow>(rows.map((r) => [r.key, r]));
  const grouped: Record<string, { key?: string; description: string; amount: number; removedRow?: EditorRow }[]> = {};
  for (const li of estimate.lineItems) {
    (grouped[li.category] ??= []).push({ key: li.key, description: li.description, amount: li.amount });
  }
  for (const r of rows) {
    if (r.removed) (grouped[r.category] ??= []).push({ key: r.key, description: r.label, amount: r.amount, removedRow: r });
  }

  const fieldValue = (f: FieldDef): string => {
    const v = current.ctx[f.field] as unknown;
    return v === null || v === undefined ? '' : String(v);
  };

  const renderField = (f: FieldDef) => (
    <label key={String(f.field)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
      <span style={{ minWidth: 130 }}>{f.label}</span>
      {f.kind === 'select' ? (
        <select
          value={fieldValue(f)}
          disabled={disabled}
          style={inputStyle}
          onChange={(e) => onSetField(f.field, f.numeric ? Number(e.target.value) : e.target.value)}
        >
          {fieldValue(f) === '' && <option value="">—</option>}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          min={f.min}
          max={f.max}
          disabled={disabled}
          value={fieldValue(f)}
          style={{ ...inputStyle, width: 90 }}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onSetField(f.field, null);
            const n = Number(raw);
            if (Number.isFinite(n)) onSetField(f.field, Math.min(f.max ?? n, Math.max(f.min ?? n, Math.round(n))));
          }}
        />
      )}
    </label>
  );

  const renderLinks = (row: EditorRow | undefined) => {
    if (!canEdit || !row) return null;
    const blocked = !row.removed && !canRemoveMore;
    return (
      <>
        {!row.removed && row.fields.length > 0 && (
          <button type="button" disabled={disabled} style={linkStyle(!!disabled)} onClick={() => setOpenEdit(openEdit === row.key ? null : row.key)}>
            {openEdit === row.key ? 'done' : 'edit'}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || blocked}
          title={blocked ? 'At least one item has to stay on the price.' : `${row.removed ? 'Adds' : 'Saves'} ${currency(Math.abs(row.change))} on the total`}
          style={linkStyle(!!disabled || blocked)}
          onClick={() => {
            setOpenEdit(null);
            onToggleItem(row.key);
          }}
        >
          {row.removed ? `add back (${signed(row.change)})` : `remove (${signed(row.change)})`}
        </button>
      </>
    );
  };

  return (
    <div className="breakdown-panel">
      {canEdit && (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Changed your mind? Use <strong>edit</strong> or <strong>remove</strong> next to any main item and the price updates right away.
          Anything that only exists because of that item goes with it (taking off the siding also takes off its power washing, and so on),
          and surcharges and adjustments are recalculated. The amount in each link includes the surcharges that applied to that item, so
          it can differ from the item's own line: a smaller job can lose the multi-room rate, need extra masking, or reach the minimum
          service charge.
          {edited && (
            <>
              {' '}
              <button type="button" onClick={onReset} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>
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
                  <button type="button" disabled={disabled || blocked} style={linkStyle(!!disabled || blocked)} onClick={() => onToggleRoom(r.key)}>
                    {r.removed ? `add back (${signed(r.change)})` : `remove (${signed(r.change)})`}
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
              <div key={`${li.key ?? 'x'}-${i}`}>
                <div className="breakdown-line" style={{ opacity: removed ? 0.55 : 1 }}>
                  <span className="breakdown-line-desc" style={{ textDecoration: removed ? 'line-through' : 'none' }}>{li.description}</span>
                  <span className="breakdown-line-amt">
                    <span style={{ textDecoration: removed ? 'line-through' : 'none' }}>{currency(li.amount)}</span>
                    {renderLinks(row)}
                  </span>
                </div>
                {canEdit && row && row.alsoAffects.length > 0 && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)', margin: '-2px 0 6px 2px' }}>
                    {row.removed ? 'Adds back with it' : 'Also removes'}: {row.alsoAffects.join(', ')}
                  </div>
                )}
                {canEdit && row && openEdit === row.key && !row.removed && (
                  <div style={{ display: 'grid', gap: 8, padding: '8px 10px', margin: '2px 0 8px', background: 'var(--bg-page)', borderRadius: 8 }}>
                    {row.fields.map(renderField)}
                  </div>
                )}
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
