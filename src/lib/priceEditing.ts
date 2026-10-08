// ============================================================================
// Price editing
// ============================================================================
// After the chat the customer can take a room or a main item (kitchen cabinets, the ceilings, a bedroom...) off the
// price, put it back, or change one detail of it (the siding type, how many doors, ...) and see the new price straight
// away without redoing the conversation.
//
// Nothing here guesses at a discount: every change reruns the same pricing the chat used. So everything that depends on
// the item follows it: removing the house siding also removes the multi-story access, color change and power washing
// that went with it; surcharges and adjustments are recalculated; the multi-room volume rate shrinks when less is being
// painted; a job reduced to a few surfaces picks up masking; and a very small job hits the minimum service charge.
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

export interface FieldDef {
  field: keyof EstimatorContext;
  label: string;
  kind: 'select' | 'number';
  options?: { value: string; label: string }[];
  /** select values that are numbers in the context (stories) */
  numeric?: boolean;
  min?: number;
  max?: number;
}

const COLOR = [{ value: 'same', label: 'Same color' }, { value: 'different', label: 'New color' }, { value: 'dramatic', label: 'Dark to light (or the reverse)' }];

/** Details the customer can change on each main item. */
export function fieldsForKey(key: string): FieldDef[] {
  if (key.startsWith('cabinets:')) {
    return [
      { field: 'cabinetDoorCount', label: 'Doors and drawer fronts', kind: 'number', min: 2, max: 150 },
      { field: 'cabinetScope', label: 'Painted', kind: 'select', options: [{ value: 'fronts_only', label: 'Outside only' }, { value: 'inside_too', label: 'Inside and out' }] },
    ];
  }
  switch (key) {
    case 'walls': return [{ field: 'interiorColorChange', label: 'Color', kind: 'select', options: COLOR }];
    case 'ceilings': return [{ field: 'ceilingType', label: 'Ceiling type', kind: 'select', options: [{ value: 'flat', label: 'Flat' }, { value: 'popcorn', label: 'Popcorn / textured' }, { value: 'vaulted', label: 'Vaulted' }] }];
    case 'trim': return [{ field: 'trimLinearFeet', label: 'Linear feet of trim', kind: 'number', min: 10, max: 20000 }];
    case 'doors': return [{ field: 'doorCount', label: 'Number of doors', kind: 'number', min: 1, max: 60 }];
    case 'windows': return [{ field: 'windowCount', label: 'Number of windows', kind: 'number', min: 1, max: 80 }];
    case 'closets': return [{ field: 'closetCount', label: 'Number of closets', kind: 'number', min: 1, max: 30 }];
    case 'stairs': return [{ field: 'stairRailFeet', label: 'Feet of railing', kind: 'number', min: 4, max: 500 }];
    case 'ext_body':
      return [
        { field: 'sidingType', label: 'Siding', kind: 'select', options: [
          { value: 'stucco', label: 'Stucco' }, { value: 'wood', label: 'Wood' }, { value: 'vinyl', label: 'Vinyl' }, { value: 'hardie', label: 'Fiber cement (Hardie)' },
          { value: 'brick', label: 'Brick' }, { value: 'stone', label: 'Stone' }, { value: 'aluminum', label: 'Aluminum' }, { value: 'mixed', label: 'A mix' },
        ] },
        { field: 'stories', label: 'Stories', kind: 'select', numeric: true, options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }] },
        { field: 'exteriorColorChange', label: 'Color', kind: 'select', options: [{ value: 'same', label: 'Same color' }, { value: 'different', label: 'New color' }] },
      ];
    case 'ext_shutters': return [{ field: 'exteriorShutterCount', label: 'Number of shutters', kind: 'number', min: 1, max: 60 }];
    case 'ext_windows': return [{ field: 'exteriorWindowCount', label: 'Windows with trim', kind: 'number', min: 1, max: 80 }];
    case 'deck': return [{ field: 'deckSqft', label: 'Deck size (sq ft)', kind: 'number', min: 20, max: 5000 }];
    case 'fence': return [{ field: 'fenceLinearFeet', label: 'Feet of fence', kind: 'number', min: 10, max: 3000 }];
    case 'railings': return [{ field: 'stairRailFeet', label: 'Feet of railing', kind: 'number', min: 4, max: 500 }];
    case 'balconies': return [{ field: 'balconyCount', label: 'Number of balconies', kind: 'number', min: 1, max: 20 }];
    case 'popcorn_removal': return [{ field: 'popcornCeilingSqft', label: 'Ceiling area (sq ft)', kind: 'number', min: 50, max: 30000 }];
    case 'wallpaper_removal': return [{ field: 'wallpaperRooms', label: 'Rooms with wallpaper', kind: 'number', min: 1, max: 30 }];
    case 'power_washing': return [{ field: 'pressureWashSqft', label: 'Area to wash (sq ft)', kind: 'number', min: 50, max: 50000 }];
    default: return [];
  }
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
  /** Other lines that go away (or come back) with this one, e.g. power washing with the siding. */
  alsoAffects: string[];
  fields: FieldDef[];
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

const lineId = (l: { key?: string; description: string }) => l.key ?? `~${l.description.replace(/\(.*\)/, '').trim()}`;

export function buildPriceEditor(
  baseIn: PriceBase,
  excludedRooms: string[],
  excludedItems: string[],
  fields: Partial<EstimatorContext> = {},
): PriceEditorView {
  const base: PriceBase = { ...baseIn, ctx: { ...baseIn.ctx, ...fields } };
  const current = repriceWithEdits(base, excludedRooms, excludedItems);
  const originalTotal = repriceWithEdits(baseIn, [], []).estimate.total;
  const total = current.estimate.total;
  const currentIds = new Set(current.estimate.lineItems.map(lineId));

  // Rows come from the price with only the room edits applied, so an item the customer took off still shows
  // (with the amount it would add back).
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
    const after = repriceWithEdits(base, excludedRooms, toggled);
    // lines that appear or disappear along with this item (not counting the item itself)
    const afterIds = new Set(after.estimate.lineItems.map(lineId));
    const alsoAffects = removed
      ? after.estimate.lineItems.filter((l) => !currentIds.has(lineId(l)) && lineId(l) !== key).map((l) => l.description)
      : current.estimate.lineItems.filter((l) => !afterIds.has(lineId(l)) && lineId(l) !== key).map((l) => l.description);
    rows.push({
      key,
      label: line.description,
      category: line.category,
      amount: Math.round(line.amount),
      removed,
      change: after.estimate.total - total,
      alsoAffects: alsoAffects.filter((d) => !/Minimum service charge|Masking/.test(d)),
      fields: fieldsForKey(key),
    });
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
