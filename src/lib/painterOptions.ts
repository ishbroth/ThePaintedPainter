// Shared option lists for painter forms (kept identical to the sign-up form).

export const SERVICE_TYPE_OPTIONS = [
  'Interior Residential',
  'Exterior Residential',
  'Interior Commercial',
  'Exterior Commercial',
  'Cabinet Refinishing',
  'Deck/Fence Staining',
  'Pressure Washing',
  'Drywall Repair',
  'Wallpaper Removal',
  'Color Consulting',
];

export const PROJECT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small (1-2 rooms)' },
  { value: 'medium', label: 'Medium (whole house interior)' },
  { value: 'large', label: 'Large (full interior + exterior)' },
  { value: 'commercial', label: 'Commercial' },
];

/** The pricing scenarios painters answer at sign-up; they drive where a painter lands in the price spread. */
export const PRICING_SCENARIOS: { column: string; label: string; description: string }[] = [
  { column: 'price_1br_full', label: '1BR Rental - Full Interior + Cabinets', description: 'An empty 1-bedroom rental property — ceilings, walls, trim, doors, and kitchen cabinets.' },
  { column: 'price_3br_walls', label: '3BR Home - Walls Only', description: 'A standard 3-bedroom home — walls only, no trim, doors, or ceilings.' },
  { column: 'price_3br_trim_doors', label: '3BR Home - Trim & Doors Only', description: 'The same standard 3-bedroom home — all trim and doors only, no walls or ceilings.' },
  { column: 'price_3br_ceilings', label: '3BR Home - Ceilings Only', description: 'The same standard 3-bedroom home — all ceilings only, no walls, trim, or doors.' },
  { column: 'price_5br_full', label: '5BR Large Home - Full Interior', description: 'A large 5-bedroom, 3,500 sq ft home — walls, ceilings, trim, and doors.' },
  { column: 'price_5br_cabinets', label: '5BR Large Home - Kitchen Cabinets Only', description: 'The kitchen cabinets in that same large 5-bedroom, 3,500 sq ft home.' },
];
