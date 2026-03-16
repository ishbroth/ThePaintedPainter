// ===== Conversation Node Types =====

export type InputType = 'select' | 'multiselect' | 'text' | 'number' | 'email' | 'tel' | 'zip';

export interface ConversationOption {
  label: string;
  value: string;
}

export interface ConversationNode {
  id: string;
  question: string;
  subtext?: string;
  inputType: InputType;
  options?: ConversationOption[];
  placeholder?: string;
  nextNodeId: string | null;
  skipWhen?: (ctx: EstimatorContext) => boolean;
  validate?: (value: string | string[]) => string | null; // returns error message or null
  onAnswer?: (ctx: EstimatorContext, value: string | string[]) => Partial<EstimatorContext>;
  category: 'start' | 'interior' | 'exterior' | 'prep' | 'property' | 'specialty' | 'contact';
}

// ===== Response Style Detection =====

export type UserResponseStyle = 'terse' | 'normal' | 'detailed';

// ===== Estimator Context (accumulated answers) =====

export interface EstimatorContext {
  // Start
  zipCode: string;
  state: string;
  yearBuilt: number | null;
  propertyType: string; // residential, commercial, rental, hoa
  projectType: string; // interior, exterior, both

  // Interior
  interiorScope: string; // whole_house, specific_rooms
  selectedRooms: string[];
  interiorWalls: string; // yes, no
  accentWalls: string; // yes, no, skip
  interiorCeilings: string; // yes, no
  ceilingType: string; // flat, popcorn, vaulted, skip
  interiorTrim: string; // yes, no
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
  gutters: string; // yes, no, skip
  foundation: string; // yes, no, skip
  exteriorWindows: string; // none, trim_only, full
  exteriorWindowCount: number | null;
  overhangs: string; // yes, no, skip
  accessRestrictions: string; // none, some, significant
  exteriorColorChange: string; // same, different
  exteriorCondition: string; // good, fair, poor

  // Prep Work
  prepWork: string[]; // caulking, stain_cover, drywall_repair, wood_rot, wallpaper_removal, power_washing, lead_test
  caulkingExtent: string; // minor, moderate, extensive
  drywallRepairExtent: string; // minor, moderate, major
  woodRotExtent: string; // minor, moderate, major
  wallpaperRooms: number | null;
  popcornCeilingRooms: number | null;

  // Property
  squareFeet: number | null;
  stories: number | null;
  ceilingHeight: string; // standard, nine_foot, ten_plus, vaulted_mixed
  occupancy: string; // vacant, furnished, occupied
  utilities: string; // yes, no
  hoa: string; // yes, no, skip

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

// ===== Job Summary =====

export interface JobSummary {
  projectOverview: {
    propertyType: string;
    projectType: string;
    squareFeet: number | null;
    stories: number | null;
    yearBuilt: number | null;
    location: string;
  };
  interiorScope: JobScopeSection | null;
  exteriorScope: JobScopeSection | null;
  prepWork: string[];
  specialtyNeeds: SpecialtyReferral[];
  contactInfo: {
    name: string;
    phone: string;
    email: string;
    notes: string;
  };
  estimateRange: string;
  accessNotes: string;
}

export interface JobScopeSection {
  scope: string;
  details: string[];
}

// ===== Conversation State =====

export interface ConversationState {
  currentNodeId: string;
  context: EstimatorContext;
  history: { nodeId: string; answer: string | string[] }[];
  isComplete: boolean;
  estimate: EstimateBreakdown | null;
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
