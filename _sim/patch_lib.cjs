const fs = require('fs');
let t = fs.readFileSync('src/lib/pricing/referenceLibrary.ts', 'utf8');

t = t.replace("  prep_drywall_patch_large: 'prep.drywall_patch.large',\n} as const;", `  prep_drywall_patch_large: 'prep.drywall_patch.large',

  // Exterior features and small-job items (added when the estimator learned to price a single item on its own)
  exterior_shutter_each: 'exterior.shutter.each',
  exterior_fence_6ft: 'exterior.fence.6ft',
  exterior_fence_4ft: 'exterior.fence.4ft',
  exterior_deck_stain: 'exterior.deck.stain',
  exterior_deck_paint: 'exterior.deck.paint',
  exterior_fascia: 'exterior.fascia.per_linft',
  exterior_gutter: 'exterior.gutter.per_linft',
  exterior_window_trim_each: 'exterior.window_trim.each',
  stairs_railing_simple: 'stairs.railing.simple_per_ft',
  stairs_railing_spindles: 'stairs.railing.spindles_per_ft',
  min_job_charge: 'job.minimum_charge',
} as const;`);

const W = (key, value, unit, src) => `  { key: RATE_KEYS.${key}, entry: { value: ${value}, unit: '${unit}', source: 'web-2026-10 (${src})', marketBasis: true } },`;
const additions = [
  W('interior_walls_repaint_good', 1.5, 'perSqFt', 'walls $1-2 per sq ft of wall'),
  W('interior_ceiling_flat', 2.0, 'perSqFt', 'ceilings $1-3; Homewyse $1.38-2.98'),
  W('trim_baseboard_3in', 3.0, 'perLinFt', 'baseboard/trim $1-5 per linear ft; Homewyse $2.30-4.88'),
  W('door_interior_standard', 125, 'perUnit', 'interior door avg $75-150, national avg about $125'),
  W('cabinet_kitchen_small', 2200, 'perProject', 'small galley kitchen $800-3,000; $50-125 per door'),
  W('cabinet_kitchen_medium', 4500, 'perProject', 'typical kitchen $2,000-7,000'),
  W('cabinet_kitchen_large', 7000, 'perProject', 'large kitchen up to $12,000'),
  W('cabinet_bathroom_vanity', 210, 'perProject', 'vanity $60-120 small, $180-360 for a 72 inch'),
  W('cabinet_bathroom_vanity', 260, 'perProject', 'cabinet painters $25-75/hr, labor 80-85 percent'),
  W('exterior_siding_vinyl', 2.25, 'perSqFt', 'vinyl $1.50-3.00'),
  W('exterior_siding_wood', 3.25, 'perSqFt', 'wood $2.00-4.50'),
  W('exterior_siding_stucco', 3.0, 'perSqFt', 'stucco $2.00-4.00'),
  W('exterior_siding_brick', 3.75, 'perSqFt', 'brick $2.50-5.00'),
  W('prep_popcorn_removal_per_sqft', 2.7, 'perSqFt', 'removal only $1.87-3.52; scrape $1-2'),
  W('prep_wallpaper_removal_per_sqft', 2.8, 'perSqFt', '$1-5 per sq ft; about $800 per room'),
  W('prep_power_wash_per_sqft', 0.3, 'perSqFt', 'house wash $0.15-0.50 per sq ft'),
  W('exterior_shutter_each', 120, 'perUnit', 'shutters $45-85 to $114-235 each'),
  W('exterior_fence_6ft', 7.0, 'perLinFt', 'privacy fence $1.50-3.50 one coat up to $5-14'),
  W('exterior_deck_stain', 3.2, 'perSqFt', 'deck stain $1.50-5.50 incl. cleaning'),
  W('exterior_deck_paint', 4.5, 'perSqFt', 'deck paint $3-6'),
  W('exterior_fascia', 4.5, 'perLinFt', 'fascia/soffit $3-6; Homewyse $4.39-8.42'),
  W('exterior_gutter', 3.5, 'perLinFt', 'gutters $2-5 per linear ft'),
  W('exterior_window_trim_each', 90, 'perUnit', 'window trim $25-150 each'),
  W('door_garage_single', 330, 'perUnit', 'garage door $150-550'),
  W('door_garage_double', 450, 'perUnit', 'garage door $150-550, double at the upper end'),
  W('door_entry_exterior', 200, 'perUnit', 'front door $125-300'),
  W('min_job_charge', 350, 'perProject', 'painter minimum job fee $250-500'),
].join('\n');

t = t.replace("export const USER_ADDITIONS: { key: string; entry: RateEntry }[] = [\n  // (empty — grows over time)\n];", `export const USER_ADDITIONS: { key: string; entry: RateEntry }[] = [
  // Per-item figures from published 2026 contractor cost guides (Angi, HomeGuide, Homewyse, Fixr,
  // estimators.us and local painter price pages), fed in October 2026. Each value is the typical (mid)
  // figure of the range the guides gave; the averaging above blends it with what was already here,
  // so nothing is overwritten.
${additions}
];`);

t = t.replace('function applyUserAdditions(): void {', `function seedExtras(): void {
  const src = 'marketPricingData.ts';
  const e = BASE_RATES.exterior;
  const seed = (key: string, value: number, unit: RateUnit) => push(key, { value, unit, source: src, marketBasis: false });
  seed(RATE_KEYS.exterior_shutter_each, BASE_RATES.specialty.shutter_exterior, 'perUnit');
  seed(RATE_KEYS.exterior_fence_6ft, e.fence_per_linft_6ft, 'perLinFt');
  seed(RATE_KEYS.exterior_fence_4ft, e.fence_per_linft_4ft, 'perLinFt');
  seed(RATE_KEYS.exterior_deck_stain, e.deck_stain_per_sqft, 'perSqFt');
  seed(RATE_KEYS.exterior_deck_paint, e.deck_paint_per_sqft, 'perSqFt');
  seed(RATE_KEYS.exterior_fascia, e.fascia_per_linft, 'perLinFt');
  seed(RATE_KEYS.exterior_gutter, e.gutter_per_linft, 'perLinFt');
  seed(RATE_KEYS.exterior_window_trim_each, e.window_trim_each, 'perUnit');
  seed(RATE_KEYS.stairs_railing_simple, BASE_RATES.stairs.railing_simple_per_ft, 'perLinFt');
  seed(RATE_KEYS.stairs_railing_spindles, BASE_RATES.stairs.railing_spindles_per_ft, 'perLinFt');
  seed(RATE_KEYS.min_job_charge, 300, 'perProject');
}

function applyUserAdditions(): void {`);
t = t.replace('seedFromPricingData();\napplyUserAdditions();', 'seedFromPricingData();\nseedExtras();\napplyUserAdditions();');
fs.writeFileSync('src/lib/pricing/referenceLibrary.ts', t);

let r = fs.readFileSync('src/lib/pricing/resolvedBaseRates.ts', 'utf8');
r = r.replace("  closets: { ...cl },\n  stairs: { ...st },\n  specialty: { ...sp },", "  closets: { ...cl },\n  stairs: {\n    ...st,\n    railing_simple_per_ft: resolve(RATE_KEYS.stairs_railing_simple, st.railing_simple_per_ft),\n    railing_spindles_per_ft: resolve(RATE_KEYS.stairs_railing_spindles, st.railing_spindles_per_ft),\n  },\n  specialty: { ...sp, shutter_exterior: resolve(RATE_KEYS.exterior_shutter_each, sp.shutter_exterior) },");
r = r.replace('    fascia_per_linft: e.fascia_per_linft,', '    fascia_per_linft: resolve(RATE_KEYS.exterior_fascia, e.fascia_per_linft),');
r = r.replace('    gutter_per_linft: e.gutter_per_linft,', '    gutter_per_linft: resolve(RATE_KEYS.exterior_gutter, e.gutter_per_linft),');
r = r.replace('    deck_stain_per_sqft: e.deck_stain_per_sqft,\n    deck_paint_per_sqft: e.deck_paint_per_sqft,\n    fence_per_linft_6ft: e.fence_per_linft_6ft,\n    fence_per_linft_4ft: e.fence_per_linft_4ft,', '    deck_stain_per_sqft: resolve(RATE_KEYS.exterior_deck_stain, e.deck_stain_per_sqft),\n    deck_paint_per_sqft: resolve(RATE_KEYS.exterior_deck_paint, e.deck_paint_per_sqft),\n    fence_per_linft_6ft: resolve(RATE_KEYS.exterior_fence_6ft, e.fence_per_linft_6ft),\n    fence_per_linft_4ft: resolve(RATE_KEYS.exterior_fence_4ft, e.fence_per_linft_4ft),');
r = r.replace('    window_trim_each: e.window_trim_each,', '    window_trim_each: resolve(RATE_KEYS.exterior_window_trim_each, e.window_trim_each),');
r = r.replace('export const RESOLVED_BASE_RATES', '/** Minimum charge for a very small job (national, guaranteed basis); the engine scales it by region. */\nexport const MIN_JOB_CHARGE = resolve(RATE_KEYS.min_job_charge, 300);\n\nexport const RESOLVED_BASE_RATES');
fs.writeFileSync('src/lib/pricing/resolvedBaseRates.ts', r);
console.log('patched');
