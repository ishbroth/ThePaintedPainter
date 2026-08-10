// ============================================================================
// Resolved Base Rates
// ============================================================================
// Same shape as marketPricingData's BASE_RATES, but each numeric field resolves
// through the unified reference library first (averaging across all seeded
// sources), falling back to the original hard-coded value when a canonical
// key hasn't been registered.
//
// estimateEngine.ts imports this instead of BASE_RATES, so every line item
// automatically benefits from averaged multi-source rates and any user-fed
// additions in USER_ADDITIONS.
// ============================================================================

import { BASE_RATES } from '../marketPricingData';
import { getRate, RATE_KEYS } from './referenceLibrary';

function resolve(key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  const r = getRate(key, 'guaranteed');
  return r ? r.value : fallback;
}

const i = BASE_RATES.interior;
const t = BASE_RATES.trim;
const d = BASE_RATES.doors;
const w = BASE_RATES.windows;
const c = BASE_RATES.cabinets;
const cl = BASE_RATES.closets;
const st = BASE_RATES.stairs;
const sp = BASE_RATES.specialty;
const e = BASE_RATES.exterior;
const p = BASE_RATES.prep;
const m = BASE_RATES.materials;

export const RESOLVED_BASE_RATES: typeof BASE_RATES = {
  interior: {
    walls_repaint: resolve(RATE_KEYS.interior_walls_repaint_good, i.walls_repaint),
    walls_new_drywall: resolve(RATE_KEYS.interior_walls_new_drywall, i.walls_new_drywall),
    walls_textured: resolve(RATE_KEYS.interior_walls_textured, i.walls_textured),
    ceilings_flat: resolve(RATE_KEYS.interior_ceiling_flat, i.ceilings_flat),
    ceilings_textured: resolve(RATE_KEYS.interior_ceiling_textured, i.ceilings_textured),
    ceilings_vaulted: resolve(RATE_KEYS.interior_ceiling_vaulted, i.ceilings_vaulted),
    ceilings_popcorn_paint: resolve(RATE_KEYS.interior_ceiling_popcorn_paint, i.ceilings_popcorn_paint),
  },
  trim: {
    baseboard_simple: resolve(RATE_KEYS.trim_baseboard_3in, t.baseboard_simple),
    baseboard_detailed: resolve(RATE_KEYS.trim_baseboard_5in, t.baseboard_detailed),
    baseboard_tall: resolve(RATE_KEYS.trim_baseboard_7in, t.baseboard_tall),
    crown_molding: resolve(RATE_KEYS.trim_crown_standard, t.crown_molding),
    crown_detailed: resolve(RATE_KEYS.trim_crown_detailed, t.crown_detailed),
    chair_rail: resolve(RATE_KEYS.trim_chair_rail, t.chair_rail),
    wainscoting_per_sqft: resolve(RATE_KEYS.trim_wainscoting_per_sqft, t.wainscoting_per_sqft),
    casing_per_linft: t.casing_per_linft,
  },
  doors: {
    interior_standard: resolve(RATE_KEYS.door_interior_standard, d.interior_standard),
    interior_panel: resolve(RATE_KEYS.door_interior_panel, d.interior_panel),
    interior_french: resolve(RATE_KEYS.door_interior_french, d.interior_french),
    closet_single: resolve(RATE_KEYS.door_closet_single, d.closet_single),
    closet_bifold: resolve(RATE_KEYS.door_closet_bifold, d.closet_bifold),
    closet_sliding: resolve(RATE_KEYS.door_closet_sliding, d.closet_sliding),
    pocket: resolve(RATE_KEYS.door_pocket, d.pocket),
    door_frame: resolve(RATE_KEYS.door_frame, d.door_frame),
    entry_door: resolve(RATE_KEYS.door_entry_exterior, d.entry_door),
    garage_single: resolve(RATE_KEYS.door_garage_single, d.garage_single),
    garage_double: resolve(RATE_KEYS.door_garage_double, d.garage_double),
  },
  windows: {
    frame_sill_simple: resolve(RATE_KEYS.window_single, w.frame_sill_simple),
    frame_sill_double_hung: resolve(RATE_KEYS.window_double_hung, w.frame_sill_double_hung),
    french_pane: resolve(RATE_KEYS.window_french_pane, w.french_pane),
    bay_window: resolve(RATE_KEYS.window_bay, w.bay_window),
    exterior_trim: resolve(RATE_KEYS.window_exterior_trim, w.exterior_trim),
  },
  cabinets: {
    kitchen_small: resolve(RATE_KEYS.cabinet_kitchen_small, c.kitchen_small),
    kitchen_medium: resolve(RATE_KEYS.cabinet_kitchen_medium, c.kitchen_medium),
    kitchen_large: resolve(RATE_KEYS.cabinet_kitchen_large, c.kitchen_large),
    bathroom_vanity: resolve(RATE_KEYS.cabinet_bathroom_vanity, c.bathroom_vanity),
    laundry: resolve(RATE_KEYS.cabinet_laundry, c.laundry),
    per_sqft: c.per_sqft,
  },
  closets: { ...cl },
  stairs: { ...st },
  specialty: { ...sp },
  exterior: {
    siding_stucco: resolve(RATE_KEYS.exterior_siding_stucco, e.siding_stucco),
    siding_wood: resolve(RATE_KEYS.exterior_siding_wood, e.siding_wood),
    siding_hardie: resolve(RATE_KEYS.exterior_siding_hardie, e.siding_hardie),
    siding_vinyl: resolve(RATE_KEYS.exterior_siding_vinyl, e.siding_vinyl),
    siding_brick: resolve(RATE_KEYS.exterior_siding_brick, e.siding_brick),
    siding_stone: resolve(RATE_KEYS.exterior_siding_stone, e.siding_stone),
    siding_aluminum: resolve(RATE_KEYS.exterior_siding_aluminum, e.siding_aluminum),
    fascia_per_linft: e.fascia_per_linft,
    soffit_per_sqft: e.soffit_per_sqft,
    gutter_per_linft: e.gutter_per_linft,
    corner_board_per_linft: e.corner_board_per_linft,
    railing_simple_per_linft: e.railing_simple_per_linft,
    railing_spindle_per_linft: e.railing_spindle_per_linft,
    railing_cable_per_linft: e.railing_cable_per_linft,
    deck_stain_per_sqft: e.deck_stain_per_sqft,
    deck_paint_per_sqft: e.deck_paint_per_sqft,
    fence_per_linft_6ft: e.fence_per_linft_6ft,
    fence_per_linft_4ft: e.fence_per_linft_4ft,
    fence_per_linft_chain: e.fence_per_linft_chain,
    foundation_per_linft: e.foundation_per_linft,
    window_trim_each: e.window_trim_each,
    overhang_per_sqft: e.overhang_per_sqft,
  },
  prep: {
    prime_new_drywall_per_sqft: resolve(RATE_KEYS.prep_prime_new_drywall_per_sqft, p.prime_new_drywall_per_sqft),
    prime_stained_wood_per_sqft: resolve(RATE_KEYS.prep_prime_stained_wood_per_sqft, p.prime_stained_wood_per_sqft),
    prime_bare_wood_per_sqft: p.prime_bare_wood_per_sqft,
    wallpaper_removal_per_sqft: resolve(RATE_KEYS.prep_wallpaper_removal_per_sqft, p.wallpaper_removal_per_sqft),
    popcorn_removal_per_sqft: resolve(RATE_KEYS.prep_popcorn_removal_per_sqft, p.popcorn_removal_per_sqft),
    texture_repair_per_sqft: p.texture_repair_per_sqft,
    drywall_patch_small: resolve(RATE_KEYS.prep_drywall_patch_small, p.drywall_patch_small),
    drywall_patch_medium: resolve(RATE_KEYS.prep_drywall_patch_medium, p.drywall_patch_medium),
    drywall_patch_large: resolve(RATE_KEYS.prep_drywall_patch_large, p.drywall_patch_large),
    caulking_per_linft: resolve(RATE_KEYS.prep_caulking_per_linft, p.caulking_per_linft),
    wood_rot_repair_minor: p.wood_rot_repair_minor,
    wood_rot_repair_moderate: p.wood_rot_repair_moderate,
    wood_rot_repair_major: p.wood_rot_repair_major,
    power_washing: resolve(RATE_KEYS.prep_power_wash_per_sqft, p.power_washing),
    power_washing_minimum: p.power_washing_minimum,
    sanding_degloss_per_sqft: resolve(RATE_KEYS.prep_sanding_degloss_per_sqft, p.sanding_degloss_per_sqft),
    lead_paint_test: p.lead_paint_test,
    lead_encapsulation_per_sqft: p.lead_encapsulation_per_sqft,
    mold_treatment_per_sqft: p.mold_treatment_per_sqft,
  },
  materials: { ...m },
};
