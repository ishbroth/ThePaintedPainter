// ===================================================================
// Comprehensive Residential Painting Pricing Data (2025-2026)
// ===================================================================
// Compiled from HomeGuide, Angi, HomeAdvisor, Homewyse, Fixr, HousecallPro,
// RSMeans, BEA Regional Price Parities, MERIC Cost of Living Index, and
// industry contractor forums. All rates are national averages; apply
// regional multipliers from REGIONAL_COST_MULTIPLIERS for local pricing.
//
// "perSqFt" = per square foot of paintable surface area (NOT floor area)
// "perLinFt" = per linear foot of the item
// "perUnit"  = per individual item (door, window, shutter, etc.)
// ===================================================================

// -----------------------------------------------------------------
// 1. LABOR RATES — Per Square Foot of Paintable Surface
// -----------------------------------------------------------------

export const LABOR_RATES = {
  // ---- Interior Walls ----
  interiorWalls: {
    repaintGoodCondition: { low: 1.50, mid: 2.00, high: 3.00, unit: 'perSqFt' },
    repaintFairCondition: { low: 2.00, mid: 2.75, high: 3.75, unit: 'perSqFt' },
    repaintPoorCondition: { low: 2.75, mid: 3.50, high: 5.00, unit: 'perSqFt' },
    newDrywall:           { low: 1.75, mid: 2.50, high: 3.50, unit: 'perSqFt' },
    accentWall:           { low: 2.00, mid: 3.00, high: 5.00, unit: 'perSqFt' },
    texturedWalls:        { low: 2.00, mid: 2.75, high: 4.00, unit: 'perSqFt' },
  },

  // ---- Ceilings ----
  ceilings: {
    flat:     { low: 1.00, mid: 1.50, high: 2.50, unit: 'perSqFt' },
    textured: { low: 1.25, mid: 2.00, high: 3.00, unit: 'perSqFt' },
    vaulted:  { low: 2.00, mid: 3.50, high: 6.00, unit: 'perSqFt' },
    cathedral:{ low: 3.00, mid: 4.50, high: 7.00, unit: 'perSqFt' },
    tray:     { low: 1.50, mid: 2.50, high: 4.00, unit: 'perSqFt' },
  },

  // ---- Trim / Baseboards (per linear foot) ----
  trim: {
    baseboard3in:  { low: 1.00, mid: 1.50, high: 2.50, unit: 'perLinFt' },
    baseboard5in:  { low: 1.25, mid: 2.00, high: 3.00, unit: 'perLinFt' },
    baseboard7in:  { low: 1.50, mid: 2.50, high: 3.50, unit: 'perLinFt' },
    doorCasing:    { low: 1.00, mid: 1.75, high: 3.00, unit: 'perLinFt' },
    windowCasing:  { low: 1.00, mid: 1.75, high: 3.00, unit: 'perLinFt' },
    crownMolding:  { low: 2.00, mid: 3.50, high: 6.00, unit: 'perLinFt' },
    crownMoldingHighCeiling: { low: 5.00, mid: 8.00, high: 15.00, unit: 'perLinFt' },
    chairRail:     { low: 1.50, mid: 3.00, high: 5.00, unit: 'perLinFt' },
    pictureRail:   { low: 1.50, mid: 3.00, high: 5.00, unit: 'perLinFt' },
  },

  // ---- Interior Doors (per door) ----
  doors: {
    hollowCoreFlush:     { low: 75,  mid: 100,  high: 150,  unit: 'perUnit' },
    hollowCorePanel:     { low: 100, mid: 135,  high: 175,  unit: 'perUnit' },
    solidPanel:          { low: 100, mid: 150,  high: 200,  unit: 'perUnit' },
    solidPanelBothSides: { low: 150, mid: 200,  high: 275,  unit: 'perUnit' },
    frenchDoor:          { low: 150, mid: 225,  high: 350,  unit: 'perUnit' },
    bifoldSingle:        { low: 50,  mid: 75,   high: 100,  unit: 'perUnit' },
    bifoldDouble:        { low: 75,  mid: 125,  high: 200,  unit: 'perUnit' },
    slidingCloset:       { low: 100, mid: 150,  high: 200,  unit: 'perUnit' },
    pocketDoor:          { low: 75,  mid: 125,  high: 175,  unit: 'perUnit' },
    dutchDoor:           { low: 150, mid: 200,  high: 300,  unit: 'perUnit' },
    entryDoorExterior:   { low: 150, mid: 225,  high: 350,  unit: 'perUnit' },
    doorFrame:           { low: 30,  mid: 45,   high: 75,   unit: 'perUnit' },
  },

  // ---- Window Frames / Sills (per window unit) ----
  windows: {
    singlePane:    { low: 50,  mid: 75,   high: 110,  unit: 'perUnit' },
    doubleHung:    { low: 65,  mid: 100,  high: 150,  unit: 'perUnit' },
    frenchPane:    { low: 100, mid: 150,  high: 225,  unit: 'perUnit' },
    bayWindow:     { low: 150, mid: 200,  high: 300,  unit: 'perUnit' },
    pictureWindow: { low: 60,  mid: 90,   high: 130,  unit: 'perUnit' },
    windowTrimPerLinFt: { low: 1.00, mid: 2.00, high: 4.00, unit: 'perLinFt' },
    windowSill:    { low: 10,  mid: 20,   high: 35,   unit: 'perUnit' },
  },

  // ---- Kitchen Cabinets ----
  kitchenCabinets: {
    perLinearFoot:    { low: 30, mid: 50,  high: 75,  unit: 'perLinFt' },
    perDoorFace:      { low: 90, mid: 130, high: 175, unit: 'perUnit' },
    perDrawerFront:   { low: 30, mid: 45,  high: 65,  unit: 'perUnit' },
    smallKitchen:     { low: 1800, mid: 2800, high: 4000, unit: 'perProject' },
    mediumKitchen:    { low: 2800, mid: 4200, high: 5500, unit: 'perProject' },
    largeKitchen:     { low: 4000, mid: 5500, high: 7500, unit: 'perProject' },
    sprayFinish:      { low: 40, mid: 65,  high: 100, unit: 'perLinFt' },
    brushRollFinish:  { low: 30, mid: 50,  high: 70,  unit: 'perLinFt' },
    bathroomVanity:   { low: 400, mid: 750, high: 1200, unit: 'perProject' },
    laundryRoom:      { low: 350, mid: 600, high: 1000, unit: 'perProject' },
  },

  // ---- Exterior Siding (per sq ft of paintable surface) ----
  exteriorSiding: {
    stucco:     { low: 1.50, mid: 2.50, high: 4.00, unit: 'perSqFt' },
    woodLap:    { low: 1.50, mid: 2.75, high: 4.50, unit: 'perSqFt' },
    woodShingle:{ low: 2.00, mid: 3.25, high: 5.00, unit: 'perSqFt' },
    vinyl:      { low: 1.00, mid: 2.00, high: 3.00, unit: 'perSqFt' },
    hardieBoard:{ low: 1.25, mid: 2.25, high: 3.50, unit: 'perSqFt' },
    brick:      { low: 1.40, mid: 2.75, high: 4.20, unit: 'perSqFt' },
    stone:      { low: 2.00, mid: 3.50, high: 5.50, unit: 'perSqFt' },
    aluminum:   { low: 1.00, mid: 1.75, high: 3.00, unit: 'perSqFt' },
    composite:  { low: 1.25, mid: 2.25, high: 3.50, unit: 'perSqFt' },
    logCabin:   { low: 2.50, mid: 4.00, high: 6.00, unit: 'perSqFt' },
  },

  // ---- Exterior Trim / Fascia ----
  exteriorTrim: {
    fasciaBoard:    { low: 2.50, mid: 4.50, high: 8.00, unit: 'perLinFt' },
    soffitPerSqFt:  { low: 2.00, mid: 3.50, high: 6.00, unit: 'perSqFt' },
    soffitPerLinFt: { low: 2.50, mid: 4.50, high: 7.00, unit: 'perLinFt' },
    cornerBoards:   { low: 2.00, mid: 3.50, high: 5.00, unit: 'perLinFt' },
    eavesPerLinFt:  { low: 4.00, mid: 8.00, high: 14.00, unit: 'perLinFt' },
    gutterPerLinFt: { low: 1.50, mid: 2.50, high: 4.00, unit: 'perLinFt' },
    downspoutPer:   { low: 25, mid: 45, high: 75, unit: 'perUnit' },
    exteriorWindowTrim: { low: 50, mid: 85, high: 140, unit: 'perUnit' },
  },

  // ---- Specialty Items ----
  specialty: {
    // Fireplaces
    fireplaceFullBrick:    { low: 300, mid: 500, high: 1000, unit: 'perUnit' },
    fireplaceFullStone:    { low: 350, mid: 600, high: 1200, unit: 'perUnit' },
    fireplaceMantel:       { low: 75,  mid: 150, high: 300,  unit: 'perUnit' },
    fireplacePerSqFt:      { low: 4.00, mid: 8.00, high: 15.00, unit: 'perSqFt' },

    // Exposed Beams
    exposedBeamPerLinFt:   { low: 5.00, mid: 10.00, high: 18.00, unit: 'perLinFt' },
    exposedBeamStainPerLinFt: { low: 6.00, mid: 12.00, high: 20.00, unit: 'perLinFt' },

    // Built-in Shelving / Bookcases
    builtInBookcaseSmall:  { low: 200, mid: 350, high: 600, unit: 'perUnit' },
    builtInBookcaseLarge:  { low: 400, mid: 700, high: 1200, unit: 'perUnit' },
    builtInShelvingPerSqFt:{ low: 3.00, mid: 6.00, high: 10.00, unit: 'perSqFt' },

    // Whitewashing / Limewash Brick
    whitewashBrickPerSqFt: { low: 1.50, mid: 3.00, high: 5.00, unit: 'perSqFt' },
    limewashBrickPerSqFt:  { low: 2.50, mid: 4.25, high: 6.00, unit: 'perSqFt' },

    // Epoxy Garage Floors
    epoxyGarageFloorPerSqFt: { low: 4.00, mid: 7.50, high: 12.00, unit: 'perSqFt' },
    polyasparticFloorPerSqFt:{ low: 5.00, mid: 8.50, high: 14.00, unit: 'perSqFt' },
    epoxyGarage1Car:         { low: 1000, mid: 1800, high: 3000, unit: 'perProject' },
    epoxyGarage2Car:         { low: 1600, mid: 3000, high: 5000, unit: 'perProject' },
    epoxyGarage3Car:         { low: 2400, mid: 4500, high: 7000, unit: 'perProject' },

    // Furniture Painting
    furnitureDresser:       { low: 200, mid: 300, high: 500, unit: 'perUnit' },
    furnitureTable:          { low: 200, mid: 400, high: 650, unit: 'perUnit' },
    furnitureChair:          { low: 100, mid: 150, high: 250, unit: 'perUnit' },
    furnitureDiningSet:      { low: 700, mid: 1000, high: 1500, unit: 'perUnit' },
    furnitureNightstand:     { low: 75,  mid: 125, high: 200, unit: 'perUnit' },
    furnitureDesk:           { low: 150, mid: 275, high: 450, unit: 'perUnit' },
    furnitureBookcase:       { low: 175, mid: 300, high: 500, unit: 'perUnit' },

    // Railings / Spindles
    railingSimplePerLinFt:   { low: 2.00, mid: 4.00, high: 8.00, unit: 'perLinFt' },
    railingSpindlesPerLinFt: { low: 4.00, mid: 8.00, high: 14.00, unit: 'perLinFt' },
    railingIronPerLinFt:     { low: 5.00, mid: 10.00, high: 18.00, unit: 'perLinFt' },
    spindleEach:             { low: 3.00, mid: 5.00, high: 8.00, unit: 'perUnit' },

    // Deck / Fence Staining
    deckStainPerSqFt:          { low: 2.50, mid: 4.00, high: 6.50, unit: 'perSqFt' },
    deckStainWithRailsPerSqFt: { low: 5.00, mid: 6.50, high: 8.50, unit: 'perSqFt' },
    deckRailPerLinFt:          { low: 4.00, mid: 6.00, high: 10.00, unit: 'perLinFt' },
    deckStripAndStainPerSqFt:  { low: 4.00, mid: 6.50, high: 9.00, unit: 'perSqFt' },
    fenceStainPerSqFt:         { low: 1.00, mid: 1.75, high: 3.00, unit: 'perSqFt' },
    fencePaintPerLinFt:        { low: 3.00, mid: 7.00, high: 14.00, unit: 'perLinFt' },
    fenceStainPerLinFt:        { low: 3.00, mid: 5.50, high: 9.00, unit: 'perLinFt' },

    // Stair Risers / Stringers
    stairRisersPerStep:      { low: 15, mid: 30, high: 50, unit: 'perUnit' },
    stairStringersPerFlight: { low: 75, mid: 150, high: 250, unit: 'perUnit' },
    stairwayFullPaint:       { low: 350, mid: 450, high: 700, unit: 'perUnit' },
    stairwayPerLinFt:        { low: 4.00, mid: 8.00, high: 12.00, unit: 'perLinFt' },

    // Wainscoting / Paneling
    wainscotingPerSqFt:     { low: 4.00, mid: 6.50, high: 10.00, unit: 'perSqFt' },
    wainscotingPerLinFt:    { low: 4.00, mid: 8.00, high: 15.00, unit: 'perLinFt' },
    beadboardPerSqFt:       { low: 3.50, mid: 5.50, high: 8.00, unit: 'perSqFt' },
    shiplap:                { low: 3.00, mid: 5.00, high: 8.00, unit: 'perSqFt' },
    raisedPanelPerSqFt:     { low: 5.00, mid: 8.00, high: 12.00, unit: 'perSqFt' },

    // Crown Molding
    crownMoldingPerLinFt:       { low: 2.00, mid: 3.50, high: 6.00, unit: 'perLinFt' },
    crownMoldingHighPerLinFt:   { low: 5.00, mid: 8.00, high: 15.00, unit: 'perLinFt' },

    // Chair Rail
    chairRailPerLinFt:          { low: 1.50, mid: 3.00, high: 5.00, unit: 'perLinFt' },

    // Shutters
    shutterInteriorPer:         { low: 40, mid: 75, high: 120, unit: 'perUnit' },
    shutterExteriorPer:         { low: 45, mid: 85, high: 150, unit: 'perUnit' },
    shutterExteriorLouverPer:   { low: 50, mid: 95, high: 175, unit: 'perUnit' },
    shutterExteriorPanelPer:    { low: 40, mid: 70, high: 120, unit: 'perUnit' },
  },
} as const;


// -----------------------------------------------------------------
// 2. PREP WORK PRICING
// -----------------------------------------------------------------

export const PREP_WORK_PRICING = {
  // Priming
  primingNewDrywall:       { low: 0.15, mid: 0.30, high: 0.50, unit: 'perSqFt' },
  primingStainedWood:      { low: 0.50, mid: 0.85, high: 1.50, unit: 'perSqFt' },
  primingBareWood:         { low: 0.35, mid: 0.60, high: 1.00, unit: 'perSqFt' },
  primingOilBased:         { low: 0.50, mid: 0.90, high: 1.50, unit: 'perSqFt' },
  stainkillPrimer:         { low: 0.40, mid: 0.75, high: 1.25, unit: 'perSqFt' },

  // Wallpaper Removal
  wallpaperRemovalPerSqFt: { low: 0.75, mid: 1.50, high: 3.00, unit: 'perSqFt' },
  wallpaperRemovalPerRoom: { low: 300,  mid: 500,  high: 800,  unit: 'perRoom' },
  wallpaperRemovalMultiLayer: { low: 1.50, mid: 2.50, high: 4.50, unit: 'perSqFt' },

  // Popcorn Ceiling Removal
  popcornRemovalPerSqFt:   { low: 1.00, mid: 2.00, high: 3.50, unit: 'perSqFt' },
  popcornRemovalAndPaint:  { low: 2.00, mid: 3.50, high: 6.00, unit: 'perSqFt' },
  popcornRemovalPerRoom:   { low: 250,  mid: 450,  high: 750,  unit: 'perRoom' },

  // Lead Paint
  leadPaintTestingPerUnit: { low: 15,   mid: 35,   high: 75,   unit: 'perUnit' },
  leadPaintTestingPerHome: { low: 100,  mid: 250,  high: 500,  unit: 'perProject' },
  leadPaintEncapsulation:  { low: 4.00, mid: 7.00, high: 10.00, unit: 'perSqFt' },
  leadPaintFullRemoval:    { low: 8.00, mid: 12.00, high: 17.00, unit: 'perSqFt' },
  leadPaintDisposal:       { low: 3.00, mid: 4.00, high: 5.00, unit: 'perSqFt' },

  // Caulking
  caulkingPerLinFt:        { low: 0.50, mid: 1.00, high: 2.00, unit: 'perLinFt' },
  caulkingMinorProject:    { low: 100,  mid: 200,  high: 400,  unit: 'perProject' },
  caulkingMajorProject:    { low: 300,  mid: 550,  high: 800,  unit: 'perProject' },

  // Drywall Repair
  drywallRepairMinor:      { low: 50,   mid: 125,  high: 250,  unit: 'perPatch' },
  drywallRepairModerate:   { low: 150,  mid: 350,  high: 600,  unit: 'perRoom' },
  drywallRepairMajor:      { low: 400,  mid: 700,  high: 1200, unit: 'perRoom' },
  drywallRepairPerSqFt:    { low: 1.50, mid: 2.50, high: 3.50, unit: 'perSqFt' },
  drywallHangAndFinish:    { low: 2.50, mid: 4.00, high: 6.00, unit: 'perSqFt' },

  // Wood Rot Repair
  woodRotMinor:            { low: 100,  mid: 250,  high: 500,  unit: 'perRepair' },
  woodRotModerate:         { low: 300,  mid: 600,  high: 1000, unit: 'perRepair' },
  woodRotMajor:            { low: 600,  mid: 1100, high: 2500, unit: 'perRepair' },
  woodRotPerSqFt:          { low: 5.00, mid: 15.00, high: 40.00, unit: 'perSqFt' },
  woodSidingReplacePerSqFt:{ low: 6.00, mid: 9.50, high: 19.00, unit: 'perSqFt' },

  // Pressure Washing
  pressureWashPerSqFt:     { low: 0.15, mid: 0.35, high: 0.55, unit: 'perSqFt' },
  pressureWashDeck:        { low: 100,  mid: 200,  high: 400,  unit: 'perProject' },
  pressureWashDriveway:    { low: 100,  mid: 200,  high: 350,  unit: 'perProject' },
  pressureWashHouse:       { low: 200,  mid: 400,  high: 750,  unit: 'perProject' },

  // Sanding / Deglossing
  sandingPerSqFt:          { low: 0.50, mid: 0.85, high: 1.50, unit: 'perSqFt' },
  deglossChemicalPerSqFt:  { low: 0.40, mid: 0.75, high: 1.25, unit: 'perSqFt' },
  paintStrippingPerSqFt:   { low: 0.75, mid: 1.50, high: 3.00, unit: 'perSqFt' },

  // Surface Patching / Skim Coating
  skimCoatPerSqFt:         { low: 1.00, mid: 1.75, high: 3.00, unit: 'perSqFt' },
  textureMatchPerSqFt:     { low: 1.00, mid: 2.00, high: 4.00, unit: 'perSqFt' },
} as const;


// -----------------------------------------------------------------
// 3. REGIONAL COST MULTIPLIERS (relative to national average = 1.00)
// -----------------------------------------------------------------
// Sources: BEA Regional Price Parities (2024), MERIC/C2ER Cost of Living
// Index (2025), RSMeans City Cost Index, and painting industry surveys.
// ZIP prefixes map to the primary metro in each zone.
//
// Multipliers account for labor rate differences, overhead, insurance,
// licensing, and local market demand. Painting labor typically varies
// more than general cost of living (20-40% swings in major metros).
// -----------------------------------------------------------------

export interface RegionalMultiplier {
  metro: string;
  state: string;
  multiplier: number;
  zipPrefixes: string[];
}

export const REGIONAL_COST_MULTIPLIERS: RegionalMultiplier[] = [
  // --- Highest Cost (1.30+) ---
  { metro: 'San Francisco-Oakland-Berkeley', state: 'CA', multiplier: 1.48, zipPrefixes: ['940', '941', '943', '944', '945', '946', '947', '948', '949'] },
  { metro: 'San Jose-Sunnyvale-Santa Clara', state: 'CA', multiplier: 1.45, zipPrefixes: ['950', '951'] },
  { metro: 'New York City (Manhattan)', state: 'NY', multiplier: 1.45, zipPrefixes: ['100', '101', '102'] },
  { metro: 'Honolulu', state: 'HI', multiplier: 1.42, zipPrefixes: ['967', '968'] },
  { metro: 'New York City (Brooklyn/Queens)', state: 'NY', multiplier: 1.38, zipPrefixes: ['110', '111', '112', '113', '114'] },
  { metro: 'Boston-Cambridge-Newton', state: 'MA', multiplier: 1.35, zipPrefixes: ['021', '022', '024'] },
  { metro: 'Seattle-Tacoma-Bellevue', state: 'WA', multiplier: 1.32, zipPrefixes: ['980', '981', '984'] },
  { metro: 'Washington DC Metro', state: 'DC', multiplier: 1.30, zipPrefixes: ['200', '201', '202', '203', '220', '221', '222'] },
  { metro: 'Los Angeles-Long Beach', state: 'CA', multiplier: 1.30, zipPrefixes: ['900', '901', '902', '903', '904', '905', '906', '907', '908'] },

  // --- High Cost (1.15-1.29) ---
  { metro: 'San Diego-Chula Vista', state: 'CA', multiplier: 1.28, zipPrefixes: ['919', '920', '921'] },
  { metro: 'Orange County (Anaheim-Irvine)', state: 'CA', multiplier: 1.28, zipPrefixes: ['926', '927', '928'] },
  { metro: 'Stamford-Bridgeport (CT)', state: 'CT', multiplier: 1.27, zipPrefixes: ['068', '069'] },
  { metro: 'Northern NJ (Newark-Jersey City)', state: 'NJ', multiplier: 1.25, zipPrefixes: ['070', '071', '072', '073', '074'] },
  { metro: 'Portland-Vancouver-Hillsboro', state: 'OR', multiplier: 1.22, zipPrefixes: ['970', '971', '972'] },
  { metro: 'Riverside-San Bernardino', state: 'CA', multiplier: 1.20, zipPrefixes: ['922', '923', '924', '925'] },
  { metro: 'Sacramento-Roseville-Folsom', state: 'CA', multiplier: 1.20, zipPrefixes: ['956', '957', '958'] },
  { metro: 'Denver-Aurora-Lakewood', state: 'CO', multiplier: 1.20, zipPrefixes: ['800', '801', '802', '803', '804', '805'] },
  { metro: 'Miami-Fort Lauderdale', state: 'FL', multiplier: 1.18, zipPrefixes: ['330', '331', '332', '333', '334'] },
  { metro: 'Hartford-East Hartford', state: 'CT', multiplier: 1.18, zipPrefixes: ['060', '061', '062'] },
  { metro: 'Chicago-Naperville-Evanston', state: 'IL', multiplier: 1.18, zipPrefixes: ['600', '601', '602', '603', '604', '605', '606'] },
  { metro: 'Minneapolis-St. Paul', state: 'MN', multiplier: 1.15, zipPrefixes: ['550', '551', '553', '554', '555'] },
  { metro: 'Philadelphia-Camden-Wilmington', state: 'PA', multiplier: 1.15, zipPrefixes: ['190', '191'] },
  { metro: 'Long Island (Nassau-Suffolk)', state: 'NY', multiplier: 1.22, zipPrefixes: ['115', '116', '117', '118', '119'] },
  { metro: 'Westchester-Rockland (NY)', state: 'NY', multiplier: 1.25, zipPrefixes: ['105', '106', '107', '108', '109'] },
  { metro: 'Austin-Round Rock-Georgetown', state: 'TX', multiplier: 1.15, zipPrefixes: ['786', '787'] },
  { metro: 'Nashville-Davidson-Murfreesboro', state: 'TN', multiplier: 1.15, zipPrefixes: ['370', '371', '372', '373'] },
  { metro: 'Salt Lake City', state: 'UT', multiplier: 1.12, zipPrefixes: ['840', '841'] },
  { metro: 'Anchorage', state: 'AK', multiplier: 1.30, zipPrefixes: ['995', '996'] },

  // --- Average Cost (0.95-1.14) ---
  { metro: 'Phoenix-Mesa-Chandler', state: 'AZ', multiplier: 1.08, zipPrefixes: ['850', '851', '852', '853'] },
  { metro: 'Raleigh-Cary', state: 'NC', multiplier: 1.08, zipPrefixes: ['275', '276'] },
  { metro: 'Charlotte-Concord-Gastonia', state: 'NC', multiplier: 1.06, zipPrefixes: ['280', '281', '282'] },
  { metro: 'Dallas-Fort Worth-Arlington', state: 'TX', multiplier: 1.05, zipPrefixes: ['750', '751', '752', '753', '760', '761', '762'] },
  { metro: 'Tampa-St. Petersburg', state: 'FL', multiplier: 1.05, zipPrefixes: ['335', '336', '337', '338'] },
  { metro: 'Orlando-Kissimmee-Sanford', state: 'FL', multiplier: 1.05, zipPrefixes: ['327', '328', '329'] },
  { metro: 'Las Vegas-Henderson', state: 'NV', multiplier: 1.05, zipPrefixes: ['889', '890', '891'] },
  { metro: 'Atlanta-Sandy Springs-Roswell', state: 'GA', multiplier: 1.05, zipPrefixes: ['300', '301', '302', '303', '304'] },
  { metro: 'Houston-The Woodlands-Sugar Land', state: 'TX', multiplier: 1.02, zipPrefixes: ['770', '771', '772', '773', '774', '775'] },
  { metro: 'San Antonio-New Braunfels', state: 'TX', multiplier: 0.98, zipPrefixes: ['780', '781', '782'] },
  { metro: 'Detroit-Warren-Dearborn', state: 'MI', multiplier: 1.00, zipPrefixes: ['480', '481', '482', '483', '484'] },
  { metro: 'Pittsburgh', state: 'PA', multiplier: 1.00, zipPrefixes: ['150', '151', '152'] },
  { metro: 'Columbus (OH)', state: 'OH', multiplier: 0.98, zipPrefixes: ['430', '431', '432'] },
  { metro: 'Richmond (VA)', state: 'VA', multiplier: 1.00, zipPrefixes: ['230', '231', '232'] },
  { metro: 'Jacksonville (FL)', state: 'FL', multiplier: 1.00, zipPrefixes: ['320', '321', '322'] },
  { metro: 'Boise City', state: 'ID', multiplier: 1.05, zipPrefixes: ['836', '837'] },
  { metro: 'Providence-Warwick', state: 'RI', multiplier: 1.10, zipPrefixes: ['028', '029'] },
  { metro: 'Milwaukee-Waukesha', state: 'WI', multiplier: 1.02, zipPrefixes: ['530', '531', '532'] },
  { metro: 'Baltimore-Columbia-Towson', state: 'MD', multiplier: 1.10, zipPrefixes: ['210', '211', '212'] },

  // --- Below Average Cost (0.80-0.94) ---
  { metro: 'Cleveland-Elyria', state: 'OH', multiplier: 0.92, zipPrefixes: ['440', '441', '442', '443', '444'] },
  { metro: 'Cincinnati-Dayton', state: 'OH', multiplier: 0.92, zipPrefixes: ['450', '451', '452', '453'] },
  { metro: 'Kansas City (MO-KS)', state: 'MO', multiplier: 0.92, zipPrefixes: ['640', '641', '660', '661', '662'] },
  { metro: 'St. Louis (MO-IL)', state: 'MO', multiplier: 0.92, zipPrefixes: ['630', '631', '620', '622'] },
  { metro: 'Indianapolis-Carmel-Anderson', state: 'IN', multiplier: 0.90, zipPrefixes: ['460', '461', '462'] },
  { metro: 'Louisville-Jefferson County', state: 'KY', multiplier: 0.90, zipPrefixes: ['400', '401', '402'] },
  { metro: 'Memphis (TN-MS-AR)', state: 'TN', multiplier: 0.88, zipPrefixes: ['380', '381', '382'] },
  { metro: 'Oklahoma City', state: 'OK', multiplier: 0.85, zipPrefixes: ['730', '731', '733'] },
  { metro: 'Tulsa', state: 'OK', multiplier: 0.85, zipPrefixes: ['740', '741', '743'] },
  { metro: 'New Orleans-Metairie', state: 'LA', multiplier: 0.90, zipPrefixes: ['700', '701'] },
  { metro: 'Little Rock-North Little Rock', state: 'AR', multiplier: 0.85, zipPrefixes: ['720', '721', '722'] },
  { metro: 'Birmingham-Hoover', state: 'AL', multiplier: 0.85, zipPrefixes: ['350', '351', '352'] },
  { metro: 'Omaha-Council Bluffs', state: 'NE', multiplier: 0.90, zipPrefixes: ['680', '681'] },
  { metro: 'Des Moines-West Des Moines', state: 'IA', multiplier: 0.88, zipPrefixes: ['500', '501', '502', '503'] },
  { metro: 'Knoxville', state: 'TN', multiplier: 0.88, zipPrefixes: ['377', '378', '379'] },
  { metro: 'El Paso', state: 'TX', multiplier: 0.82, zipPrefixes: ['798', '799'] },
  { metro: 'Albuquerque', state: 'NM', multiplier: 0.88, zipPrefixes: ['870', '871'] },
  { metro: 'Tucson', state: 'AZ', multiplier: 0.90, zipPrefixes: ['856', '857'] },

  // --- Lowest Cost (below 0.80) ---
  { metro: 'Jackson (MS)', state: 'MS', multiplier: 0.78, zipPrefixes: ['390', '391', '392'] },
  { metro: 'Rural Mississippi', state: 'MS', multiplier: 0.72, zipPrefixes: ['386', '387', '388', '389', '393', '394', '395', '396', '397'] },
  { metro: 'Rural Arkansas', state: 'AR', multiplier: 0.75, zipPrefixes: ['716', '717', '718', '719', '723', '724', '725', '726', '727', '728', '729'] },
  { metro: 'Rural West Virginia', state: 'WV', multiplier: 0.75, zipPrefixes: ['245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260', '261', '262', '263', '264', '265', '266', '267', '268'] },
  { metro: 'Rural Alabama', state: 'AL', multiplier: 0.78, zipPrefixes: ['354', '355', '356', '357', '358', '359', '360', '361', '362', '363', '364', '365', '366', '367', '368'] },
  { metro: 'Rural Kentucky', state: 'KY', multiplier: 0.78, zipPrefixes: ['403', '404', '405', '406', '407', '408', '409', '410', '411', '412', '413', '414', '415', '416', '417', '418', '420', '421', '422', '423', '424', '425', '426', '427'] },
];


// -----------------------------------------------------------------
// Helper: look up multiplier from a 5-digit ZIP code
// Returns 1.00 (national average) if no match found
// -----------------------------------------------------------------

export function getRegionalMultiplier(zipCode: string): number {
  const prefix = zipCode.substring(0, 3);
  for (const region of REGIONAL_COST_MULTIPLIERS) {
    if (region.zipPrefixes.includes(prefix)) {
      return region.multiplier;
    }
  }
  return 1.00; // national average fallback
}

export function getRegionalInfo(zipCode: string): RegionalMultiplier | null {
  const prefix = zipCode.substring(0, 3);
  for (const region of REGIONAL_COST_MULTIPLIERS) {
    if (region.zipPrefixes.includes(prefix)) {
      return region;
    }
  }
  return null;
}


// -----------------------------------------------------------------
// 4. STANDARD ROOM DIMENSIONS (painting industry standards)
// -----------------------------------------------------------------
// All dimensions in feet. Wall sqft calculated assuming standard 8ft
// ceilings unless noted. Openings (doors/windows) deducted from wall area.
// -----------------------------------------------------------------

export interface RoomDimensions {
  label: string;
  widthFt: number;
  lengthFt: number;
  ceilingHeightFt: number;
  floorSqFt: number;
  grossWallSqFt: number;        // total wall area at ceiling height
  netPaintableWallSqFt: number; // minus doors, windows, openings
  ceilingSqFt: number;
  trimLinearFt: number;         // baseboard perimeter minus openings
  doors: number;
  windows: number;
  closets: number;
  crownMoldingLinFt: number;    // full perimeter (typically same as room perimeter)
  notes: string;
}

export const STANDARD_ROOM_DIMENSIONS: Record<string, RoomDimensions> = {
  // ---- Bedrooms ----
  masterBedroom: {
    label: 'Master Bedroom',
    widthFt: 14, lengthFt: 16, ceilingHeightFt: 8,
    floorSqFt: 224,
    grossWallSqFt: 480,         // (14+16)*2*8
    netPaintableWallSqFt: 416,  // minus 1 door (21), 2 windows (30), 1 closet opening (13)
    ceilingSqFt: 224,
    trimLinearFt: 52,           // 60 perimeter minus ~8ft of openings
    doors: 1, windows: 2, closets: 1,
    crownMoldingLinFt: 60,
    notes: 'Average US master bedroom: 200-300 sqft floor area',
  },
  masterBedroomLarge: {
    label: 'Master Bedroom (Large/Luxury)',
    widthFt: 16, lengthFt: 20, ceilingHeightFt: 9,
    floorSqFt: 320,
    grossWallSqFt: 648,         // (16+20)*2*9
    netPaintableWallSqFt: 570,
    ceilingSqFt: 320,
    trimLinearFt: 64,
    doors: 1, windows: 3, closets: 2,
    crownMoldingLinFt: 72,
    notes: 'Higher-end homes, 300-400 sqft with attached bath & walk-in',
  },
  bedroomSecondary: {
    label: 'Secondary Bedroom',
    widthFt: 12, lengthFt: 12, ceilingHeightFt: 8,
    floorSqFt: 144,
    grossWallSqFt: 384,
    netPaintableWallSqFt: 336,
    ceilingSqFt: 144,
    trimLinearFt: 42,
    doors: 1, windows: 1, closets: 1,
    crownMoldingLinFt: 48,
    notes: 'Average secondary bedroom: 120-150 sqft',
  },
  bedroomSmall: {
    label: 'Small Bedroom / Guest Room',
    widthFt: 10, lengthFt: 10, ceilingHeightFt: 8,
    floorSqFt: 100,
    grossWallSqFt: 320,
    netPaintableWallSqFt: 272,
    ceilingSqFt: 100,
    trimLinearFt: 34,
    doors: 1, windows: 1, closets: 1,
    crownMoldingLinFt: 40,
    notes: 'Minimum bedroom: 70 sqft (IRC code). Typical small: 100 sqft',
  },

  // ---- Bathrooms ----
  masterBathroom: {
    label: 'Master Bathroom',
    widthFt: 10, lengthFt: 12, ceilingHeightFt: 8,
    floorSqFt: 120,
    grossWallSqFt: 352,
    netPaintableWallSqFt: 252,  // minus tub/shower surround, vanity, mirror, door
    ceilingSqFt: 120,
    trimLinearFt: 34,
    doors: 1, windows: 1, closets: 0,
    crownMoldingLinFt: 44,
    notes: 'Average master bath 40-100+ sqft. Deduct for tile, vanity, shower',
  },
  fullBathroom: {
    label: 'Full Bathroom',
    widthFt: 8, lengthFt: 10, ceilingHeightFt: 8,
    floorSqFt: 80,
    grossWallSqFt: 288,
    netPaintableWallSqFt: 200,
    ceilingSqFt: 80,
    trimLinearFt: 28,
    doors: 1, windows: 1, closets: 0,
    crownMoldingLinFt: 36,
    notes: 'Average full bath: 40-60 sqft. Includes tub/shower, toilet, sink',
  },
  halfBathroom: {
    label: 'Half Bathroom (Powder Room)',
    widthFt: 5, lengthFt: 8, ceilingHeightFt: 8,
    floorSqFt: 40,
    grossWallSqFt: 208,
    netPaintableWallSqFt: 164,
    ceilingSqFt: 40,
    trimLinearFt: 22,
    doors: 1, windows: 0, closets: 0,
    crownMoldingLinFt: 26,
    notes: 'Average half bath: 20-40 sqft. Toilet and sink only',
  },

  // ---- Kitchen ----
  kitchenAverage: {
    label: 'Kitchen',
    widthFt: 12, lengthFt: 14, ceilingHeightFt: 8,
    floorSqFt: 168,
    grossWallSqFt: 416,
    netPaintableWallSqFt: 220,  // heavy deductions for cabinets, backsplash, appliances
    ceilingSqFt: 168,
    trimLinearFt: 28,           // less trim where cabinets sit
    doors: 1, windows: 1, closets: 0,
    crownMoldingLinFt: 52,
    notes: 'Average US kitchen 150-250 sqft. ~40-50% of wall covered by cabinets/appliances',
  },
  kitchenLarge: {
    label: 'Kitchen (Large/Open Concept)',
    widthFt: 16, lengthFt: 18, ceilingHeightFt: 9,
    floorSqFt: 288,
    grossWallSqFt: 612,
    netPaintableWallSqFt: 340,
    ceilingSqFt: 288,
    trimLinearFt: 36,
    doors: 1, windows: 2, closets: 1,
    crownMoldingLinFt: 68,
    notes: 'Larger kitchens in open-concept homes',
  },

  // ---- Living Room ----
  livingRoom: {
    label: 'Living Room',
    widthFt: 16, lengthFt: 20, ceilingHeightFt: 8,
    floorSqFt: 320,
    grossWallSqFt: 576,
    netPaintableWallSqFt: 488,  // minus door, 3 windows, possible archway
    ceilingSqFt: 320,
    trimLinearFt: 62,
    doors: 1, windows: 3, closets: 0,
    crownMoldingLinFt: 72,
    notes: 'Average living room: 216-340 sqft (median ~330 sqft)',
  },
  livingRoomSmall: {
    label: 'Living Room (Small / Apartment)',
    widthFt: 12, lengthFt: 14, ceilingHeightFt: 8,
    floorSqFt: 168,
    grossWallSqFt: 416,
    netPaintableWallSqFt: 356,
    ceilingSqFt: 168,
    trimLinearFt: 46,
    doors: 1, windows: 2, closets: 0,
    crownMoldingLinFt: 52,
    notes: 'Smaller home / apartment living room: 130-180 sqft',
  },

  // ---- Dining Room ----
  diningRoom: {
    label: 'Dining Room',
    widthFt: 12, lengthFt: 14, ceilingHeightFt: 8,
    floorSqFt: 168,
    grossWallSqFt: 416,
    netPaintableWallSqFt: 368,
    ceilingSqFt: 168,
    trimLinearFt: 46,
    doors: 1, windows: 1, closets: 0,
    crownMoldingLinFt: 52,
    notes: 'Average dining room: 180-250 sqft (12x15 common)',
  },

  // ---- Hallway ----
  hallway: {
    label: 'Hallway',
    widthFt: 4, lengthFt: 15, ceilingHeightFt: 8,
    floorSqFt: 60,
    grossWallSqFt: 304,         // long narrow = lots of wall
    netPaintableWallSqFt: 240,  // minus several door openings
    ceilingSqFt: 60,
    trimLinearFt: 28,           // both sides minus door openings
    doors: 0, windows: 0, closets: 0,
    crownMoldingLinFt: 38,
    notes: 'Standard hallway 36-48 inches wide. High wall-to-floor ratio',
  },
  hallwayLong: {
    label: 'Hallway (Long)',
    widthFt: 4, lengthFt: 25, ceilingHeightFt: 8,
    floorSqFt: 100,
    grossWallSqFt: 464,
    netPaintableWallSqFt: 380,
    ceilingSqFt: 100,
    trimLinearFt: 42,
    doors: 0, windows: 0, closets: 0,
    crownMoldingLinFt: 58,
    notes: 'Longer hallways in ranch or larger homes',
  },

  // ---- Entryway / Foyer ----
  entryway: {
    label: 'Entryway / Foyer',
    widthFt: 8, lengthFt: 8, ceilingHeightFt: 9,
    floorSqFt: 64,
    grossWallSqFt: 288,
    netPaintableWallSqFt: 216,  // minus front door, coat closet, passage openings
    ceilingSqFt: 64,
    trimLinearFt: 24,
    doors: 1, windows: 1, closets: 1,
    crownMoldingLinFt: 32,
    notes: 'Average foyer 40-80 sqft. Often has higher ceilings',
  },
  foyerGrand: {
    label: 'Grand Foyer (Two-Story)',
    widthFt: 10, lengthFt: 12, ceilingHeightFt: 18,
    floorSqFt: 120,
    grossWallSqFt: 792,
    netPaintableWallSqFt: 680,
    ceilingSqFt: 120,
    trimLinearFt: 36,
    doors: 1, windows: 2, closets: 1,
    crownMoldingLinFt: 44,
    notes: 'Two-story foyer requires scaffolding/extension equipment',
  },

  // ---- Office / Den ----
  office: {
    label: 'Office / Den',
    widthFt: 10, lengthFt: 12, ceilingHeightFt: 8,
    floorSqFt: 120,
    grossWallSqFt: 352,
    netPaintableWallSqFt: 296,
    ceilingSqFt: 120,
    trimLinearFt: 38,
    doors: 1, windows: 1, closets: 1,
    crownMoldingLinFt: 44,
    notes: 'Average home office: 100-150 sqft',
  },

  // ---- Laundry Room ----
  laundryRoom: {
    label: 'Laundry Room',
    widthFt: 6, lengthFt: 8, ceilingHeightFt: 8,
    floorSqFt: 48,
    grossWallSqFt: 224,
    netPaintableWallSqFt: 156,  // minus cabinets, appliance area
    ceilingSqFt: 48,
    trimLinearFt: 20,
    doors: 1, windows: 0, closets: 0,
    crownMoldingLinFt: 28,
    notes: 'Average laundry: 35-60 sqft',
  },

  // ---- Closets ----
  closetStandard: {
    label: 'Standard Reach-In Closet',
    widthFt: 6, lengthFt: 2, ceilingHeightFt: 8,
    floorSqFt: 12,
    grossWallSqFt: 128,
    netPaintableWallSqFt: 80,   // minus shelving system, rods
    ceilingSqFt: 12,
    trimLinearFt: 0,            // inside closets typically no baseboard
    doors: 0, windows: 0, closets: 0,
    crownMoldingLinFt: 0,
    notes: 'Standard closet 2ft deep, 6ft wide',
  },
  closetWalkIn: {
    label: 'Walk-In Closet',
    widthFt: 7, lengthFt: 10, ceilingHeightFt: 8,
    floorSqFt: 70,
    grossWallSqFt: 272,
    netPaintableWallSqFt: 192,  // minus shelving, organizers
    ceilingSqFt: 70,
    trimLinearFt: 0,
    doors: 1, windows: 0, closets: 0,
    crownMoldingLinFt: 0,
    notes: 'Walk-in closet: 30-100 sqft',
  },

  // ---- Bonus / Family Room ----
  bonusRoom: {
    label: 'Bonus / Family Room',
    widthFt: 14, lengthFt: 18, ceilingHeightFt: 8,
    floorSqFt: 252,
    grossWallSqFt: 512,
    netPaintableWallSqFt: 440,
    ceilingSqFt: 252,
    trimLinearFt: 56,
    doors: 1, windows: 2, closets: 0,
    crownMoldingLinFt: 64,
    notes: 'Media room, playroom, etc. 200-350 sqft',
  },

  // ---- Garage ----
  garage1Car: {
    label: 'Garage (1-Car)',
    widthFt: 12, lengthFt: 22, ceilingHeightFt: 9,
    floorSqFt: 264,
    grossWallSqFt: 612,
    netPaintableWallSqFt: 460,  // minus garage door opening
    ceilingSqFt: 264,
    trimLinearFt: 0,
    doors: 1, windows: 0, closets: 0,
    crownMoldingLinFt: 0,
    notes: '1-car garage, entry door only. No trim typically',
  },
  garage2Car: {
    label: 'Garage (2-Car)',
    widthFt: 20, lengthFt: 22, ceilingHeightFt: 9,
    floorSqFt: 440,
    grossWallSqFt: 756,
    netPaintableWallSqFt: 540,  // minus large garage door opening
    ceilingSqFt: 440,
    trimLinearFt: 0,
    doors: 1, windows: 0, closets: 0,
    crownMoldingLinFt: 0,
    notes: '2-car garage. Typical epoxy floor: 400-500 sqft',
  },
  garage3Car: {
    label: 'Garage (3-Car)',
    widthFt: 30, lengthFt: 22, ceilingHeightFt: 10,
    floorSqFt: 660,
    grossWallSqFt: 1040,
    netPaintableWallSqFt: 720,
    ceilingSqFt: 660,
    trimLinearFt: 0,
    doors: 1, windows: 1, closets: 0,
    crownMoldingLinFt: 0,
    notes: '3-car garage. Typical epoxy floor: 600-700 sqft',
  },

  // ---- Stairway ----
  stairway: {
    label: 'Stairway (One Flight)',
    widthFt: 3.5, lengthFt: 12, ceilingHeightFt: 16,
    floorSqFt: 42,
    grossWallSqFt: 496,         // tall walls on both sides
    netPaintableWallSqFt: 420,
    ceilingSqFt: 42,
    trimLinearFt: 24,
    doors: 0, windows: 1, closets: 0,
    crownMoldingLinFt: 0,
    notes: 'Standard flight: 13 risers, 7.5" rise, ~36" wide. Walls are tall and angular',
  },
} as const;


// -----------------------------------------------------------------
// 5. STANDARD CEILING HEIGHTS
// -----------------------------------------------------------------

export const CEILING_HEIGHT_STANDARDS = {
  standard:     { feet: 8,  multiplier: 1.00, label: 'Standard (8 ft)' },
  nineFoot:     { feet: 9,  multiplier: 1.12, label: '9 ft Ceilings' },
  tenFoot:      { feet: 10, multiplier: 1.25, label: '10 ft Ceilings' },
  twelveFoot:   { feet: 12, multiplier: 1.50, label: '12 ft Ceilings' },
  vaulted:      { feet: 14, multiplier: 1.75, label: 'Vaulted / Cathedral' },
  twoStoryOpen: { feet: 18, multiplier: 2.25, label: 'Two-Story Open' },
} as const;


// -----------------------------------------------------------------
// 6. MATERIAL COST ALLOWANCES (paint + materials per sqft)
// -----------------------------------------------------------------

export const MATERIAL_COSTS = {
  interiorPaintPerSqFt: {
    economyLatex:  { low: 0.15, mid: 0.25, high: 0.35 },
    standardLatex: { low: 0.25, mid: 0.40, high: 0.55 },
    premiumLatex:  { low: 0.40, mid: 0.60, high: 0.85 },
    cabinetEnamel: { low: 0.60, mid: 0.90, high: 1.40 },
  },
  exteriorPaintPerSqFt: {
    standardAcrylic: { low: 0.20, mid: 0.35, high: 0.50 },
    premiumAcrylic:  { low: 0.35, mid: 0.55, high: 0.80 },
    elastomeric:     { low: 0.50, mid: 0.80, high: 1.20 },
    stain:           { low: 0.20, mid: 0.35, high: 0.55 },
  },
  primer: {
    latexPrimer:   { low: 0.10, mid: 0.18, high: 0.30 },
    shellacPrimer: { low: 0.20, mid: 0.35, high: 0.50 },
    oilPrimer:     { low: 0.15, mid: 0.28, high: 0.40 },
    bondingPrimer: { low: 0.20, mid: 0.35, high: 0.55 },
  },
  supplies: {
    tapeMaskingPerRoom:  { low: 3, mid: 8, high: 15 },
    dropClothsPerRoom:   { low: 5, mid: 10, high: 20 },
    caulkTubeEach:       { low: 3, mid: 6, high: 12 },
    sandpaperPerProject: { low: 10, mid: 25, high: 50 },
  },
  coverage: {
    gallonCovers350to400sqft: true,
    twoCoatsStandard: true,
    texturedSurfaces50percentMore: true,
    overageFactor: 1.10,  // 10% waste/overage
  },
} as const;


// -----------------------------------------------------------------
// 7. LABOR RATE RANGES BY MARKET TIER
// -----------------------------------------------------------------

export const HOURLY_LABOR_RATES = {
  rural:       { low: 25, mid: 35, high: 45 },
  suburban:    { low: 35, mid: 50, high: 65 },
  urban:       { low: 50, mid: 70, high: 90 },
  highCostMetro: { low: 65, mid: 85, high: 120 },
} as const;


// -----------------------------------------------------------------
// 8. PAINT COVERAGE FACTORS BY SURFACE TYPE
// -----------------------------------------------------------------
// Multiplier on standard coverage (350-400 sqft/gallon).
// Values > 1.0 mean more paint needed per sqft.
// -----------------------------------------------------------------

export const PAINT_USAGE_MULTIPLIERS = {
  smoothDrywall:     1.00,
  lightTexture:      1.10,
  heavyTexture:      1.20,
  orangePeel:        1.15,
  knockdown:         1.20,
  stuccoExterior:    1.50,
  brickExterior:     1.40,
  woodSidingExterior:1.10,
  hardieBoard:       1.05,
  vinylSiding:       1.00,
  concrete:          1.30,
  metalSurface:      0.90,
  cabinetSurface:    0.80,  // less area, more coats
} as const;


// -----------------------------------------------------------------
// 9. TYPICAL PROJECT CONFIGURATIONS
// -----------------------------------------------------------------
// Quick-reference for common project types.
// -----------------------------------------------------------------

export const TYPICAL_PROJECTS = {
  interiorWholeHouse1500sqft: {
    label: 'Interior - Whole House (1,500 sqft / 3BR/2BA)',
    estimatedWallSqFt: 3200,
    estimatedCeilingSqFt: 1200,
    estimatedTrimLinFt: 400,
    estimatedDoors: 12,
    estimatedWindows: 10,
    typicalPriceRange: { low: 4500, mid: 7000, high: 10000 },
  },
  interiorWholeHouse2500sqft: {
    label: 'Interior - Whole House (2,500 sqft / 4BR/3BA)',
    estimatedWallSqFt: 5000,
    estimatedCeilingSqFt: 2000,
    estimatedTrimLinFt: 600,
    estimatedDoors: 16,
    estimatedWindows: 15,
    typicalPriceRange: { low: 7500, mid: 11000, high: 16000 },
  },
  interiorWholeHouse3500sqft: {
    label: 'Interior - Whole House (3,500 sqft / 5BR/3BA)',
    estimatedWallSqFt: 7000,
    estimatedCeilingSqFt: 2800,
    estimatedTrimLinFt: 800,
    estimatedDoors: 20,
    estimatedWindows: 20,
    typicalPriceRange: { low: 10000, mid: 15000, high: 22000 },
  },
  exteriorWholeHouse1500sqft: {
    label: 'Exterior - Whole House (1,500 sqft / 1-Story)',
    estimatedSidingSqFt: 1800,
    estimatedTrimLinFt: 200,
    estimatedSoffitSqFt: 150,
    typicalPriceRange: { low: 3000, mid: 5000, high: 8000 },
  },
  exteriorWholeHouse2500sqft: {
    label: 'Exterior - Whole House (2,500 sqft / 2-Story)',
    estimatedSidingSqFt: 3200,
    estimatedTrimLinFt: 280,
    estimatedSoffitSqFt: 200,
    typicalPriceRange: { low: 5000, mid: 8000, high: 13000 },
  },
  singleRoom12x12: {
    label: 'Single Room (12x12)',
    estimatedWallSqFt: 336,
    estimatedCeilingSqFt: 144,
    estimatedTrimLinFt: 44,
    typicalPriceRange: { low: 400, mid: 750, high: 1200 },
  },
  kitchenCabinetsOnly: {
    label: 'Kitchen Cabinets Only (Average Kitchen)',
    estimatedSqFtPaintable: 200,
    typicalPriceRange: { low: 2800, mid: 4200, high: 6500 },
  },
} as const;


// -----------------------------------------------------------------
// 10. INDUSTRY STANDARD ASSUMPTIONS
// -----------------------------------------------------------------

export const INDUSTRY_ASSUMPTIONS = {
  // Standard deductions from gross wall area
  standardDoorOpening: 21,     // sqft deducted per door from wall area
  standardWindowOpening: 15,   // sqft deducted per window from wall area
  standardClosetOpening: 13,   // sqft deducted per closet door opening
  archway: 18,                 // sqft deducted per archway

  // Standard coverage
  gallonCoversSqFt: { low: 350, high: 400 },
  standardCoats: 2,
  primerCoats: 1,
  cabinetCoats: 3,             // primer + 2 coats for durability

  // Labor efficiency
  sqFtPerManHourWalls: 150,    // rolling/brushing smooth walls
  sqFtPerManHourCeilings: 120,
  sqFtPerManHourTrim: 40,      // cutting in is slower
  doorsPerManHour: 2,
  windowsPerManHour: 3,
  cabinetsPerManHour: 0.5,     // very slow, detailed work
  sprayEfficiencyMultiplier: 2.5, // spraying is ~2.5x faster than brush/roll

  // Typical paint waste/overage factor
  overageFactor: 0.10,         // 10% additional

  // Labor as percentage of total job cost
  laborPercentOfTotal: { low: 0.70, high: 0.85 },

  // Margins
  materialMarkup: 0.20,       // 20% markup on materials
  overheadAndProfit: 0.35,    // 35% O&P built into rates
} as const;
