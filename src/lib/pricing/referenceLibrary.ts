// ============================================================================
// Unified Pricing Reference Library
// ============================================================================
// Single source of truth that the estimator consults. Each canonical item key
// holds an array of RateEntry records coming from different sources (existing
// files in this repo, plus user-fed additions over time).
//
// Conflict rule (confirmed with user):
//   - Same item, multiple rates  →  arithmetic mean
//   - Different items            →  kept distinct, never merged
//
// All rates are stored at RAW MARKET scale. The "guaranteed price" 10%-below
// discount is applied once, at lookup time, via `getRate(key, 'guaranteed')`.
// Source files that pre-discounted (marketPricingData, pricingConfig) are
// normalized back to market on seed (÷ 0.90) so every entry sits on the same
// basis before averaging.
// ============================================================================

import { BASE_RATES } from '../marketPricingData';
import { PRICING } from '../pricingConfig';
import { LABOR_RATES, PREP_WORK_PRICING } from '../pricingData';

// ===== Types =====

export type RateUnit =
  | 'perSqFt'
  | 'perLinFt'
  | 'perUnit'
  | 'perProject'
  | 'perRoom'
  | 'perPatch'
  | 'perRepair';

export interface RateEntry {
  value: number;
  unit: RateUnit;
  /** Where this rate came from — source file name, user session date, etc. */
  source: string;
  /** Free-form context: conditions, assumptions, caveats. */
  notes?: string;
  /** If true, the stored value is the raw market rate. If false, it has been pre-discounted. */
  marketBasis?: boolean;
}

/** 10% below market — the "guaranteed price" competitive position. */
export const GUARANTEED_PRICE_FACTOR = 0.90;

// ===== Canonical Keys =====
// Dot-separated paths. When feeding new data, use these keys (or extend this
// list). The estimator will only average entries that share a key AND unit.

export const RATE_KEYS = {
  // Interior walls
  interior_walls_repaint_good: 'interior.walls.repaint_good',
  interior_walls_repaint_fair: 'interior.walls.repaint_fair',
  interior_walls_repaint_poor: 'interior.walls.repaint_poor',
  interior_walls_new_drywall: 'interior.walls.new_drywall',
  interior_walls_textured: 'interior.walls.textured',
  interior_walls_accent: 'interior.walls.accent',

  // Ceilings
  interior_ceiling_flat: 'interior.ceiling.flat',
  interior_ceiling_textured: 'interior.ceiling.textured',
  interior_ceiling_vaulted: 'interior.ceiling.vaulted',
  interior_ceiling_popcorn_paint: 'interior.ceiling.popcorn_paint',

  // Trim (linear foot)
  trim_baseboard_3in: 'trim.baseboard.3in',
  trim_baseboard_5in: 'trim.baseboard.5in',
  trim_baseboard_7in: 'trim.baseboard.7in',
  trim_crown_standard: 'trim.crown.standard',
  trim_crown_detailed: 'trim.crown.detailed',
  trim_chair_rail: 'trim.chair_rail',
  trim_wainscoting_per_sqft: 'trim.wainscoting.per_sqft',

  // Doors (each)
  door_interior_standard: 'door.interior.standard',
  door_interior_panel: 'door.interior.panel',
  door_interior_french: 'door.interior.french',
  door_closet_single: 'door.closet.single',
  door_closet_bifold: 'door.closet.bifold',
  door_closet_sliding: 'door.closet.sliding',
  door_pocket: 'door.pocket',
  door_frame: 'door.frame',
  door_entry_exterior: 'door.entry_exterior',
  door_garage_single: 'door.garage.single',
  door_garage_double: 'door.garage.double',

  // Windows (each)
  window_single: 'window.single',
  window_double_hung: 'window.double_hung',
  window_french_pane: 'window.french_pane',
  window_bay: 'window.bay',
  window_exterior_trim: 'window.exterior_trim',

  // Cabinets
  cabinet_kitchen_small: 'cabinet.kitchen.small',
  cabinet_kitchen_medium: 'cabinet.kitchen.medium',
  cabinet_kitchen_large: 'cabinet.kitchen.large',
  cabinet_bathroom_vanity: 'cabinet.bathroom.vanity',
  cabinet_laundry: 'cabinet.laundry',

  // Exterior siding (per sqft)
  exterior_siding_stucco: 'exterior.siding.stucco',
  exterior_siding_wood: 'exterior.siding.wood',
  exterior_siding_hardie: 'exterior.siding.hardie',
  exterior_siding_vinyl: 'exterior.siding.vinyl',
  exterior_siding_brick: 'exterior.siding.brick',
  exterior_siding_stone: 'exterior.siding.stone',
  exterior_siding_aluminum: 'exterior.siding.aluminum',

  // Prep
  prep_wallpaper_removal_per_sqft: 'prep.wallpaper_removal.per_sqft',
  prep_popcorn_removal_per_sqft: 'prep.popcorn_removal.per_sqft',
  prep_caulking_per_linft: 'prep.caulking.per_linft',
  prep_power_wash_per_sqft: 'prep.power_wash.per_sqft',
  prep_sanding_degloss_per_sqft: 'prep.sanding_degloss.per_sqft',
  prep_prime_new_drywall_per_sqft: 'prep.prime.new_drywall_per_sqft',
  prep_prime_stained_wood_per_sqft: 'prep.prime.stained_wood_per_sqft',
  prep_drywall_patch_small: 'prep.drywall_patch.small',
  prep_drywall_patch_medium: 'prep.drywall_patch.medium',
  prep_drywall_patch_large: 'prep.drywall_patch.large',
} as const;

export type RateKey = (typeof RATE_KEYS)[keyof typeof RATE_KEYS];

// ===== Core Store =====

const STORE = new Map<string, RateEntry[]>();

function push(key: string, entry: RateEntry): void {
  const existing = STORE.get(key);
  if (existing) existing.push(entry);
  else STORE.set(key, [entry]);
}

// ===== Public API =====

/**
 * Add a rate entry for a canonical item key. Use this (or append directly to
 * `USER_ADDITIONS` below) when the user feeds a new example.
 */
export function addRate(key: RateKey | string, entry: RateEntry): void {
  push(key, entry);
}

/**
 * Look up the averaged rate for an item key. Averages only entries with the
 * same unit. If multiple units exist for the same key, returns the group
 * matching the `preferUnit` param (or the largest group if unspecified).
 */
export function getRate(
  key: RateKey | string,
  basis: 'market' | 'guaranteed' = 'guaranteed',
  preferUnit?: RateUnit,
): { value: number; unit: RateUnit; sources: string[]; count: number } | null {
  const entries = STORE.get(key);
  if (!entries || entries.length === 0) return null;

  // Normalize each entry to market basis first
  const normalized = entries.map((e) => ({
    ...e,
    marketValue: e.marketBasis === false ? e.value / GUARANTEED_PRICE_FACTOR : e.value,
  }));

  // Group by unit and pick the preferred (or largest) group
  const byUnit = new Map<RateUnit, typeof normalized>();
  for (const n of normalized) {
    const g = byUnit.get(n.unit) ?? [];
    g.push(n);
    byUnit.set(n.unit, g);
  }

  let chosen: { unit: RateUnit; items: typeof normalized } | null = null;
  if (preferUnit && byUnit.has(preferUnit)) {
    chosen = { unit: preferUnit, items: byUnit.get(preferUnit)! };
  } else {
    for (const [unit, items] of byUnit.entries()) {
      if (!chosen || items.length > chosen.items.length) chosen = { unit, items };
    }
  }
  if (!chosen) return null;

  const mean =
    chosen.items.reduce((s, i) => s + i.marketValue, 0) / chosen.items.length;
  const final = basis === 'guaranteed' ? mean * GUARANTEED_PRICE_FACTOR : mean;

  return {
    value: Math.round(final * 100) / 100,
    unit: chosen.unit,
    sources: chosen.items.map((i) => i.source),
    count: chosen.items.length,
  };
}

/** Full list of entries for a key — useful for debugging and UI disclosure. */
export function getRateDetails(key: RateKey | string): RateEntry[] {
  return STORE.get(key)?.slice() ?? [];
}

/** List every key that currently has entries. */
export function allKeys(): string[] {
  return Array.from(STORE.keys()).sort();
}

// ============================================================================
// USER_ADDITIONS
// ============================================================================
// Append new entries here as Isaac feeds examples. Each entry gets seeded into
// the store at module load. Format:
//
//   { key: RATE_KEYS.interior_walls_repaint_good,
//     entry: { value: 1.85, unit: 'perSqFt', source: 'isaac-2026-04-22',
//              notes: 'observed on El Cajon 2br repaint, good condition',
//              marketBasis: true } }
//
// ============================================================================

export const USER_ADDITIONS: { key: string; entry: RateEntry }[] = [
  // (empty — grows over time)
];

// ============================================================================
// Seeding from existing repo data
// ============================================================================

function seedFromMarketPricingData(): void {
  const src = 'marketPricingData.ts';
  // marketPricingData claims "10% below market" — treat as pre-discounted.
  const preDiscounted = false; // ⇒ marketBasis: false

  const i = BASE_RATES.interior;
  push(RATE_KEYS.interior_walls_repaint_good, { value: i.walls_repaint, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.interior_walls_new_drywall, { value: i.walls_new_drywall, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.interior_walls_textured, { value: i.walls_textured, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.interior_ceiling_flat, { value: i.ceilings_flat, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.interior_ceiling_textured, { value: i.ceilings_textured, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.interior_ceiling_vaulted, { value: i.ceilings_vaulted, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.interior_ceiling_popcorn_paint, { value: i.ceilings_popcorn_paint, unit: 'perSqFt', source: src, marketBasis: preDiscounted });

  const t = BASE_RATES.trim;
  push(RATE_KEYS.trim_baseboard_3in, { value: t.baseboard_simple, unit: 'perLinFt', source: src, marketBasis: preDiscounted, notes: '3" flat baseboard' });
  push(RATE_KEYS.trim_baseboard_5in, { value: t.baseboard_detailed, unit: 'perLinFt', source: src, marketBasis: preDiscounted, notes: '5"+ profiled' });
  push(RATE_KEYS.trim_baseboard_7in, { value: t.baseboard_tall, unit: 'perLinFt', source: src, marketBasis: preDiscounted, notes: '7"+ craftsman' });
  push(RATE_KEYS.trim_crown_standard, { value: t.crown_molding, unit: 'perLinFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.trim_crown_detailed, { value: t.crown_detailed, unit: 'perLinFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.trim_chair_rail, { value: t.chair_rail, unit: 'perLinFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.trim_wainscoting_per_sqft, { value: t.wainscoting_per_sqft, unit: 'perSqFt', source: src, marketBasis: preDiscounted });

  const d = BASE_RATES.doors;
  push(RATE_KEYS.door_interior_standard, { value: d.interior_standard, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_interior_panel, { value: d.interior_panel, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_interior_french, { value: d.interior_french, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_closet_single, { value: d.closet_single, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_closet_bifold, { value: d.closet_bifold, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_closet_sliding, { value: d.closet_sliding, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_pocket, { value: d.pocket, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_frame, { value: d.door_frame, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_entry_exterior, { value: d.entry_door, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_garage_single, { value: d.garage_single, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_garage_double, { value: d.garage_double, unit: 'perUnit', source: src, marketBasis: preDiscounted });

  const w = BASE_RATES.windows;
  push(RATE_KEYS.window_single, { value: w.frame_sill_simple, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_double_hung, { value: w.frame_sill_double_hung, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_french_pane, { value: w.french_pane, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_bay, { value: w.bay_window, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_exterior_trim, { value: w.exterior_trim, unit: 'perUnit', source: src, marketBasis: preDiscounted });

  const c = BASE_RATES.cabinets;
  push(RATE_KEYS.cabinet_kitchen_small, { value: c.kitchen_small, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.cabinet_kitchen_medium, { value: c.kitchen_medium, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.cabinet_kitchen_large, { value: c.kitchen_large, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.cabinet_bathroom_vanity, { value: c.bathroom_vanity, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.cabinet_laundry, { value: c.laundry, unit: 'perProject', source: src, marketBasis: preDiscounted });

  const e = BASE_RATES.exterior;
  push(RATE_KEYS.exterior_siding_stucco, { value: e.siding_stucco, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.exterior_siding_wood, { value: e.siding_wood, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.exterior_siding_hardie, { value: e.siding_hardie, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.exterior_siding_vinyl, { value: e.siding_vinyl, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.exterior_siding_brick, { value: e.siding_brick, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.exterior_siding_stone, { value: e.siding_stone, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.exterior_siding_aluminum, { value: e.siding_aluminum, unit: 'perSqFt', source: src, marketBasis: preDiscounted });

  const p = BASE_RATES.prep;
  push(RATE_KEYS.prep_wallpaper_removal_per_sqft, { value: p.wallpaper_removal_per_sqft, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_popcorn_removal_per_sqft, { value: p.popcorn_removal_per_sqft, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_caulking_per_linft, { value: p.caulking_per_linft, unit: 'perLinFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_power_wash_per_sqft, { value: p.power_washing, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_sanding_degloss_per_sqft, { value: p.sanding_degloss_per_sqft, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_prime_new_drywall_per_sqft, { value: p.prime_new_drywall_per_sqft, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_prime_stained_wood_per_sqft, { value: p.prime_stained_wood_per_sqft, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_drywall_patch_small, { value: p.drywall_patch_small, unit: 'perPatch', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_drywall_patch_medium, { value: p.drywall_patch_medium, unit: 'perPatch', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.prep_drywall_patch_large, { value: p.drywall_patch_large, unit: 'perPatch', source: src, marketBasis: preDiscounted });
}

function seedFromPricingConfig(): void {
  const src = 'pricingConfig.ts';
  // pricingConfig header says "10% below current baseline" — treat as pre-discounted.
  const preDiscounted = false; // ⇒ marketBasis: false
  const p = PRICING;

  push(RATE_KEYS.interior_walls_repaint_good, { value: p.perSqFt.interiorBase, unit: 'perSqFt', source: src, marketBasis: preDiscounted, notes: 'flat per-sqft "interiorBase" combines walls+ceiling base' });
  push(RATE_KEYS.exterior_siding_stucco, { value: p.perSqFt.exteriorBase, unit: 'perSqFt', source: src, marketBasis: preDiscounted, notes: 'flat "exteriorBase" — stucco proxy' });
  push(RATE_KEYS.interior_ceiling_flat, { value: p.perSqFt.ceilings, unit: 'perSqFt', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.trim_baseboard_3in, { value: p.perSqFt.baseboards, unit: 'perSqFt', source: src, marketBasis: preDiscounted, notes: 'stored as per-sqft in pricingConfig, unit mismatch vs other sources' });
  push(RATE_KEYS.trim_crown_standard, { value: p.perSqFt.crownMolding, unit: 'perSqFt', source: src, marketBasis: preDiscounted, notes: 'stored as per-sqft, unit mismatch vs other sources' });
  push(RATE_KEYS.trim_wainscoting_per_sqft, { value: p.perSqFt.wainscoting, unit: 'perSqFt', source: src, marketBasis: preDiscounted });

  push(RATE_KEYS.cabinet_kitchen_medium, { value: p.fixed.kitchenCabinets, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.cabinet_bathroom_vanity, { value: p.fixed.bathroomCabinets, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.cabinet_laundry, { value: p.fixed.laundryCabinets, unit: 'perProject', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_garage_single, { value: p.fixed.garageDoorSingle, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_garage_double, { value: p.fixed.garageDoorDouble, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_entry_exterior, { value: p.fixed.entryDoor, unit: 'perUnit', source: src, marketBasis: preDiscounted });

  push(RATE_KEYS.door_interior_standard, { value: p.perUnit.interiorDoor, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_closet_single, { value: p.perUnit.closetDoor, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_interior_french, { value: p.perUnit.frenchDoor, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.door_pocket, { value: p.perUnit.pocketDoor, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_single, { value: p.perUnit.windowSingle, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_double_hung, { value: p.perUnit.windowDoubleHung, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_french_pane, { value: p.perUnit.windowFrenchPane, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_bay, { value: p.perUnit.windowBay, unit: 'perUnit', source: src, marketBasis: preDiscounted });
  push(RATE_KEYS.window_exterior_trim, { value: p.perUnit.exteriorWindowTrim, unit: 'perUnit', source: src, marketBasis: preDiscounted });
}

function seedFromPricingData(): void {
  // pricingData holds low/mid/high raw market rates with cited sources.
  // Seed the "mid" figure as the primary entry; "low" and "high" seed as
  // separate entries so the mean reflects the full band.
  const pushBand = (
    key: string,
    unit: RateUnit,
    band: { low: number; mid: number; high: number },
    label: string,
    notes?: string,
  ) => {
    push(key, { value: band.low, unit, source: `pricingData.ts:${label}:low`, marketBasis: true, notes });
    push(key, { value: band.mid, unit, source: `pricingData.ts:${label}:mid`, marketBasis: true, notes });
    push(key, { value: band.high, unit, source: `pricingData.ts:${label}:high`, marketBasis: true, notes });
  };

  const iw = LABOR_RATES.interiorWalls;
  pushBand(RATE_KEYS.interior_walls_repaint_good, 'perSqFt', iw.repaintGoodCondition, 'interiorWalls.repaintGood');
  pushBand(RATE_KEYS.interior_walls_repaint_fair, 'perSqFt', iw.repaintFairCondition, 'interiorWalls.repaintFair');
  pushBand(RATE_KEYS.interior_walls_repaint_poor, 'perSqFt', iw.repaintPoorCondition, 'interiorWalls.repaintPoor');
  pushBand(RATE_KEYS.interior_walls_new_drywall, 'perSqFt', iw.newDrywall, 'interiorWalls.newDrywall');
  pushBand(RATE_KEYS.interior_walls_accent, 'perSqFt', iw.accentWall, 'interiorWalls.accent');
  pushBand(RATE_KEYS.interior_walls_textured, 'perSqFt', iw.texturedWalls, 'interiorWalls.textured');

  const c = LABOR_RATES.ceilings;
  pushBand(RATE_KEYS.interior_ceiling_flat, 'perSqFt', c.flat, 'ceilings.flat');
  pushBand(RATE_KEYS.interior_ceiling_textured, 'perSqFt', c.textured, 'ceilings.textured');
  pushBand(RATE_KEYS.interior_ceiling_vaulted, 'perSqFt', c.vaulted, 'ceilings.vaulted');

  const t = LABOR_RATES.trim;
  pushBand(RATE_KEYS.trim_baseboard_3in, 'perLinFt', t.baseboard3in, 'trim.baseboard3in');
  pushBand(RATE_KEYS.trim_baseboard_5in, 'perLinFt', t.baseboard5in, 'trim.baseboard5in');
  pushBand(RATE_KEYS.trim_baseboard_7in, 'perLinFt', t.baseboard7in, 'trim.baseboard7in');
  pushBand(RATE_KEYS.trim_crown_standard, 'perLinFt', t.crownMolding, 'trim.crownMolding');
  pushBand(RATE_KEYS.trim_chair_rail, 'perLinFt', t.chairRail, 'trim.chairRail');

  const d = LABOR_RATES.doors;
  pushBand(RATE_KEYS.door_interior_standard, 'perUnit', d.hollowCoreFlush, 'doors.hollowCoreFlush');
  pushBand(RATE_KEYS.door_interior_panel, 'perUnit', d.solidPanel, 'doors.solidPanel');
  pushBand(RATE_KEYS.door_interior_french, 'perUnit', d.frenchDoor, 'doors.frenchDoor');
  pushBand(RATE_KEYS.door_closet_bifold, 'perUnit', d.bifoldDouble, 'doors.bifoldDouble');
  pushBand(RATE_KEYS.door_closet_sliding, 'perUnit', d.slidingCloset, 'doors.slidingCloset');
  pushBand(RATE_KEYS.door_pocket, 'perUnit', d.pocketDoor, 'doors.pocketDoor');
  pushBand(RATE_KEYS.door_entry_exterior, 'perUnit', d.entryDoorExterior, 'doors.entryDoorExterior');
  pushBand(RATE_KEYS.door_frame, 'perUnit', d.doorFrame, 'doors.doorFrame');

  const w = LABOR_RATES.windows;
  pushBand(RATE_KEYS.window_single, 'perUnit', w.singlePane, 'windows.singlePane');
  pushBand(RATE_KEYS.window_double_hung, 'perUnit', w.doubleHung, 'windows.doubleHung');
  pushBand(RATE_KEYS.window_french_pane, 'perUnit', w.frenchPane, 'windows.frenchPane');
  pushBand(RATE_KEYS.window_bay, 'perUnit', w.bayWindow, 'windows.bayWindow');

  const kc = LABOR_RATES.kitchenCabinets;
  pushBand(RATE_KEYS.cabinet_kitchen_small, 'perProject', kc.smallKitchen, 'cabinets.smallKitchen');
  pushBand(RATE_KEYS.cabinet_kitchen_medium, 'perProject', kc.mediumKitchen, 'cabinets.mediumKitchen');
  pushBand(RATE_KEYS.cabinet_kitchen_large, 'perProject', kc.largeKitchen, 'cabinets.largeKitchen');
  pushBand(RATE_KEYS.cabinet_bathroom_vanity, 'perProject', kc.bathroomVanity, 'cabinets.bathroomVanity');
  pushBand(RATE_KEYS.cabinet_laundry, 'perProject', kc.laundryRoom, 'cabinets.laundryRoom');

  const es = LABOR_RATES.exteriorSiding;
  pushBand(RATE_KEYS.exterior_siding_stucco, 'perSqFt', es.stucco, 'exterior.stucco');
  pushBand(RATE_KEYS.exterior_siding_wood, 'perSqFt', es.woodLap, 'exterior.woodLap');
  pushBand(RATE_KEYS.exterior_siding_hardie, 'perSqFt', es.hardieBoard, 'exterior.hardieBoard');
  pushBand(RATE_KEYS.exterior_siding_vinyl, 'perSqFt', es.vinyl, 'exterior.vinyl');
  pushBand(RATE_KEYS.exterior_siding_brick, 'perSqFt', es.brick, 'exterior.brick');
  pushBand(RATE_KEYS.exterior_siding_stone, 'perSqFt', es.stone, 'exterior.stone');
  pushBand(RATE_KEYS.exterior_siding_aluminum, 'perSqFt', es.aluminum, 'exterior.aluminum');

  pushBand(RATE_KEYS.prep_wallpaper_removal_per_sqft, 'perSqFt', PREP_WORK_PRICING.wallpaperRemovalPerSqFt, 'prep.wallpaperRemoval');
  pushBand(RATE_KEYS.prep_popcorn_removal_per_sqft, 'perSqFt', PREP_WORK_PRICING.popcornRemovalPerSqFt, 'prep.popcornRemoval');
  pushBand(RATE_KEYS.prep_caulking_per_linft, 'perLinFt', PREP_WORK_PRICING.caulkingPerLinFt, 'prep.caulking');
  pushBand(RATE_KEYS.prep_power_wash_per_sqft, 'perSqFt', PREP_WORK_PRICING.pressureWashPerSqFt, 'prep.pressureWash');
  pushBand(RATE_KEYS.prep_sanding_degloss_per_sqft, 'perSqFt', PREP_WORK_PRICING.sandingPerSqFt, 'prep.sanding');
  pushBand(RATE_KEYS.prep_prime_new_drywall_per_sqft, 'perSqFt', PREP_WORK_PRICING.primingNewDrywall, 'prep.primingNewDrywall');
  pushBand(RATE_KEYS.prep_prime_stained_wood_per_sqft, 'perSqFt', PREP_WORK_PRICING.primingStainedWood, 'prep.primingStainedWood');
  pushBand(RATE_KEYS.prep_drywall_patch_small, 'perPatch', PREP_WORK_PRICING.drywallRepairMinor, 'prep.drywallRepairMinor');
}

function applyUserAdditions(): void {
  for (const { key, entry } of USER_ADDITIONS) push(key, entry);
}

// Seed at module load
seedFromMarketPricingData();
seedFromPricingConfig();
seedFromPricingData();
applyUserAdditions();
