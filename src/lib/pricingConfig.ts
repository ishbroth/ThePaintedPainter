// ===== All Pricing Rates (10% below current baseline) =====
// Edit this file to adjust all pricing across the estimator.

export const PRICING = {
  // Per Square Foot rates
  perSqFt: {
    interiorBase: 2.25,
    exteriorBase: 2.70,
    ceilings: 0.45,
    trim: 0.27,
    doors: 0.18,
    colorChange: 0.27,
    exteriorTrim: 0.36,
    multiStoryPerStory: 0.45,
    accessRestriction: 0.23,
    crownMolding: 0.15,
    wainscoting: 0.35,
    baseboards: 0.20,
    guttersDownspouts: 0.10,
    foundationWalls: 2.00,
    soffitsEaves: 0.18,
  },

  // Fixed Price Items
  fixed: {
    kitchenCabinets: 2250,
    bathroomCabinets: 1125,
    laundryCabinets: 900,
    deck: 720,
    fence: 540,
    garageDoorSingle: 315,
    garageDoorDouble: 475,
    entryDoor: 225,
    standardCloset: 300,
    walkInCloset: 500,
    stairway: 450,
    railingsSimple: 200,
    railingsSpindles: 350,
    railingsBoth: 500,
    balcony: 400,
    popcornCeilingPerRoom: 350,
    wallpaperRemovalPerRoom: 400,
    powerWashing: 350,
    leadPaintTest: 150,
  },

  // Per Unit rates
  perUnit: {
    interiorDoor: 175,
    closetDoor: 100,
    frenchDoor: 250,
    pocketDoor: 150,
    windowSingle: 75,
    windowDoubleHung: 100,
    windowFrenchPane: 150,
    windowBay: 200,
    exteriorWindowTrim: 85,
    fencePerLinearFt: 4.50,
    deckPerSqFt: 3.50,
    exteriorShutterPer: 95,
  },

  // Multipliers
  multipliers: {
    minorRepair: 1.15,
    majorRepair: 1.35,
    highCostZip: 1.20,
    asapTimeline: 1.05,
    terseUserPadding: 1.10,
    commercial: 1.10,
    furnished: 1.03,
    dramaticColorChange: 1.08,
    poorCondition: 1.25,
    fairCondition: 1.10,
  },

  // Confidence ranges
  confidence: {
    high: { minQuestions: 12, lowPct: 0.08, highPct: 0.08 },     // +/- 8%
    medium: { minQuestions: 6, lowPct: 0.15, highPct: 0.15 },    // +/- 15%
    low: { minQuestions: 0, lowPct: 0.25, highPct: 0.30 },       // -25% / +30%
  },

  // Deck sizes (sq ft)
  deckSizes: {
    small: 100,
    medium: 250,
    large: 450,
  },

  // Room sqft estimates (% of total when specific rooms selected)
  roomSqFtPercentages: {
    living_room: 0.15,
    kitchen: 0.12,
    master_bedroom: 0.12,
    bedroom_2: 0.08,
    bedroom_3: 0.08,
    bedroom_4: 0.07,
    bathroom_master: 0.06,
    bathroom_2: 0.04,
    bathroom_3: 0.03,
    dining_room: 0.08,
    office: 0.06,
    laundry: 0.03,
    hallway: 0.05,
    entryway: 0.03,
    garage: 0.10,
    bonus_room: 0.10,
  } as Record<string, number>,
} as const;

// High-cost ZIP prefixes
export const HIGH_COST_ZIP_PREFIXES = [
  '921', '920', '902', '900', // San Diego / LA area
  '941', '940', '943', '944', // San Francisco / Bay Area
  '100', '101', '102', '103', '104', '110', '111', '112', '113', // NYC area
  '021', '022',               // Boston
  '981', '980',               // Seattle
  '331', '330', '332', '333', // Miami
  '200', '201', '202',        // DC
  '606', '600',               // Chicago
];
