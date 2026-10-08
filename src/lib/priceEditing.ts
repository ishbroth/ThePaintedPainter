// ============================================================================
// Price editing
// ============================================================================
// After the chat the customer can take a room or a main item (kitchen cabinets, the ceilings, a bedroom...)
// off the price, and put it back, and see the new price straight away without redoing the conversation.
//
// Nothing here guesses at a discount: every change reruns the same pricing the chat used, with the item or
// room left out. So everything that depends on it follows: surcharges and adjustments are recalculated, the
// multi-room volume rate shrinks when less is being painted, a job reduced to a few surfaces picks up
// masking, and a very small job hits the minimum service charge. Taking something off therefore usually saves
// a little less than that item cost when it was priced as part of the whole job.
// ============================================================================

import type { EstimatorContext, EstimateBreakdown } from './types';
import { repriceWithEdits, type ChatResult } from './chatEstimator/chatEngine';
import { getEditableRooms } from './estimateEngine';

export interface PriceBase {
  /** The context the price was built from (any earlier exclusions are cleared; they're tracked separately). */
  ctx: EstimatorContext;
  transcript: string;
  loyaltyDiscountPercent?: number;
}

export interface EditorRow {
  key: string;
  label: string;
  category: string;
  /** What this item cost in the price as it currently stands (or would cost if added back). */
  amount: number;
  removed: boolean;
  /** Exact change in the total if the customer toggles this row: negative to take it off, positive to put it back. */
  change: number;
}

export interface EditorRoom {
  key: string;
  label: string;
  removed: boolean;
  change: number;
}

export interface PriceEditorView {
  current: ChatResult;
  /** The price before any edits. */
  originalTotal: number;
  rows: EditorRow[];
  rooms: EditorRoom[];
  /** True when at least one main item is left, so taking another off is allowed. */
  canRemoveMore: boolean;
}

export function baseFromResult(result: { ctx: EstimatorContext; transcript?: string; loyaltyDiscountPercent?: number }, transcriptFallback = ''): PriceBase {
  return {
    ctx: { ...result.ctx, excludedRooms: [], excludedItems: [] },
    transcript: result.transcript ?? transcriptFallback,
    loyaltyDiscountPercent: result.loyaltyDiscountPercent ?? 0,
  };
}

export function buildPriceEditor(base: PriceBase, excludedRooms: string[], excludedItems: string[]): PriceEditorView {
  const current = repriceWithEdits(base, excludedRooms, excludedItems);
  const originalTotal = repriceWithEdits(base, [], []).estimate.total;
  const total = current.estimate.total;

  // Rows come from the price with only the room edits applied, so an item the customer took off still shows
  // (struck through, with the amount it would add back).
  const withRooms = repriceWithEdits(base, excludedRooms, []);
  const keyed = withRooms.estimate.lineItems.filter((l) => l.key);
  const seen = new Set<string>();
  const rows: EditorRow[] = [];
  for (const line of keyed) {
    const key = line.key as string;
    if (seen.has(key)) continue;
    seen.add(key);
    const removed = excludedItems.includes(key);
    const toggled = removed ? excludedItems.filter((k) => k !== key) : [...excludedItems, key];
    const after = repriceWithEdits(base, excludedRooms, toggled).estimate.total;
    rows.push({ key, label: line.description, category: line.category, amount: Math.round(line.amount), removed, change: after - total });
  }

  const rooms: EditorRoom[] = getEditableRooms(base.ctx).map((r) => {
    const removed = excludedRooms.includes(r.key);
    const toggled = removed ? excludedRooms.filter((k) => k !== r.key) : [...excludedRooms, r.key];
    const after = repriceWithEdits(base, toggled, excludedItems).estimate.total;
    return { key: r.key, label: r.label, removed, change: after - total };
  });

  const remainingItems = rows.filter((r) => !r.removed).length;
  const remainingRooms = rooms.filter((r) => !r.removed).length;
  return { current, originalTotal, rows, rooms, canRemoveMore: remainingItems > 1 && (rooms.length === 0 || remainingRooms > 0) };
}

export type { EstimateBreakdown };
