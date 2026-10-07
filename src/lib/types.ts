// ===== Response Style Detection =====

export type UserResponseStyle = 'terse' | 'normal' | 'detailed';

// ===== Estimator Context (accumulated answers) =====

export interface EstimatorContext {
  // Start
  zipCode: string;
  state: string;
  yearBuilt: number | null;
  propertyType: string; // '' (unasked), residential, condo, multi_unit, commercial, rental
  projectType: string; // interior, exterior, both

  // Interior
  interiorScope: string; // whole_house, specific_rooms
  selectedRooms: string[];
  // interiorWalls/Ceilings/Trim/Doors all default to "yes"-ish (the full
  // package), so their bare values can't distinguish "customer explicitly
  // confirmed everything" from "scope was never discussed at all" — same
  // problem conditionAddressed solves for the condition topic. Without
  // this, a narrative answer like "ceilings painted, walls painted, trim
  // and doors painted" (which doesn't use "just"/"only"/"everything"
  // phrasing) left the surfaces topic looking unanswered even though the
  // customer had already said exactly what they wanted.
  surfacesAddressed: boolean;
  interiorWalls: string; // yes, no
  accentWalls: string; // yes, no, skip
  interiorCeilings: string; // yes, no
  ceilingType: string; // flat, popcorn, vaulted, skip
  interiorTrim: string; // yes, no
  // "Trim" alone is ambiguous — it prices baseboards only (see
  // surfaceAreaEngine's trimLinearFt), but customers often mean door
  // frames/casings, window trim, closet shelving, or built-ins too, each
  // of which is a separate line item. Same problem as conditionAddressed:
  // tracks whether that scope was actually clarified, since "no" on
  // doorFrames/etc. is indistinguishable from "never asked".
  trimScopeAddressed: boolean;
  crownMolding: string; // yes, no, skip
  wainscoting: string; // yes, no, skip
  baseboards: string; // yes, no
  interiorDoors: string; // none, some, all
  doorCount: number | null;
  doorTypes: string[]; // standard, french, closet, pocket
  doorFrames: string; // yes, no
  interiorWindows: string; // none, some, all
  windowCount: number | null;
  windowTypes: string[]; // single, double_hung, french_pane, bay
  cabinets: string; // none, kitchen, bathroom, laundry, multiple
  cabinetLocations: string[];
  closets: string; // none, standard, walkin, both
  closetCount: number | null;
  stairways: string; // none, yes
  stairwayCount: number | null;
  stairwayDetails: string; // walls_only, walls_and_railings, full
  interiorShutters: string; // yes, no, skip
  interiorColorChange: string; // same, different, dramatic
  // Refines the default "different color = whole space, one new color"
  // assumption once a customer volunteers more detail. Deliberately not a
  // standing question — see topics.ts `color_scope_clarify` for why.
  colorChangeScope: string; // '' (default/unspecified), whole_house, most_of_house, some_rooms, accent_only, multiple_colors
  colorChangeExcludedRoomCount: number | null; // rooms explicitly staying the original color when scope is most_of_house/some_rooms
  colorCount: number | null; // total distinct colors, for a multiple_colors scope
  colorClarificationNeeded: string; // '' (none pending), color_count, color_locations
  // Customer wants the work spaced out on separate dates (e.g. bedrooms now,
  // exterior later; or a property manager staggering several units). Still
  // priced as one combined total — this only flags that they should be
  // offered the option to split their claim into separately-scheduled
  // phases (see QuoteResults' claim flow), not a mandatory question.
  multiPhaseRequested: string; // '' (no signal), yes

  // Exterior
  exteriorScope: string; // full, partial
  sidingType: string; // stucco, wood, vinyl, hardie, brick, stone, mixed
  exteriorTrim: string; // yes, no
  soffitsEaves: string; // yes, no, skip
  exteriorShutters: string; // yes, no
  exteriorShutterCount: number | null;
  garageDoor: string; // none, single, double
  entryDoor: string; // yes, no
  railings: string; // none, yes
  railingType: string; // simple, spindles, both
  balconies: string; // none, yes
  balconyCount: number | null;
  deck: string; // none, yes
  deckSize: string; // small, medium, large
  fence: string; // none, yes
  fenceLinearFeet: number | null;
  fenceType: string; // picket_4ft, privacy_6ft, chain_link
  gutters: string; // yes, no, skip
  foundation: string; // yes, no, skip
  exteriorWindows: string; // none, trim_only, full
  exteriorWindowCount: number | null;
  overhangs: string; // yes, no, skip
  accessRestrictions: string; // none, some, significant
  exteriorColorChange: string; // same, different
  exteriorCondition: string; // good, fair, poor

  // Prep Work
  prepWork: string[]; // caulking, stain_cover, drywall_repair, wood_rot, wallpaper_removal, power_washing, lead_test, mold_treatment
  caulkingExtent: string; // minor, moderate, extensive
  drywallRepairExtent: string; // minor, moderate, major
  // drywallRepairExtent defaults to 'minor' (not empty), so it can't by
  // itself distinguish "customer said it's minor" from "never discussed" —
  // this tracks whether condition/prep was actually addressed at all, so
  // the "condition" topic doesn't loop forever re-asking something the
  // customer already answered with e.g. "no damage, just nail holes".
  conditionAddressed: boolean;
  // Same problem as conditionAddressed: nothing ever wrote a structured
  // field for "how far along are the other trades" answers, so the
  // reno_context topic's old check (additionalDetails containing the
  // literal word "drywall"/"contractor") almost never matched a realistic
  // answer like "everything installed, just needs paint" and looped.
  renoStageAddressed: boolean;
  woodRotExtent: string; // minor, moderate, major
  wallpaperRooms: number | null;
  popcornCeilingRooms: number | null;

  // Scheduling / access / add-on services
  multiTripRequired: string; // '', yes, no — sequenced work (paint-before-install, cure-time delays) needing a return visit
  specialEquipment: string; // none, extended_ladder, scaffolding, lift
  fixtureRemoval: string; // none, minor, extensive — removing/reinstalling hardware, rods, covers, fixtures around paint work
  hardwareReplacement: string; // yes, no — installing NEW hardware (hinges, knobs, pulls), not just reinstalling existing
  lowVocRequested: string; // yes, no — low-odor/eco-friendly paint requested

  // Property
  squareFeet: number | null;
  stories: number | null;
  ceilingHeight: string; // standard, nine_foot, ten_plus, vaulted_mixed
  occupancy: string; // vacant, furnished, occupied
  utilities: string; // yes, no
  hoa: string; // yes, no, skip
  timeline: string; // '' (unasked), asap, this_month, no_rush
  /** Specific dates the customer gave, YYYY-MM-DD ('' if none). Used to match painters' availability. */
  startDate: string;
  endDate: string;
  /** "My dates are flexible": painters who are booked until later still show, tagged with when they're free. */
  datesFlexible: boolean;
  afterHoursRequired: string; // '' (unasked), yes, no — commercial jobs needing night/weekend scheduling to avoid disrupting business

  // Contact
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactNotes: string;

  // Smart Qualifiers
  projectCondition: string; // repaint, new_construction, renovation
  hasStainedWood: string; // yes, no
  bedroomCount: number | null;

  // Surface Detail
  trimCondition: string; // new, existing_good, existing_fair
  wallTexture: string; // smooth, textured, heavy_texture
  doorMaterial: string; // wood, metal, fiberglass, vinyl, mixed
  cabinetScope: string; // fronts_only, inside_too
  closetShelving: string; // none, wire, built_in, extensive
  stuccoCondition: string; // good, new_stucco, needs_repair
  exteriorRailingMaterial: string; // wood, metal, cable, composite
  interiorRailingMaterial: string; // wood, metal, wrought_iron
  additionalDetails: string;

  // Specialty Services
  specialtyServices: string[]; // fireplace, beams, built_ins, epoxy, furniture, brick
  fireplaceType: string; // brick_paint, brick_whitewash, stone, mantel_only, full
  fireplaceCount: number | null;
  beamLinearFeet: number | null;
  beamLocation: string; // standard, vaulted
  builtInCount: number | null;
  epoxyGarageSqft: number | null;
  epoxyType: string; // basic, full_system
  furnitureItems: string[];
  brickSqft: number | null;
  brickTreatment: string; // paint, whitewash

  // Tracking
  answeredQuestions: number;
  responseStyle: UserResponseStyle;
  responseLengths: number[]; // track length of text answers
  specialtyReferrals: SpecialtyReferral[];
  isHighCostArea: boolean;
  stateComplianceNotes: string[];

  // Photos — some scope descriptions (repair extent, closet shelving,
  // furniture pieces, unusual trim details) are genuinely hard to price
  // sight-unseen, so certain keywords prompt the customer for a picture
  // instead of guessing. photoRequests tracks which prompts have been
  // raised (and whether fulfilled) so the same trigger doesn't fire twice;
  // photos holds what was actually uploaded, forwarded to the painter
  // along with the rest of the job details.
  photoRequests: PhotoRequest[];
  photos: UploadedPhoto[];
}

export interface PhotoRequest {
  id: string;
  /** What to say in "Provide a picture of ___" — e.g. "the closet shelving". */
  label: string;
  fulfilled: boolean;
}

export interface UploadedPhoto {
  id: string;
  url: string;
  description: string;
  /** Which request this fulfilled ("property" for the generic end-of-chat ask). */
  label: string;
}

// ===== Specialty Referrals =====

export interface SpecialtyReferral {
  type: 'lead_paint' | 'asbestos' | 'major_carpentry' | 'mold' | 'electrical' | 'plumbing' | 'structural';
  reason: string;
  severity: 'info' | 'warning' | 'critical';
}

// ===== Estimate Types =====

export interface EstimateLineItem {
  category: string;
  description: string;
  amount: number;
}

export interface EstimateBreakdown {
  lineItems: EstimateLineItem[];
  subtotal: number;
  multipliers: { label: string; factor: number }[];
  total: number;
  lowRange: number;
  highRange: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceNote: string;
}

// ===== Supabase Expanded Quote =====

export interface ExpandedQuoteSubmission {
  id?: string;
  created_at?: string;
  zip_code: string;
  state: string;
  year_built: number | null;
  property_type: string;
  project_type: string;
  square_feet: number | null;
  stories: number | null;
  interior_data: Record<string, unknown> | null;
  exterior_data: Record<string, unknown> | null;
  prep_data: Record<string, unknown> | null;
  name: string;
  email: string;
  phone: string;
  notes: string;
  estimated_price: number;
  estimate_low: number;
  estimate_high: number;
  confidence: string;
  specialty_referrals: SpecialtyReferral[];
  response_style: UserResponseStyle;
  status: string;
}
