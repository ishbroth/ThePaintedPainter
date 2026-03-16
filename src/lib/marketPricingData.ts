// ===== Market-Based Pricing Data =====
// All rates are per sqft of PAINTABLE SURFACE AREA unless noted.
// National average baseline — adjusted by regional multiplier.
// Rates target 10% below market for "guaranteed price" competitiveness.

export const BASE_RATES = {
  // ===== Interior Surfaces (per sqft of paintable surface) =====
  interior: {
    walls_repaint: 1.50,           // standard repaint, good condition
    walls_new_drywall: 1.85,       // prime + 2 coats on fresh drywall
    walls_textured: 1.60,          // textured (knockdown, orange peel)
    ceilings_flat: 1.65,           // flat ceiling, overhead premium
    ceilings_textured: 1.75,       // textured ceiling
    ceilings_vaulted: 2.20,        // vaulted, height premium
    ceilings_popcorn_paint: 1.40,  // painting over popcorn (roller)
  },

  // ===== Trim & Millwork (per linear foot) =====
  trim: {
    baseboard_simple: 1.50,        // 3" flat baseboard
    baseboard_detailed: 2.25,      // 5"+ profiled baseboard
    baseboard_tall: 3.00,          // 7"+ craftsman style
    crown_molding: 2.50,           // standard crown
    crown_detailed: 3.50,          // ornate/multi-piece crown
    chair_rail: 1.75,
    wainscoting_per_sqft: 3.50,    // per sqft of wainscoting panel
    casing_per_linft: 1.25,        // door/window casing per lin ft
  },

  // ===== Doors (per door) =====
  doors: {
    interior_standard: 125,        // one side, standard hollow-core
    interior_panel: 165,           // raised panel, more detail
    interior_french: 225,          // glass panes, cutting in
    closet_single: 85,
    closet_bifold: 135,
    closet_sliding: 150,
    pocket: 110,
    door_frame: 45,                // per opening
    entry_door: 200,               // exterior entry, both sides
    garage_single: 275,
    garage_double: 425,
  },

  // ===== Windows (per window) =====
  windows: {
    frame_sill_simple: 55,         // standard single window
    frame_sill_double_hung: 75,
    french_pane: 135,              // multi-pane, lots of cutting
    bay_window: 185,
    exterior_trim: 65,             // exterior window surround
  },

  // ===== Cabinets (per set/unit) =====
  cabinets: {
    kitchen_small: 1800,           // 10-15 door/drawer fronts
    kitchen_medium: 2800,          // 15-25 door/drawer fronts
    kitchen_large: 4200,           // 25-40+ door/drawer fronts
    bathroom_vanity: 450,
    laundry: 600,
    // Per sqft rate for custom sizing
    per_sqft: 12.50,               // cabinet face per sqft
  },

  // ===== Closets (per closet) =====
  closets: {
    standard: 250,                 // walls + ceiling + shelf
    walkin_small: 400,
    walkin_large: 600,
  },

  // ===== Stairways =====
  stairs: {
    walls_one_flight: 350,         // walls along one flight
    risers_per_step: 25,           // painting stair risers
    stringers_per_flight: 150,     // stringer boards
    railing_simple_per_ft: 8,      // simple handrail
    railing_spindles_per_ft: 18,   // spindle railing per lin ft
    spindle_each: 6,               // individual spindle/baluster
    newel_post: 45,                // per newel post
  },

  // ===== Specialty Items =====
  specialty: {
    // Fireplaces
    fireplace_brick_paint: 650,    // paint brick surround
    fireplace_brick_whitewash: 550, // limewash/whitewash brick
    fireplace_stone: 750,          // paint stone surround
    fireplace_mantel: 125,         // mantel shelf + supports
    fireplace_full: 900,           // surround + mantel + hearth

    // Beams & Structural
    beam_per_linft: 12,            // exposed beam per linear foot
    beam_per_linft_vaulted: 18,    // beam at height (scaffold/lift)

    // Built-ins
    bookcase_small: 350,           // 3-4ft wide
    bookcase_large: 600,           // 6ft+ wide, floor to ceiling
    shelving_unit: 275,            // built-in shelf unit
    entertainment_center: 500,

    // Brick & Masonry
    whitewash_brick_per_sqft: 4.50, // German smear / limewash
    paint_brick_per_sqft: 3.75,
    paint_stone_per_sqft: 4.25,

    // Floors
    epoxy_garage_per_sqft: 6.50,   // full system (etch + prime + coat + flake + topcoat)
    epoxy_garage_basic_per_sqft: 4.50, // basic solid color
    stain_concrete_per_sqft: 3.50,

    // Furniture
    furniture_dresser: 275,
    furniture_table_dining: 225,
    furniture_table_end: 95,
    furniture_chair: 125,
    furniture_bookcase: 250,
    furniture_nightstand: 95,
    furniture_desk: 225,
    furniture_cabinet: 175,
    furniture_per_sqft: 7.50,      // custom sizing

    // Shutters
    shutter_interior: 75,          // per panel
    shutter_exterior: 85,          // per shutter

    // Accent work
    accent_wall_per_sqft: 2.25,    // special color/faux finish
    accent_wall_geometric: 3.50,   // tape patterns, geometric
    accent_wall_ombre: 4.00,       // gradient/ombre effect
  },

  // ===== Exterior Surfaces =====
  exterior: {
    // Siding by type (per sqft of wall)
    siding_stucco: 2.40,
    siding_wood: 2.20,
    siding_hardie: 2.10,
    siding_vinyl: 1.80,            // rarely painted, but possible
    siding_brick: 3.25,            // paint on brick
    siding_stone: 3.50,
    siding_aluminum: 2.00,

    // Trim & Details
    fascia_per_linft: 3.50,
    soffit_per_sqft: 2.25,
    gutter_per_linft: 2.50,
    corner_board_per_linft: 2.75,

    // Railings
    railing_simple_per_linft: 10,
    railing_spindle_per_linft: 22,
    railing_cable_per_linft: 8,

    // Decks & Fences
    deck_stain_per_sqft: 3.50,
    deck_paint_per_sqft: 4.00,
    fence_per_linft_6ft: 8.50,     // 6ft privacy fence, both sides
    fence_per_linft_4ft: 6.00,     // 4ft picket fence, both sides
    fence_per_linft_chain: 0,      // can't paint chain link

    // Other
    foundation_per_linft: 5.50,    // exposed foundation, 2ft band
    window_trim_each: 65,
    overhang_per_sqft: 2.50,       // patio cover / overhang
  },

  // ===== Prep Work =====
  prep: {
    prime_new_drywall_per_sqft: 0.55,
    prime_stained_wood_per_sqft: 0.85,    // degloss + prime
    prime_bare_wood_per_sqft: 0.65,
    wallpaper_removal_per_sqft: 2.25,     // remove + prep wall
    popcorn_removal_per_sqft: 2.50,       // scrape + skim + prime
    texture_repair_per_sqft: 1.75,
    drywall_patch_small: 65,              // per patch, < 6"
    drywall_patch_medium: 125,            // per patch, 6"-24"
    drywall_patch_large: 275,             // per patch, 24"+
    caulking_per_linft: 1.25,
    wood_rot_repair_minor: 150,           // per area, small patches
    wood_rot_repair_moderate: 400,        // per area
    wood_rot_repair_major: 800,           // per area, structural
    power_washing: 0.25,                  // per sqft of surface
    power_washing_minimum: 250,           // minimum charge
    sanding_degloss_per_sqft: 0.75,
    lead_paint_test: 150,
    lead_encapsulation_per_sqft: 3.50,
    mold_treatment_per_sqft: 4.00,
  },

  // ===== Material Costs (included in rates above, but useful for transparency) =====
  materials: {
    paint_per_gallon_standard: 45,        // ~400 sqft coverage per gallon
    paint_per_gallon_premium: 65,
    primer_per_gallon: 35,
    stain_per_gallon: 50,
    epoxy_per_gallon: 75,
    caulk_per_tube: 6,
    painters_tape_per_roll: 7,
  },
};

// ===== Regional Cost Multipliers =====
// Indexed by 3-digit ZIP prefix. 1.0 = national average.
// Our "guaranteed price" applies an additional 0.90 factor on top of this.

export const REGIONAL_MULTIPLIERS: Record<string, { multiplier: number; market: string }> = {
  // ----- California -----
  '900': { multiplier: 1.45, market: 'Los Angeles' },
  '901': { multiplier: 1.45, market: 'Los Angeles' },
  '902': { multiplier: 1.40, market: 'Inglewood/LA' },
  '903': { multiplier: 1.40, market: 'Inglewood/LA' },
  '904': { multiplier: 1.35, market: 'Santa Monica' },
  '905': { multiplier: 1.35, market: 'Torrance' },
  '906': { multiplier: 1.35, market: 'Whittier' },
  '907': { multiplier: 1.30, market: 'Long Beach' },
  '908': { multiplier: 1.30, market: 'Long Beach' },
  '910': { multiplier: 1.35, market: 'Pasadena' },
  '911': { multiplier: 1.35, market: 'Pasadena' },
  '912': { multiplier: 1.30, market: 'Glendale' },
  '913': { multiplier: 1.25, market: 'San Fernando Valley' },
  '914': { multiplier: 1.25, market: 'Van Nuys' },
  '915': { multiplier: 1.20, market: 'Burbank' },
  '916': { multiplier: 1.15, market: 'San Bernardino' },
  '917': { multiplier: 1.10, market: 'San Bernardino' },
  '918': { multiplier: 1.15, market: 'Alhambra' },
  '919': { multiplier: 1.20, market: 'San Diego North' },
  '920': { multiplier: 1.25, market: 'San Diego' },
  '921': { multiplier: 1.25, market: 'San Diego' },
  '922': { multiplier: 1.15, market: 'Palm Springs' },
  '923': { multiplier: 1.10, market: 'San Bernardino/Riverside' },
  '924': { multiplier: 1.10, market: 'San Bernardino' },
  '925': { multiplier: 1.10, market: 'Riverside' },
  '926': { multiplier: 1.30, market: 'Santa Ana/OC' },
  '927': { multiplier: 1.35, market: 'Orange County' },
  '928': { multiplier: 1.30, market: 'Anaheim' },
  '930': { multiplier: 1.15, market: 'Oxnard/Ventura' },
  '931': { multiplier: 1.20, market: 'Santa Barbara' },
  '932': { multiplier: 1.00, market: 'Bakersfield' },
  '933': { multiplier: 1.00, market: 'Bakersfield' },
  '934': { multiplier: 1.15, market: 'Santa Barbara' },
  '935': { multiplier: 1.00, market: 'Mojave' },
  '936': { multiplier: 1.00, market: 'Fresno' },
  '937': { multiplier: 1.00, market: 'Fresno' },
  '939': { multiplier: 1.15, market: 'Salinas' },
  '940': { multiplier: 1.50, market: 'San Francisco' },
  '941': { multiplier: 1.50, market: 'San Francisco' },
  '942': { multiplier: 1.45, market: 'Sacramento' },
  '943': { multiplier: 1.40, market: 'Palo Alto' },
  '944': { multiplier: 1.40, market: 'San Mateo' },
  '945': { multiplier: 1.40, market: 'Oakland' },
  '946': { multiplier: 1.40, market: 'Oakland' },
  '947': { multiplier: 1.35, market: 'Berkeley' },
  '948': { multiplier: 1.30, market: 'Richmond' },
  '949': { multiplier: 1.35, market: 'San Rafael' },
  '950': { multiplier: 1.35, market: 'San Jose' },
  '951': { multiplier: 1.35, market: 'San Jose' },
  '952': { multiplier: 1.10, market: 'Stockton' },
  '953': { multiplier: 1.10, market: 'Stockton' },
  '954': { multiplier: 1.25, market: 'Santa Rosa' },
  '955': { multiplier: 1.00, market: 'Eureka' },
  '956': { multiplier: 1.10, market: 'Sacramento' },
  '957': { multiplier: 1.10, market: 'Sacramento' },
  '958': { multiplier: 1.10, market: 'Sacramento' },
  '959': { multiplier: 1.00, market: 'Marysville' },
  '960': { multiplier: 1.00, market: 'Redding' },
  '961': { multiplier: 1.00, market: 'Reno area' },

  // ----- New York -----
  '100': { multiplier: 1.55, market: 'New York City' },
  '101': { multiplier: 1.55, market: 'New York City' },
  '102': { multiplier: 1.55, market: 'New York City' },
  '103': { multiplier: 1.45, market: 'Staten Island' },
  '104': { multiplier: 1.50, market: 'Bronx' },
  '105': { multiplier: 1.40, market: 'Westchester' },
  '106': { multiplier: 1.40, market: 'White Plains' },
  '107': { multiplier: 1.35, market: 'Yonkers' },
  '108': { multiplier: 1.30, market: 'New Rochelle' },
  '109': { multiplier: 1.25, market: 'Suffern' },
  '110': { multiplier: 1.45, market: 'Queens' },
  '111': { multiplier: 1.50, market: 'Brooklyn' },
  '112': { multiplier: 1.50, market: 'Brooklyn' },
  '113': { multiplier: 1.45, market: 'Flushing' },
  '114': { multiplier: 1.40, market: 'Jamaica' },
  '115': { multiplier: 1.35, market: 'Floral Park' },
  '116': { multiplier: 1.35, market: 'Far Rockaway' },
  '117': { multiplier: 1.35, market: 'Long Island' },
  '118': { multiplier: 1.35, market: 'Hicksville' },
  '119': { multiplier: 1.30, market: 'Long Island' },

  // ----- New York (upstate) -----
  '120': { multiplier: 1.05, market: 'Albany' },
  '121': { multiplier: 1.05, market: 'Albany' },
  '122': { multiplier: 1.00, market: 'Albany' },
  '130': { multiplier: 0.95, market: 'Syracuse' },
  '131': { multiplier: 0.95, market: 'Syracuse' },
  '140': { multiplier: 0.90, market: 'Buffalo' },
  '141': { multiplier: 0.90, market: 'Buffalo' },
  '143': { multiplier: 0.85, market: 'Niagara Falls' },
  '144': { multiplier: 0.90, market: 'Rochester' },
  '145': { multiplier: 0.90, market: 'Rochester' },
  '146': { multiplier: 0.90, market: 'Rochester' },
  '148': { multiplier: 0.85, market: 'Elmira' },

  // ----- New Jersey -----
  '070': { multiplier: 1.35, market: 'Newark' },
  '071': { multiplier: 1.35, market: 'Newark' },
  '072': { multiplier: 1.30, market: 'Elizabeth' },
  '073': { multiplier: 1.30, market: 'Jersey City' },
  '074': { multiplier: 1.25, market: 'Paterson' },
  '075': { multiplier: 1.25, market: 'Paterson' },
  '076': { multiplier: 1.25, market: 'Hackensack' },
  '077': { multiplier: 1.25, market: 'Red Bank' },
  '078': { multiplier: 1.20, market: 'Dover' },
  '079': { multiplier: 1.15, market: 'Summit' },
  '080': { multiplier: 1.15, market: 'South Jersey' },
  '081': { multiplier: 1.10, market: 'Camden' },
  '082': { multiplier: 1.10, market: 'South Jersey' },
  '083': { multiplier: 1.10, market: 'Atlantic City' },
  '085': { multiplier: 1.15, market: 'Trenton' },
  '086': { multiplier: 1.15, market: 'Trenton' },
  '087': { multiplier: 1.20, market: 'Lakewood' },
  '088': { multiplier: 1.15, market: 'New Brunswick' },
  '089': { multiplier: 1.15, market: 'New Brunswick' },

  // ----- Massachusetts -----
  '010': { multiplier: 1.10, market: 'Springfield' },
  '011': { multiplier: 1.10, market: 'Springfield' },
  '012': { multiplier: 1.05, market: 'Pittsfield' },
  '013': { multiplier: 1.10, market: 'Greenfield' },
  '014': { multiplier: 1.15, market: 'Worcester' },
  '015': { multiplier: 1.15, market: 'Worcester' },
  '016': { multiplier: 1.15, market: 'Worcester' },
  '017': { multiplier: 1.20, market: 'Framingham' },
  '018': { multiplier: 1.25, market: 'Woburn' },
  '019': { multiplier: 1.25, market: 'Lynn' },
  '020': { multiplier: 1.35, market: 'Boston' },
  '021': { multiplier: 1.35, market: 'Boston' },
  '022': { multiplier: 1.30, market: 'Boston' },
  '023': { multiplier: 1.25, market: 'Brockton' },
  '024': { multiplier: 1.25, market: 'Lexington' },
  '025': { multiplier: 1.20, market: 'Buzzards Bay' },
  '026': { multiplier: 1.25, market: 'Cape Cod' },
  '027': { multiplier: 1.20, market: 'New Bedford' },

  // ----- Connecticut -----
  '060': { multiplier: 1.25, market: 'Hartford' },
  '061': { multiplier: 1.25, market: 'Hartford' },
  '062': { multiplier: 1.20, market: 'Willimantic' },
  '063': { multiplier: 1.25, market: 'New London' },
  '064': { multiplier: 1.20, market: 'Meriden' },
  '065': { multiplier: 1.25, market: 'New Haven' },
  '066': { multiplier: 1.30, market: 'Bridgeport' },
  '067': { multiplier: 1.25, market: 'Waterbury' },
  '068': { multiplier: 1.35, market: 'Stamford' },
  '069': { multiplier: 1.30, market: 'Danbury' },

  // ----- Pennsylvania -----
  '150': { multiplier: 1.00, market: 'Pittsburgh' },
  '151': { multiplier: 1.00, market: 'Pittsburgh' },
  '152': { multiplier: 1.00, market: 'Pittsburgh' },
  '160': { multiplier: 0.85, market: 'New Castle' },
  '161': { multiplier: 0.85, market: 'New Castle' },
  '170': { multiplier: 0.95, market: 'Harrisburg' },
  '171': { multiplier: 0.95, market: 'Harrisburg' },
  '175': { multiplier: 0.95, market: 'Lancaster' },
  '176': { multiplier: 0.90, market: 'Lancaster' },
  '180': { multiplier: 1.00, market: 'Lehigh Valley' },
  '181': { multiplier: 1.00, market: 'Allentown' },
  '185': { multiplier: 0.90, market: 'Scranton' },
  '186': { multiplier: 0.90, market: 'Scranton' },
  '190': { multiplier: 1.20, market: 'Philadelphia' },
  '191': { multiplier: 1.20, market: 'Philadelphia' },

  // ----- Washington DC / Virginia / Maryland -----
  '200': { multiplier: 1.35, market: 'Washington DC' },
  '201': { multiplier: 1.35, market: 'Washington DC' },
  '202': { multiplier: 1.35, market: 'Washington DC' },
  '203': { multiplier: 1.30, market: 'DC Southeast' },
  '204': { multiplier: 1.30, market: 'DC Northwest' },
  '205': { multiplier: 1.30, market: 'DC' },
  '206': { multiplier: 1.30, market: 'Southern MD' },
  '207': { multiplier: 1.25, market: 'Southern MD' },
  '208': { multiplier: 1.30, market: 'Suburban MD' },
  '209': { multiplier: 1.25, market: 'Silver Spring' },
  '210': { multiplier: 1.20, market: 'Baltimore' },
  '211': { multiplier: 1.20, market: 'Baltimore' },
  '212': { multiplier: 1.20, market: 'Baltimore' },
  '220': { multiplier: 1.30, market: 'Northern Virginia' },
  '221': { multiplier: 1.30, market: 'Arlington' },
  '222': { multiplier: 1.30, market: 'Arlington' },
  '223': { multiplier: 1.25, market: 'Alexandria' },
  '225': { multiplier: 1.10, market: 'Fredericksburg' },
  '226': { multiplier: 1.15, market: 'Winchester' },
  '230': { multiplier: 1.05, market: 'Richmond' },
  '231': { multiplier: 1.05, market: 'Richmond' },
  '232': { multiplier: 1.05, market: 'Richmond' },
  '233': { multiplier: 1.00, market: 'Norfolk' },
  '234': { multiplier: 1.00, market: 'Virginia Beach' },
  '236': { multiplier: 1.00, market: 'Newport News' },
  '240': { multiplier: 0.90, market: 'Roanoke' },

  // ----- Florida -----
  '320': { multiplier: 1.00, market: 'Jacksonville' },
  '321': { multiplier: 0.95, market: 'Daytona Beach' },
  '322': { multiplier: 0.95, market: 'Gainesville' },
  '323': { multiplier: 0.95, market: 'Tallahassee' },
  '324': { multiplier: 0.90, market: 'Panama City' },
  '325': { multiplier: 0.90, market: 'Pensacola' },
  '326': { multiplier: 0.95, market: 'Gainesville' },
  '327': { multiplier: 1.00, market: 'Orlando' },
  '328': { multiplier: 1.00, market: 'Orlando' },
  '329': { multiplier: 1.00, market: 'Melbourne' },
  '330': { multiplier: 1.20, market: 'Miami' },
  '331': { multiplier: 1.20, market: 'Miami' },
  '332': { multiplier: 1.20, market: 'Miami' },
  '333': { multiplier: 1.20, market: 'Fort Lauderdale' },
  '334': { multiplier: 1.15, market: 'West Palm Beach' },
  '335': { multiplier: 1.05, market: 'Tampa' },
  '336': { multiplier: 1.05, market: 'Tampa' },
  '337': { multiplier: 1.05, market: 'St Petersburg' },
  '338': { multiplier: 1.00, market: 'Lakeland' },
  '339': { multiplier: 1.10, market: 'Fort Myers' },
  '340': { multiplier: 1.15, market: 'Palm Beach' },
  '341': { multiplier: 1.15, market: 'Naples' },
  '342': { multiplier: 1.00, market: 'Manasota' },
  '344': { multiplier: 1.05, market: 'Sarasota' },
  '346': { multiplier: 1.05, market: 'Tampa' },
  '347': { multiplier: 1.00, market: 'Orlando area' },

  // ----- Texas -----
  '750': { multiplier: 1.00, market: 'Dallas' },
  '751': { multiplier: 1.00, market: 'Dallas' },
  '752': { multiplier: 1.00, market: 'Dallas' },
  '753': { multiplier: 0.95, market: 'Dallas suburbs' },
  '754': { multiplier: 0.90, market: 'Greenville' },
  '755': { multiplier: 0.85, market: 'Texarkana' },
  '756': { multiplier: 0.85, market: 'Longview' },
  '757': { multiplier: 0.85, market: 'Tyler' },
  '760': { multiplier: 0.95, market: 'Fort Worth' },
  '761': { multiplier: 0.95, market: 'Fort Worth' },
  '762': { multiplier: 0.95, market: 'Denton' },
  '763': { multiplier: 0.90, market: 'Wichita Falls' },
  '764': { multiplier: 0.85, market: 'Abilene' },
  '765': { multiplier: 0.90, market: 'Waco' },
  '766': { multiplier: 0.90, market: 'Waco' },
  '767': { multiplier: 0.85, market: 'Waco' },
  '768': { multiplier: 0.85, market: 'Brownwood' },
  '769': { multiplier: 0.85, market: 'San Angelo' },
  '770': { multiplier: 1.05, market: 'Houston' },
  '771': { multiplier: 1.05, market: 'Houston' },
  '772': { multiplier: 1.05, market: 'Houston' },
  '773': { multiplier: 1.00, market: 'Houston suburbs' },
  '774': { multiplier: 0.95, market: 'Houston suburbs' },
  '775': { multiplier: 0.95, market: 'Galveston' },
  '776': { multiplier: 0.90, market: 'Beaumont' },
  '777': { multiplier: 0.90, market: 'Beaumont' },
  '778': { multiplier: 0.85, market: 'Bryan' },
  '779': { multiplier: 0.85, market: 'Victoria' },
  '780': { multiplier: 0.95, market: 'San Antonio' },
  '781': { multiplier: 0.95, market: 'San Antonio' },
  '782': { multiplier: 0.95, market: 'San Antonio' },
  '783': { multiplier: 0.85, market: 'Corpus Christi' },
  '784': { multiplier: 0.85, market: 'Corpus Christi' },
  '785': { multiplier: 0.80, market: 'McAllen' },
  '786': { multiplier: 1.00, market: 'Austin' },
  '787': { multiplier: 1.05, market: 'Austin' },
  '788': { multiplier: 0.85, market: 'Del Rio' },
  '789': { multiplier: 0.80, market: 'Lubbock' },
  '790': { multiplier: 0.80, market: 'Amarillo' },
  '791': { multiplier: 0.80, market: 'Amarillo' },
  '792': { multiplier: 0.80, market: 'Midland/Odessa' },
  '793': { multiplier: 0.80, market: 'Lubbock' },
  '794': { multiplier: 0.80, market: 'Lubbock' },
  '795': { multiplier: 0.80, market: 'Abilene' },
  '796': { multiplier: 0.80, market: 'Abilene' },
  '797': { multiplier: 0.85, market: 'Midland' },
  '798': { multiplier: 0.85, market: 'El Paso' },
  '799': { multiplier: 0.85, market: 'El Paso' },

  // ----- Illinois -----
  '600': { multiplier: 1.20, market: 'Chicago' },
  '601': { multiplier: 1.15, market: 'Chicago suburbs' },
  '602': { multiplier: 1.15, market: 'Evanston' },
  '603': { multiplier: 1.15, market: 'Oak Park' },
  '604': { multiplier: 1.10, market: 'Aurora' },
  '605': { multiplier: 1.10, market: 'South suburbs' },
  '606': { multiplier: 1.20, market: 'Chicago' },
  '607': { multiplier: 1.10, market: 'Chicago suburbs' },
  '608': { multiplier: 1.10, market: 'Chicago suburbs' },
  '610': { multiplier: 0.95, market: 'Rockford' },
  '611': { multiplier: 0.90, market: 'Rockford' },
  '612': { multiplier: 0.85, market: 'Rock Island' },
  '613': { multiplier: 0.85, market: 'LaSalle' },
  '614': { multiplier: 0.85, market: 'Galesburg' },
  '615': { multiplier: 0.90, market: 'Peoria' },
  '616': { multiplier: 0.90, market: 'Peoria' },
  '617': { multiplier: 0.85, market: 'Bloomington' },
  '618': { multiplier: 0.85, market: 'Champaign' },
  '619': { multiplier: 0.85, market: 'Champaign' },
  '620': { multiplier: 0.85, market: 'Springfield' },
  '622': { multiplier: 0.80, market: 'East St Louis' },
  '623': { multiplier: 0.85, market: 'Quincy' },
  '624': { multiplier: 0.80, market: 'Effingham' },
  '625': { multiplier: 0.85, market: 'Springfield' },
  '626': { multiplier: 0.85, market: 'Springfield' },
  '627': { multiplier: 0.85, market: 'Springfield' },
  '628': { multiplier: 0.80, market: 'Centralia' },
  '629': { multiplier: 0.80, market: 'Carbondale' },

  // ----- Washington State -----
  '980': { multiplier: 1.30, market: 'Seattle' },
  '981': { multiplier: 1.30, market: 'Seattle' },
  '982': { multiplier: 1.25, market: 'Everett' },
  '983': { multiplier: 1.20, market: 'Tacoma' },
  '984': { multiplier: 1.25, market: 'Tacoma' },
  '985': { multiplier: 1.20, market: 'Olympia' },
  '986': { multiplier: 1.15, market: 'Portland/Vancouver WA' },
  '988': { multiplier: 0.95, market: 'Wenatchee' },
  '989': { multiplier: 0.95, market: 'Yakima' },
  '990': { multiplier: 0.95, market: 'Spokane' },
  '991': { multiplier: 0.95, market: 'Spokane' },
  '992': { multiplier: 0.90, market: 'Spokane' },
  '993': { multiplier: 0.90, market: 'Richland' },
  '994': { multiplier: 0.90, market: 'Clarkston' },

  // ----- Oregon -----
  '970': { multiplier: 1.15, market: 'Portland' },
  '971': { multiplier: 1.15, market: 'Portland' },
  '972': { multiplier: 1.15, market: 'Portland' },
  '973': { multiplier: 1.05, market: 'Salem' },
  '974': { multiplier: 1.05, market: 'Eugene' },
  '975': { multiplier: 0.95, market: 'Medford' },
  '976': { multiplier: 0.90, market: 'Klamath Falls' },
  '977': { multiplier: 0.90, market: 'Bend' },
  '978': { multiplier: 0.90, market: 'Pendleton' },
  '979': { multiplier: 0.90, market: 'Boise area' },

  // ----- Colorado -----
  '800': { multiplier: 1.15, market: 'Denver' },
  '801': { multiplier: 1.15, market: 'Denver' },
  '802': { multiplier: 1.15, market: 'Denver' },
  '803': { multiplier: 1.10, market: 'Boulder' },
  '804': { multiplier: 1.05, market: 'Denver suburbs' },
  '805': { multiplier: 1.10, market: 'Longmont' },
  '806': { multiplier: 0.95, market: 'Colorado Springs' },
  '807': { multiplier: 0.95, market: 'Colorado Springs' },
  '808': { multiplier: 0.90, market: 'Colorado Springs' },
  '809': { multiplier: 0.90, market: 'Pueblo' },
  '810': { multiplier: 0.90, market: 'Pueblo' },
  '811': { multiplier: 1.00, market: 'Alamosa' },
  '812': { multiplier: 1.00, market: 'Salida' },
  '813': { multiplier: 1.00, market: 'Durango' },
  '814': { multiplier: 1.05, market: 'Grand Junction' },
  '815': { multiplier: 1.00, market: 'Grand Junction' },
  '816': { multiplier: 1.00, market: 'Glenwood Springs' },

  // ----- Arizona -----
  '850': { multiplier: 1.05, market: 'Phoenix' },
  '851': { multiplier: 1.05, market: 'Phoenix' },
  '852': { multiplier: 1.05, market: 'Mesa/Phoenix' },
  '853': { multiplier: 1.00, market: 'Chandler' },
  '855': { multiplier: 0.95, market: 'Globe' },
  '856': { multiplier: 1.00, market: 'Tucson' },
  '857': { multiplier: 1.00, market: 'Tucson' },
  '859': { multiplier: 0.95, market: 'Show Low' },
  '860': { multiplier: 0.95, market: 'Flagstaff' },
  '863': { multiplier: 1.00, market: 'Prescott' },
  '864': { multiplier: 0.95, market: 'Kingman' },
  '865': { multiplier: 0.95, market: 'Yuma' },

  // ----- Nevada -----
  '889': { multiplier: 1.10, market: 'Las Vegas' },
  '890': { multiplier: 1.10, market: 'Las Vegas' },
  '891': { multiplier: 1.10, market: 'Las Vegas' },
  '893': { multiplier: 0.95, market: 'Ely' },
  '894': { multiplier: 1.10, market: 'Reno' },
  '895': { multiplier: 1.10, market: 'Reno' },

  // ----- Georgia -----
  '300': { multiplier: 1.05, market: 'Atlanta' },
  '301': { multiplier: 1.05, market: 'Atlanta' },
  '302': { multiplier: 1.05, market: 'Atlanta' },
  '303': { multiplier: 1.05, market: 'Atlanta' },
  '304': { multiplier: 0.95, market: 'Statesboro' },
  '305': { multiplier: 0.90, market: 'Gainesville' },
  '306': { multiplier: 0.85, market: 'Athens' },
  '307': { multiplier: 0.85, market: 'Chattanooga area' },
  '308': { multiplier: 0.85, market: 'Augusta' },
  '309': { multiplier: 0.85, market: 'Augusta' },
  '310': { multiplier: 0.85, market: 'Macon' },
  '311': { multiplier: 0.85, market: 'Atlanta suburbs' },
  '312': { multiplier: 0.85, market: 'Macon' },
  '313': { multiplier: 0.85, market: 'Savannah' },
  '314': { multiplier: 0.85, market: 'Savannah' },
  '315': { multiplier: 0.80, market: 'Waycross' },
  '316': { multiplier: 0.80, market: 'Valdosta' },
  '317': { multiplier: 0.85, market: 'Albany' },
  '318': { multiplier: 0.85, market: 'Columbus' },
  '319': { multiplier: 0.85, market: 'Columbus' },

  // ----- North Carolina -----
  '270': { multiplier: 0.95, market: 'Greensboro' },
  '271': { multiplier: 0.95, market: 'Winston-Salem' },
  '272': { multiplier: 0.95, market: 'Greensboro' },
  '273': { multiplier: 0.95, market: 'Greensboro' },
  '274': { multiplier: 0.95, market: 'Greensboro' },
  '275': { multiplier: 1.00, market: 'Raleigh' },
  '276': { multiplier: 1.00, market: 'Raleigh' },
  '277': { multiplier: 1.00, market: 'Durham' },
  '278': { multiplier: 0.90, market: 'Rocky Mount' },
  '279': { multiplier: 0.85, market: 'Elizabeth City' },
  '280': { multiplier: 1.00, market: 'Charlotte' },
  '281': { multiplier: 1.00, market: 'Charlotte' },
  '282': { multiplier: 1.00, market: 'Charlotte' },
  '283': { multiplier: 0.90, market: 'Fayetteville' },
  '284': { multiplier: 0.85, market: 'Wilmington' },
  '285': { multiplier: 0.90, market: 'Kinston' },
  '286': { multiplier: 0.85, market: 'Hickory' },
  '287': { multiplier: 0.90, market: 'Asheville' },
  '288': { multiplier: 0.90, market: 'Asheville' },
  '289': { multiplier: 0.85, market: 'Hendersonville' },

  // ----- Tennessee -----
  '370': { multiplier: 0.90, market: 'Nashville' },
  '371': { multiplier: 0.90, market: 'Nashville' },
  '372': { multiplier: 0.90, market: 'Nashville' },
  '373': { multiplier: 0.85, market: 'Chattanooga' },
  '374': { multiplier: 0.85, market: 'Chattanooga' },
  '375': { multiplier: 0.80, market: 'Johnson City' },
  '376': { multiplier: 0.80, market: 'Johnson City' },
  '377': { multiplier: 0.85, market: 'Knoxville' },
  '378': { multiplier: 0.85, market: 'Knoxville' },
  '379': { multiplier: 0.80, market: 'Knoxville' },
  '380': { multiplier: 0.85, market: 'Memphis' },
  '381': { multiplier: 0.85, market: 'Memphis' },
  '382': { multiplier: 0.80, market: 'McKenzie' },
  '383': { multiplier: 0.80, market: 'Jackson' },
  '384': { multiplier: 0.80, market: 'Columbia' },
  '385': { multiplier: 0.80, market: 'Cookeville' },

  // ----- Ohio -----
  '430': { multiplier: 0.90, market: 'Columbus' },
  '431': { multiplier: 0.90, market: 'Columbus' },
  '432': { multiplier: 0.90, market: 'Columbus' },
  '433': { multiplier: 0.85, market: 'Marion' },
  '434': { multiplier: 0.85, market: 'Toledo' },
  '435': { multiplier: 0.85, market: 'Toledo' },
  '436': { multiplier: 0.85, market: 'Toledo' },
  '437': { multiplier: 0.85, market: 'Zanesville' },
  '438': { multiplier: 0.80, market: 'Zanesville' },
  '439': { multiplier: 0.80, market: 'Steubenville' },
  '440': { multiplier: 0.90, market: 'Cleveland' },
  '441': { multiplier: 0.90, market: 'Cleveland' },
  '442': { multiplier: 0.85, market: 'Akron' },
  '443': { multiplier: 0.85, market: 'Akron' },
  '444': { multiplier: 0.85, market: 'Youngstown' },
  '445': { multiplier: 0.85, market: 'Youngstown' },
  '446': { multiplier: 0.85, market: 'Canton' },
  '447': { multiplier: 0.80, market: 'Canton' },
  '448': { multiplier: 0.80, market: 'Mansfield' },
  '449': { multiplier: 0.80, market: 'Mansfield' },
  '450': { multiplier: 0.90, market: 'Cincinnati' },
  '451': { multiplier: 0.90, market: 'Cincinnati' },
  '452': { multiplier: 0.90, market: 'Cincinnati' },
  '453': { multiplier: 0.85, market: 'Dayton' },
  '454': { multiplier: 0.85, market: 'Dayton' },
  '455': { multiplier: 0.85, market: 'Springfield' },
  '456': { multiplier: 0.80, market: 'Chillicothe' },
  '457': { multiplier: 0.80, market: 'Athens' },
  '458': { multiplier: 0.85, market: 'Lima' },
  '459': { multiplier: 0.85, market: 'Cincinnati area' },

  // ----- Michigan -----
  '480': { multiplier: 0.95, market: 'Detroit suburbs' },
  '481': { multiplier: 0.95, market: 'Ann Arbor' },
  '482': { multiplier: 0.90, market: 'Detroit' },
  '483': { multiplier: 0.90, market: 'Detroit' },
  '484': { multiplier: 0.90, market: 'Flint' },
  '485': { multiplier: 0.85, market: 'Flint' },
  '486': { multiplier: 0.85, market: 'Saginaw' },
  '487': { multiplier: 0.80, market: 'Bay City' },
  '488': { multiplier: 0.80, market: 'Lansing' },
  '489': { multiplier: 0.80, market: 'Lansing' },
  '490': { multiplier: 0.85, market: 'Kalamazoo' },
  '491': { multiplier: 0.85, market: 'Kalamazoo' },
  '492': { multiplier: 0.80, market: 'Jackson' },
  '493': { multiplier: 0.85, market: 'Grand Rapids' },
  '494': { multiplier: 0.85, market: 'Grand Rapids' },
  '495': { multiplier: 0.80, market: 'Grand Rapids' },
  '496': { multiplier: 0.80, market: 'Traverse City' },
  '497': { multiplier: 0.75, market: 'Gaylord' },
  '498': { multiplier: 0.75, market: 'Iron Mountain' },
  '499': { multiplier: 0.75, market: 'Iron Mountain' },

  // ----- Minnesota -----
  '550': { multiplier: 1.05, market: 'Minneapolis' },
  '551': { multiplier: 1.05, market: 'St Paul' },
  '553': { multiplier: 1.00, market: 'Minneapolis suburbs' },
  '554': { multiplier: 1.00, market: 'Minneapolis suburbs' },
  '555': { multiplier: 1.00, market: 'Minneapolis suburbs' },
  '556': { multiplier: 0.85, market: 'Duluth' },
  '557': { multiplier: 0.85, market: 'Duluth' },
  '558': { multiplier: 0.80, market: 'Duluth' },
  '559': { multiplier: 0.85, market: 'Rochester' },
  '560': { multiplier: 0.80, market: 'Mankato' },
  '561': { multiplier: 0.80, market: 'Windom' },
  '562': { multiplier: 0.80, market: 'Willmar' },
  '563': { multiplier: 0.80, market: 'St Cloud' },
  '564': { multiplier: 0.80, market: 'Brainerd' },
  '565': { multiplier: 0.75, market: 'Detroit Lakes' },
  '566': { multiplier: 0.75, market: 'Bemidji' },
  '567': { multiplier: 0.75, market: 'Thief River Falls' },

  // ----- Missouri -----
  '630': { multiplier: 0.90, market: 'St Louis' },
  '631': { multiplier: 0.90, market: 'St Louis' },
  '634': { multiplier: 0.85, market: 'Quincy area' },
  '635': { multiplier: 0.80, market: 'Kirksville' },
  '636': { multiplier: 0.80, market: 'Flat River' },
  '637': { multiplier: 0.80, market: 'Cape Girardeau' },
  '638': { multiplier: 0.80, market: 'Sikeston' },
  '639': { multiplier: 0.80, market: 'Poplar Bluff' },
  '640': { multiplier: 0.90, market: 'Kansas City' },
  '641': { multiplier: 0.90, market: 'Kansas City' },
  '644': { multiplier: 0.85, market: 'St Joseph' },
  '645': { multiplier: 0.80, market: 'St Joseph' },
  '646': { multiplier: 0.80, market: 'Chillicothe' },
  '647': { multiplier: 0.80, market: 'Harrisonville' },
  '648': { multiplier: 0.85, market: 'Joplin' },
  '650': { multiplier: 0.80, market: 'Jefferson City' },
  '651': { multiplier: 0.80, market: 'Jefferson City' },
  '652': { multiplier: 0.85, market: 'Columbia' },
  '653': { multiplier: 0.80, market: 'Sedalia' },
  '654': { multiplier: 0.80, market: 'Rolla' },
  '655': { multiplier: 0.80, market: 'Springfield' },
  '656': { multiplier: 0.80, market: 'Springfield' },
  '657': { multiplier: 0.80, market: 'Springfield' },
  '658': { multiplier: 0.80, market: 'Springfield' },

  // ----- Hawaii -----
  '967': { multiplier: 1.55, market: 'Honolulu' },
  '968': { multiplier: 1.55, market: 'Honolulu' },

  // ----- Alaska -----
  '995': { multiplier: 1.40, market: 'Anchorage' },
  '996': { multiplier: 1.40, market: 'Anchorage' },
  '997': { multiplier: 1.45, market: 'Fairbanks' },
  '998': { multiplier: 1.45, market: 'Juneau' },
  '999': { multiplier: 1.50, market: 'Ketchikan' },
};

// ===== Lookup Functions =====

export function getRegionalMultiplier(zipCode: string): { multiplier: number; market: string } {
  const prefix = zipCode.substring(0, 3);
  return REGIONAL_MULTIPLIERS[prefix] || { multiplier: 1.0, market: 'National Average' };
}

// Apply guaranteed price discount (10% below market)
export function getGuaranteedRateMultiplier(zipCode: string): number {
  const { multiplier } = getRegionalMultiplier(zipCode);
  return multiplier * 0.90;
}
