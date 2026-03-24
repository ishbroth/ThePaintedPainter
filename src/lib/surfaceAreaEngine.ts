// ===== Surface Area Calculation Engine =====
// Calculates actual paintable surface area from room dimensions and components.
// All measurements in feet/sqft unless noted.

// ===== Standard Room Dimensions =====

export interface RoomSpec {
  label: string;
  widthFt: number;
  lengthFt: number;
  wallSqFt: number;      // total wall area (minus windows/doors)
  ceilingSqFt: number;
  trimLinearFt: number;   // baseboard linear feet
  doors: number;          // typical door count
  windows: number;        // typical window count
  closets: number;
}

// Standard room sizes based on industry averages
export const STANDARD_ROOMS: Record<string, RoomSpec> = {
  master_bedroom: {
    label: 'Master Bedroom',
    widthFt: 14, lengthFt: 16,
    wallSqFt: 432,   // (14+16)*2*8 = 480 minus ~48 for door/window/closet openings
    ceilingSqFt: 224,
    trimLinearFt: 56, // perimeter minus door/closet openings ~4ft
    doors: 1, windows: 2, closets: 1,
  },
  bedroom_2: {
    label: 'Bedroom',
    widthFt: 12, lengthFt: 12,
    wallSqFt: 336,   // 384 minus ~48
    ceilingSqFt: 144,
    trimLinearFt: 44,
    doors: 1, windows: 1, closets: 1,
  },
  bedroom_3: {
    label: 'Bedroom (Small)',
    widthFt: 10, lengthFt: 10,
    wallSqFt: 272,   // 320 minus ~48
    ceilingSqFt: 100,
    trimLinearFt: 36,
    doors: 1, windows: 1, closets: 1,
  },
  bedroom_4: {
    label: 'Bedroom (Small)',
    widthFt: 10, lengthFt: 10,
    wallSqFt: 272,
    ceilingSqFt: 100,
    trimLinearFt: 36,
    doors: 1, windows: 1, closets: 1,
  },
  living_room: {
    label: 'Living Room',
    widthFt: 16, lengthFt: 20,
    wallSqFt: 504,   // 576 minus ~72 for larger openings
    ceilingSqFt: 320,
    trimLinearFt: 64,
    doors: 1, windows: 3, closets: 0,
  },
  dining_room: {
    label: 'Dining Room',
    widthFt: 12, lengthFt: 14,
    wallSqFt: 368,   // 416 minus ~48
    ceilingSqFt: 168,
    trimLinearFt: 48,
    doors: 1, windows: 1, closets: 0,
  },
  kitchen: {
    label: 'Kitchen',
    widthFt: 12, lengthFt: 14,
    wallSqFt: 240,   // 416 minus ~176 for cabinets, backsplash, appliance areas
    ceilingSqFt: 168,
    trimLinearFt: 30, // less trim due to cabinets
    doors: 1, windows: 1, closets: 0,
  },
  bathroom_master: {
    label: 'Master Bath',
    widthFt: 10, lengthFt: 12,
    wallSqFt: 260,   // 352 minus ~92 for shower/tub, vanity, mirror
    ceilingSqFt: 120,
    trimLinearFt: 36,
    doors: 1, windows: 1, closets: 0,
  },
  bathroom_2: {
    label: 'Bathroom',
    widthFt: 8, lengthFt: 10,
    wallSqFt: 200,   // 288 minus ~88
    ceilingSqFt: 80,
    trimLinearFt: 30,
    doors: 1, windows: 1, closets: 0,
  },
  bathroom_3: {
    label: 'Half Bath',
    widthFt: 5, lengthFt: 8,
    wallSqFt: 160,   // 208 minus ~48
    ceilingSqFt: 40,
    trimLinearFt: 22,
    doors: 1, windows: 0, closets: 0,
  },
  office: {
    label: 'Office/Den',
    widthFt: 10, lengthFt: 12,
    wallSqFt: 304,   // 352 minus ~48
    ceilingSqFt: 120,
    trimLinearFt: 40,
    doors: 1, windows: 1, closets: 1,
  },
  laundry: {
    label: 'Laundry Room',
    widthFt: 6, lengthFt: 8,
    wallSqFt: 160,   // 224 minus ~64 for appliance area
    ceilingSqFt: 48,
    trimLinearFt: 24,
    doors: 1, windows: 0, closets: 0,
  },
  hallway: {
    label: 'Hallway',
    widthFt: 4, lengthFt: 15,
    wallSqFt: 240,   // long narrow, lots of wall
    ceilingSqFt: 60,
    trimLinearFt: 30,
    doors: 0, windows: 0, closets: 0,
  },
  entryway: {
    label: 'Entryway/Foyer',
    widthFt: 8, lengthFt: 8,
    wallSqFt: 200,   // 256 minus ~56 for front door, openings
    ceilingSqFt: 64,
    trimLinearFt: 28,
    doors: 1, windows: 1, closets: 1,
  },
  garage: {
    label: 'Garage (2-car)',
    widthFt: 20, lengthFt: 22,
    wallSqFt: 560,   // 672 minus ~112 for garage door opening
    ceilingSqFt: 440,
    trimLinearFt: 0,  // typically no trim
    doors: 1, windows: 0, closets: 0,
  },
  bonus_room: {
    label: 'Bonus/Family Room',
    widthFt: 14, lengthFt: 18,
    wallSqFt: 448,   // 512 minus ~64
    ceilingSqFt: 252,
    trimLinearFt: 58,
    doors: 1, windows: 2, closets: 0,
  },
};

// ===== Surface Area for Specific Items =====

export const ITEM_SURFACE_AREAS = {
  // Doors (both sides = full area, but typically paint one side + edges)
  door: {
    standard: { sqft: 21, description: 'Standard interior door (3x7, one side + edges)' },
    french: { sqft: 28, description: 'French door (glass panes add detail work)' },
    closet_single: { sqft: 14, description: 'Single closet door' },
    closet_bifold: { sqft: 24, description: 'Bifold closet door pair' },
    closet_sliding: { sqft: 28, description: 'Sliding closet doors (pair)' },
    pocket: { sqft: 18, description: 'Pocket door' },
    entry_exterior: { sqft: 28, description: 'Exterior entry door (both sides)' },
    garage_single: { sqft: 128, description: 'Single garage door' },
    garage_double: { sqft: 192, description: 'Double garage door' },
  },

  // Door frame/casing: ~16 linear ft per standard door opening, 3.5" wide = ~4.7 sqft
  doorFrame: { sqft: 4.7, linearFt: 16, description: 'Door frame/casing per opening' },

  // Windows
  window: {
    single: { sqft: 3.5, description: 'Single window frame/sill/casing' },
    double_hung: { sqft: 5, description: 'Double-hung window frame/sill' },
    french_pane: { sqft: 8, description: 'French pane window (multi-pane detail)' },
    bay: { sqft: 12, description: 'Bay window frame/sill/seat' },
    exterior_trim: { sqft: 4, description: 'Exterior window trim surround' },
  },

  // Trim profiles — priced per linear foot, convert to sqft for surface area
  trim: {
    baseboard_3in: { sqftPerLinFt: 0.25, description: '3" baseboard' },
    baseboard_5in: { sqftPerLinFt: 0.42, description: '5.25" baseboard' },
    baseboard_7in: { sqftPerLinFt: 0.58, description: '7" baseboard' },
    crown_molding: { sqftPerLinFt: 0.38, description: 'Crown molding (~4.5")' },
    chair_rail: { sqftPerLinFt: 0.25, description: 'Chair rail (~3")' },
    wainscoting_per_sqft: { sqftPerLinFt: 1.0, description: 'Wainscoting (per sqft of panel)' },
  },

  // Cabinets — total paintable surface area per typical set
  cabinets: {
    kitchen_small: { sqft: 120, description: 'Small kitchen (10-15 doors/drawer fronts)' },
    kitchen_medium: { sqft: 200, description: 'Medium kitchen (15-25 doors/drawer fronts)' },
    kitchen_large: { sqft: 320, description: 'Large kitchen (25-40+ doors/drawer fronts)' },
    bathroom: { sqft: 30, description: 'Bathroom vanity' },
    laundry: { sqft: 40, description: 'Laundry room cabinets' },
  },

  // Closets — interior walls
  closet: {
    standard: { sqft: 80, description: 'Standard reach-in closet (walls + ceiling + shelf)' },
    walkin: { sqft: 200, description: 'Walk-in closet' },
  },

  // Stairways
  stairway: {
    walls_only: { sqft: 180, description: 'Stairway walls (one flight, ~13 steps)' },
    walls_and_railings: { sqft: 220, description: 'Stairway walls + railing/handrail' },
    full: { sqft: 300, description: 'Stairway walls + railings + risers + stringers' },
    railing_per_ft: { sqft: 1.5, description: 'Stair railing per linear foot' },
    spindle_each: { sqft: 1.2, description: 'Per spindle/baluster' },
  },

  // Specialty items
  specialty: {
    fireplace_brick: { sqft: 80, description: 'Brick fireplace surround (standard)' },
    fireplace_stone: { sqft: 80, description: 'Stone fireplace surround' },
    fireplace_mantel: { sqft: 12, description: 'Fireplace mantel shelf + supports' },
    fireplace_full: { sqft: 120, description: 'Full fireplace (surround + mantel + hearth)' },
    exposed_beam: { sqft: 8, description: 'Exposed beam per linear foot (3-sided, 6x8)' },
    builtin_bookcase: { sqft: 60, description: 'Built-in bookcase (6ft wide x 8ft tall)' },
    builtin_shelving: { sqft: 40, description: 'Built-in shelving unit' },
    whitewash_brick_wall: { sqft: 1, description: 'Whitewashing per sqft of brick' },
    epoxy_floor: { sqft: 1, description: 'Epoxy garage floor per sqft' },
    furniture_dresser: { sqft: 35, description: 'Dresser (all surfaces)' },
    furniture_table: { sqft: 25, description: 'Dining table' },
    furniture_chair: { sqft: 12, description: 'Chair' },
    furniture_bookcase: { sqft: 40, description: 'Freestanding bookcase' },
    furniture_nightstand: { sqft: 12, description: 'Nightstand' },
    furniture_desk: { sqft: 30, description: 'Desk' },
    accent_wall: { sqft: 1, description: 'Accent wall per sqft (special color/technique)' },
    shutter_interior: { sqft: 8, description: 'Interior plantation shutter (per panel)' },
    shutter_exterior: { sqft: 10, description: 'Exterior shutter (per shutter)' },
  },

  // Exterior items
  exterior: {
    siding_per_sqft: { sqft: 1, description: 'Exterior siding per sqft' },
    fascia_per_linft: { sqft: 0.67, description: 'Fascia board per linear foot (8" board)' },
    soffit_per_sqft: { sqft: 1, description: 'Soffit per sqft' },
    gutter_per_linft: { sqft: 0.33, description: 'Gutter per linear foot (4" face)' },
    railing_simple: { sqft: 2, description: 'Simple exterior railing per linear foot' },
    railing_spindles: { sqft: 4, description: 'Spindle railing per linear foot' },
    deck_per_sqft: { sqft: 1, description: 'Deck surface per sqft (stain/seal)' },
    fence_per_sqft: { sqft: 2, description: 'Fence per linear foot (6ft tall, both sides)' },
    foundation_per_linft: { sqft: 2, description: 'Foundation wall per linear foot (exposed 2ft)' },
  },
};

// ===== Ceiling Height Multipliers =====

export const CEILING_HEIGHTS: Record<string, number> = {
  standard: 8,
  nine_foot: 9,
  ten_plus: 10,
  vaulted_mixed: 12, // average for vaulted
};

// ===== Calculate Total Surface Area for a Room =====

export interface RoomSurfaceArea {
  roomKey: string;
  label: string;
  wallSqFt: number;
  ceilingSqFt: number;
  trimSqFt: number;
  doorSqFt: number;
  windowSqFt: number;
  totalPaintableSqFt: number;
}

export function calculateRoomSurface(
  roomKey: string,
  ceilingHeight: number = 8,
  trimProfile: 'baseboard_3in' | 'baseboard_5in' | 'baseboard_7in' = 'baseboard_3in'
): RoomSurfaceArea {
  const room = STANDARD_ROOMS[roomKey];
  if (!room) {
    return {
      roomKey, label: roomKey, wallSqFt: 0, ceilingSqFt: 0,
      trimSqFt: 0, doorSqFt: 0, windowSqFt: 0, totalPaintableSqFt: 0,
    };
  }

  // Scale wall area for non-standard ceiling heights
  const heightRatio = ceilingHeight / 8;
  const wallSqFt = Math.round(room.wallSqFt * heightRatio);
  const ceilingSqFt = room.ceilingSqFt; // ceiling area doesn't change with height

  // Trim surface area
  const trimSqFtPerLf = ITEM_SURFACE_AREAS.trim[trimProfile]?.sqftPerLinFt || 0.25;
  const trimSqFt = Math.round(room.trimLinearFt * trimSqFtPerLf);

  // Door surface area
  const doorSqFt = room.doors * ITEM_SURFACE_AREAS.door.standard.sqft;

  // Window frame surface area
  const windowSqFt = room.windows * ITEM_SURFACE_AREAS.window.single.sqft;

  return {
    roomKey,
    label: room.label,
    wallSqFt,
    ceilingSqFt,
    trimSqFt,
    doorSqFt,
    windowSqFt,
    totalPaintableSqFt: wallSqFt + ceilingSqFt + trimSqFt + doorSqFt + windowSqFt,
  };
}

// ===== Estimate Room Count from Square Footage =====
// Maps house sqft to a typical room layout

export interface HouseLayout {
  rooms: string[];
  totalWallSqFt: number;
  totalCeilingSqFt: number;
  totalTrimLinFt: number;
  totalDoors: number;
  totalWindows: number;
  totalClosets: number;
}

export function estimateHouseLayout(sqft: number, bedrooms?: number): HouseLayout {
  const beds = bedrooms || estimateBedroomCount(sqft);
  const rooms: string[] = [];

  // Always have these
  rooms.push('living_room', 'kitchen', 'hallway', 'entryway');

  // Bedrooms
  rooms.push('master_bedroom');
  if (beds >= 2) rooms.push('bedroom_2');
  if (beds >= 3) rooms.push('bedroom_3');
  if (beds >= 4) rooms.push('bedroom_4');
  if (beds >= 5) rooms.push('bedroom_2'); // extra bedrooms use standard size

  // Bathrooms scale with bedrooms
  rooms.push('bathroom_master');
  if (beds >= 2) rooms.push('bathroom_2');
  if (beds >= 3) rooms.push('bathroom_3');

  // Dining room for 3+ bed homes
  if (beds >= 3 || sqft >= 1800) rooms.push('dining_room');

  // Office for larger homes
  if (sqft >= 2000) rooms.push('office');

  // Bonus room for large homes
  if (sqft >= 2500) rooms.push('bonus_room');

  // Laundry
  if (sqft >= 1200) rooms.push('laundry');

  // Aggregate
  let totalWall = 0, totalCeiling = 0, totalTrim = 0, totalDoors = 0, totalWindows = 0, totalClosets = 0;
  for (const r of rooms) {
    const spec = STANDARD_ROOMS[r];
    if (spec) {
      totalWall += spec.wallSqFt;
      totalCeiling += spec.ceilingSqFt;
      totalTrim += spec.trimLinearFt;
      totalDoors += spec.doors;
      totalWindows += spec.windows;
      totalClosets += spec.closets;
    }
  }

  return {
    rooms,
    totalWallSqFt: totalWall,
    totalCeilingSqFt: totalCeiling,
    totalTrimLinFt: totalTrim,
    totalDoors: totalDoors,
    totalWindows: totalWindows,
    totalClosets: totalClosets,
  };
}

function estimateBedroomCount(sqft: number): number {
  if (sqft < 800) return 1;
  if (sqft < 1200) return 2;
  if (sqft < 2000) return 3;
  if (sqft < 3000) return 4;
  return 5;
}

// ===== Exterior Surface Area =====

export interface ExteriorSurfaceArea {
  wallSqFt: number;       // exterior wall paintable area
  trimLinFt: number;       // fascia, corner boards, etc.
  soffitSqFt: number;
  gutterLinFt: number;
  windowTrimCount: number;
  stories: number;
}

export function calculateExteriorSurface(
  sqft: number,
  stories: number = 1,
  _sidingType: string = 'stucco'
): ExteriorSurfaceArea {
  // Footprint
  const footprint = sqft / Math.max(stories, 1);
  // Assume roughly square footprint
  const side = Math.sqrt(footprint);
  const perimeter = side * 4;

  // Wall height per story
  const wallHeightPerStory = 9; // 8ft ceiling + 1ft for framing/sill
  const totalWallHeight = wallHeightPerStory * stories;

  // Gross wall area
  const grossWall = perimeter * totalWallHeight;

  // Subtract ~15% for windows and doors
  const wallSqFt = Math.round(grossWall * 0.85);

  // Siding type affects surface area slightly (textured = more paint)
  // But we handle that in pricing, not area

  return {
    wallSqFt,
    trimLinFt: Math.round(perimeter * 1.5), // fascia + corner boards
    soffitSqFt: Math.round(perimeter * 1.5), // ~1.5ft overhang
    gutterLinFt: Math.round(perimeter),
    windowTrimCount: Math.round(sqft / 150), // ~1 window per 150 sqft
    stories,
  };
}

// ===== Labor Complexity Factors =====
// Multiplier on base rate for items requiring more skill/time

export const LABOR_COMPLEXITY = {
  // Surface condition
  repaint_good: 1.0,          // clean repaint, good condition
  repaint_fair: 1.1,          // some prep needed
  repaint_poor: 1.3,          // significant prep
  new_drywall: 1.15,          // needs full prime
  new_wood_unprimed: 1.25,    // prime + paint
  stained_wood_to_paint: 1.35, // degloss + prime + paint
  previously_wallpapered: 1.2, // after removal, wall needs prep

  // Height/access
  standard_height: 1.0,       // 8-9ft
  tall_ceiling: 1.15,         // 10-12ft
  vaulted: 1.3,               // 12ft+, angles
  second_story_exterior: 1.2,
  third_story_exterior: 1.5,

  // Detail level
  simple_flat: 1.0,           // flat walls, basic
  textured_wall: 1.05,        // textured drywall
  detailed_trim: 1.15,        // intricate profiles
  multi_pane_windows: 1.3,    // french panes, lots of cutting in
  spindle_railings: 1.4,      // per-spindle detail work
  cabinet_refinish: 1.3,      // spray prep + multiple coats

  // Material-specific
  brick_paint: 1.2,           // porous, needs more paint
  brick_whitewash: 1.1,       // lime wash technique
  stucco: 1.1,                // textured, uses more paint
  wood_siding: 1.0,
  hardie_board: 0.95,         // smooth, paints easily
  vinyl: 0.9,                 // easiest
  epoxy_floor: 1.5,           // multi-step process (etch, prime, coat, topcoat)

  // Color change
  same_color: 1.0,
  different_color: 1.1,       // extra coat
  dramatic_change: 1.2,       // dark to light or vice versa, 3+ coats
};

// ===== Project Type Qualifiers =====

export type ProjectCondition = 'repaint' | 'new_construction' | 'renovation';

export interface ProjectQualifiers {
  condition: ProjectCondition;
  hasStainedWood: boolean;     // wood trim/doors currently stained
  hasNewDrywall: boolean;      // fresh drywall needing prime
  hasWallpaper: boolean;       // existing wallpaper to remove
  hasLeadPaint: boolean;       // pre-1978, potential lead
  hasMold: boolean;
  hasWoodRot: boolean;
  colorChangeLevel: 'same' | 'different' | 'dramatic';
  ceilingTexture: 'flat' | 'textured' | 'popcorn' | 'vaulted';
}
