// ============================================================================
// Free-text extractors
// ============================================================================
// Parse natural-language messages for facts that fill the EstimatorContext.
// Every extractor is forgiving — if it can't find the signal, it returns
// `null` and the chat engine will ask a follow-up question.
// ============================================================================

import type { EstimatorContext } from '../types';

export interface ExtractResult {
  /** Fields to merge into the context. */
  patch: Partial<EstimatorContext>;
  /** Human-readable summary of what we picked up, for the bot's acknowledgement line. */
  acknowledgements: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, dozen: 12, couple: 2, 'a couple': 2, several: 3, 'a few': 3, few: 3,
};

function parseIntLoose(s: string): number | null {
  const cleaned = s.replace(/,/g, '').trim().toLowerCase();
  if (/^\d+$/.test(cleaned)) return parseInt(cleaned, 10);
  if (NUMBER_WORDS[cleaned] !== undefined) return NUMBER_WORDS[cleaned];
  return null;
}

export function extractZip(text: string): string | null {
  const m = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

export function extractSquareFeet(text: string): number | null {
  // "1500 sqft", "2,000 sq ft", "about 1800 square feet"
  const m = text.match(/(\d{1,2}[,.]?\d{3}|\d{2,4})\s*(?:sq\s*ft|square\s*f(?:ee|oo)t|sqft|sf)\b/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[,.]/g, ''), 10);
  return isFinite(n) && n > 100 && n < 50000 ? n : null;
}

export function extractBedroomCount(text: string): number | null {
  const m = text.match(/(\d+|one|two|three|four|five|six|seven)\s*(?:-|\s)?\s*(?:bed(?:room)?s?|br)\b/i);
  if (!m) return null;
  return parseIntLoose(m[1]);
}

export function extractStories(text: string): number | null {
  if (/\b(?:single|one)[\s-]?stor(?:y|ey)\b/i.test(text)) return 1;
  if (/\b(?:two|2)[\s-]?stor(?:y|ey|ies)\b/i.test(text)) return 2;
  if (/\b(?:three|3)[\s-]?stor(?:y|ey|ies)\b/i.test(text)) return 3;
  return null;
}

export function extractProjectType(text: string): 'interior' | 'exterior' | 'both' | null {
  const t = text.toLowerCase();
  const hasIn = /\b(interior|inside|indoors?|inside the house|inside the home)\b/.test(t);
  const hasEx = /\b(exterior|outside|outdoors?|outside the house|siding|stucco)\b/.test(t);
  if (hasIn && hasEx) return 'both';
  if (/\b(both\s+(?:interior|inside)\s+and\s+(?:exterior|outside))\b/.test(t)) return 'both';
  if (hasEx) return 'exterior';
  if (hasIn) return 'interior';
  // "Rental unit", "apartment", "condo", etc. — landlords/property managers
  // repainting a single dwelling unit overwhelmingly mean the interior.
  if (extractUnitContext(text).impliesInterior) return 'interior';
  // Implicit: "paint my house" without qualifier usually means interior in DIY contexts, but don't assume.
  return null;
}

export function extractProjectCondition(
  text: string,
): 'repaint' | 'new_construction' | 'renovation' | null {
  const t = text.toLowerCase();
  if (/\b(new construction|newly built|just built|new build|new home)\b/.test(t)) return 'new_construction';
  if (/\b(renovat|remodel|just finished|we're redoing|gutted|new drywall|drywall just went up|contractor just)\b/.test(t)) return 'renovation';
  if (/\b(repaint|previously painted|re-?paint|refresh|already painted)\b/.test(t)) return 'repaint';
  return null;
}

/**
 * Strip quantified bed/bath counts ("2 bed", "1 bath", "3 bedrooms", "2.5 ba")
 * out of the text before room detection runs. Without this, a plain count
 * like "2 bed 1 bath" gets misread by the bathroom pattern below as a
 * specific single-bathroom callout, which wrongly locks the scope to "one
 * room" instead of "the whole place."  Named/qualified mentions like "master
 * bath" or "the bathroom" are untouched since they have no leading count.
 */
function stripQuantifiedBedBath(text: string): string {
  const NUM = '(?:\\d+(?:\\.\\d)?|one|two|three|four|five|six|seven|eight|nine|ten)';
  const re = new RegExp(`\\b${NUM}\\s*(?:-|\\s)?\\s*(?:bed(?:room)?s?|br|bd|bath(?:room)?s?|ba)\\b`, 'gi');
  return text.replace(re, ' ');
}

export function extractRooms(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  const map: Array<[RegExp, string]> = [
    [/\bmaster\s+bed(?:room)?\b/, 'master_bedroom'],
    [/\b(?:second|2nd|guest|kids?)\s+bed(?:room)?\b/, 'bedroom_2'],
    [/\b(?:third|3rd)\s+bed(?:room)?\b/, 'bedroom_3'],
    [/\bliving\s+(?:room|area)\b/, 'living_room'],
    [/\bfamily\s+room\b/, 'bonus_room'],
    [/\bbonus\s+room\b/, 'bonus_room'],
    [/\bdining\s+room\b/, 'dining_room'],
    [/\bkitchen\b/, 'kitchen'],
    [/\bmaster\s+bath(?:room)?\b/, 'bathroom_master'],
    [/\bhalf\s+bath(?:room)?\b|\bpowder\s+room\b/, 'bathroom_3'],
    [/\bbath(?:room)?\b/, 'bathroom_2'],
    [/\boffice\b|\bden\b|\bstudy\b/, 'office'],
    [/\blaundry\b|\bmud(?:room| room)\b/, 'laundry'],
    [/\bhall(?:way)?\b|\bcorridor\b/, 'hallway'],
    [/\bentry(?:way)?\b|\bfoyer\b/, 'entryway'],
    [/\bgarage\b/, 'garage'],
  ];
  for (const [re, key] of map) {
    if (re.test(t) && !found.includes(key)) found.push(key);
  }
  return found;
}

export function extractCabinets(text: string): { yes: boolean; locations: string[] } {
  const t = text.toLowerCase();
  const mentioned = /\bcabinet/.test(t);
  if (!mentioned) return { yes: false, locations: [] };
  const locations: string[] = [];
  if (/\bkitchen\b/.test(t)) locations.push('kitchen');
  if (/\bbath(?:room)?\s+(?:vanit|cabinet)/.test(t) || /\bvanity\b/.test(t)) locations.push('bathroom');
  if (/\blaundry\b.*\bcabinet/.test(t)) locations.push('laundry');
  if (locations.length === 0) locations.push('kitchen'); // default assumption when cabinets mentioned
  return { yes: true, locations };
}

export function extractColorChange(text: string): 'same' | 'different' | 'dramatic' | null {
  const t = text.toLowerCase();
  if (/\b(dark\s+to\s+light|light\s+to\s+dark|black\s+to\s+white|white\s+to\s+black|dramatic(?:ally)?\s+(?:change|different))\b/.test(t)) return 'dramatic';
  if (/\b(different\s+color|new\s+color|change\s+the\s+color|changing\s+color)\b/.test(t)) return 'different';
  if (/\b(same\s+color|match(?:ing)?\s+(?:the\s+)?existing)\b/.test(t)) return 'same';
  return null;
}

export function extractSidingType(
  text: string,
): 'stucco' | 'wood' | 'vinyl' | 'hardie' | 'brick' | 'stone' | 'aluminum' | null {
  const t = text.toLowerCase();
  if (/\bstucco\b/.test(t)) return 'stucco';
  if (/\bhardi(?:e)?\s*board\b|\bhardiplank\b|\bfiber\s+cement\b/.test(t)) return 'hardie';
  if (/\baluminum\s+siding\b/.test(t)) return 'aluminum';
  if (/\bconcrete\s+block\b|\bcinder\s*block\b|\bcmu\b|\bconcrete\s+masonry\b/.test(t)) return 'stucco';
  if (/\bwood\s+siding\b|\bclapboard\b|\bshingle|\bshiplap\b|\bboard\s+and\s+batten\b/.test(t)) return 'wood';
  if (/\bvinyl\s+siding\b/.test(t)) return 'vinyl';
  if (/\bbrick\b/.test(t)) return 'brick';
  if (/\bstone\b/.test(t)) return 'stone';
  return null;
}

export function extractCeilingType(text: string): 'flat' | 'popcorn' | 'vaulted' | null {
  const t = text.toLowerCase();
  if (/\bpopcorn\s+ceiling/.test(t)) return 'popcorn';
  if (/\bvaulted\s+ceiling|\bcathedral\s+ceiling|\bhigh\s+ceilings?\b/.test(t)) return 'vaulted';
  if (/\bflat\s+ceiling|\bsmooth\s+ceiling/.test(t)) return 'flat';
  return null;
}

export function extractDamageSignals(text: string): {
  wallpaper: boolean;
  holes: boolean;
  rot: boolean;
  damage: boolean;
  heavyPrep: boolean;
} {
  const t = text.toLowerCase();
  return {
    wallpaper: /\bwallpaper\b/.test(t),
    holes: /\b(hole|holes|nail holes|patch|dent)\b/.test(t),
    rot: /\b(wood rot|dry rot|rotting|rotten)\b/.test(t),
    damage: /\b(damage|damaged|cracks?|peeling|chipping|failing paint)\b/.test(t),
    heavyPrep: /\b(needs a lot of prep|extensive prep|tons of prep|lots of repairs?)\b/.test(t),
  };
}

export function extractAccessSignals(text: string): {
  occupied: boolean;
  furnished: boolean;
  vacant: boolean;
  asap: boolean;
} {
  const t = text.toLowerCase();
  return {
    occupied: /\b(we live|living here|we'?re still (?:here|in)|kids at home|pets at home)\b/.test(t),
    furnished: /\b(furnished|furniture in|moved in|all our stuff)\b/.test(t),
    vacant: /\b(vacant|empty|no one lives|not moved in|before we move)\b/.test(t),
    asap: /\b(asap|urgent|as soon as possible|this week|by (?:next )?weekend|rush)\b/.test(t),
  };
}

/**
 * Ownership/property type — rentals and multi-unit buildings price
 * differently from an owner-occupied home (rentals don't need showroom-
 * perfect finish; multi-unit work gets a volume discount; commercial has
 * different insurance/scheduling overhead).
 */
export function extractPropertyType(text: string): 'residential' | 'rental' | 'multi_unit' | 'commercial' | null {
  const t = text.toLowerCase();
  if (/\b(multi[\s-]?unit|apartment (?:complex|building)|\d+[\s-]?unit building|several units|multiple units)\b/.test(t)) {
    return 'multi_unit';
  }
  if (/\b(commercial (?:space|property|building)|office space|retail (?:store|space)|warehouse|storefront)\b/.test(t)) {
    return 'commercial';
  }
  if (/\b(rental|tenants?|landlord|renting it out|investment propert(?:y|ies)|airbnb|between tenants|turnover unit)\b/.test(t)) {
    return 'rental';
  }
  if (/\b(my home|our house|we live (?:here|there|in it)|owner[\s-]?occupied|primary residence|our (?:forever )?home)\b/.test(t)) {
    return 'residential';
  }
  return null;
}

/** Timeline urgency — rush jobs command a scheduling premium. */
export function extractTimeline(text: string): 'asap' | 'this_month' | 'no_rush' | null {
  const t = text.toLowerCase();
  if (/\b(asap|urgent|as soon as possible|this week|by (?:next )?weekend|rush|need(?:s|ed)? (?:it |this )?done (?:now|immediately)|right away)\b/.test(t)) {
    return 'asap';
  }
  if (/\b(no rush|whenever|not urgent|flexible timeline|no hurry|nothing urgent)\b/.test(t)) {
    return 'no_rush';
  }
  if (/\b(this month|within a month|next few weeks|couple weeks)\b/.test(t)) {
    return 'this_month';
  }
  return null;
}

const DECADE_MIDPOINTS: Record<string, number> = {
  '1940s': 1945, '40s': 1945, '1950s': 1955, '50s': 1955, '1960s': 1965, '60s': 1965,
  '1970s': 1975, '70s': 1975, '1980s': 1985, '80s': 1985, '1990s': 1995, '90s': 1995,
};

/** Year built — relevant mainly for the pre-1978 federal lead-paint rule. */
export function extractYearBuilt(text: string): number | null {
  const t = text.toLowerCase();
  const exact = t.match(/\b(?:built|constructed|from)\s+(?:in\s+)?(\d{4})\b/) || t.match(/\bbuilt\s+(\d{4})\b/);
  if (exact) {
    const year = parseInt(exact[1], 10);
    if (year > 1800 && year <= 2030) return year;
  }
  const decade = t.match(/\bbuilt\s+in\s+the\s+(\d{4}s|\d0s)\b/) || t.match(/\bfrom\s+the\s+(\d{4}s|\d0s)\b/);
  if (decade && DECADE_MIDPOINTS[decade[1]]) return DECADE_MIDPOINTS[decade[1]];
  if (/\b(older home|pre[\s-]?1978|before 1978|historic home|century[\s-]?old|100[\s-]?year[\s-]?old)\b/.test(t)) {
    return 1965; // conservative placeholder — triggers lead-safe handling without a false-precise year
  }
  return null;
}

/** Access difficulty — steep roofs, no ladder clearance, gated/no-elevator access all add labor time. */
export function extractAccessDifficulty(text: string): 'some' | 'significant' | null {
  const t = text.toLowerCase();
  if (/\b(no ladder access|can'?t get a ladder|no truck access|very (?:difficult|hard) access|steep (?:roof|driveway|hill|slope)|no elevator)\b/.test(t)) {
    return 'significant';
  }
  if (/\b(tight (?:side\s?yard|access|space)|limited access|narrow (?:driveway|access)|hard to (?:reach|access)|gated community)\b/.test(t)) {
    return 'some';
  }
  return null;
}

/** HOA-managed property — often means exterior color must be board-approved. */
export function extractHOA(text: string): boolean {
  return /\bhoa\b|\bhomeowners?\s+association\b|\barchitectural (?:committee|review)\b/.test(text.toLowerCase());
}

/**
 * Interior surface/finish details that already have dedicated pricing logic
 * in estimateEngine.ts (wall texture, trim condition, crown molding,
 * wainscoting, accent walls, stained wood, closets) but previously had no
 * way to be extracted from free text at all.
 */
export function extractInteriorSurfaceDetails(text: string): {
  wallTexture?: 'smooth' | 'textured' | 'heavy_texture';
  trimCondition?: 'new' | 'existing_fair';
  crownMolding?: boolean;
  wainscoting?: boolean;
  accentWalls?: boolean;
  hasStainedWood?: boolean;
  closets?: 'standard' | 'walkin';
  closetShelving?: 'wire' | 'built_in';
  woodRotExtent?: 'moderate' | 'major';
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractInteriorSurfaceDetails> = {};

  if (/\b(heavy(?:ly)? textured|thick texture|heavy knockdown)\b/.test(t)) out.wallTexture = 'heavy_texture';
  else if (/\b(textured walls?|orange peel|knockdown texture|light texture)\b/.test(t)) out.wallTexture = 'textured';
  else if (/\b(smooth walls?|flat walls?, no texture)\b/.test(t)) out.wallTexture = 'smooth';

  if (/\b(brand[\s-]?new trim|trim (?:was |is )?just installed|new trim work)\b/.test(t)) out.trimCondition = 'new';
  else if (/\b(trim (?:is |in )?(?:pretty |really |very )?(?:rough|beat[\s-]?up|bad|poor|damaged) shape|trim.{0,15}(?:chipped|damaged|rough))\b/.test(t)) out.trimCondition = 'existing_fair';

  if (/\bcrown molding\b/.test(t)) out.crownMolding = true;
  if (/\bwainscoting\b|\bbeadboard\b|\bwall paneling\b/.test(t)) out.wainscoting = true;
  if (/\baccent wall\b|\bfeature wall\b/.test(t)) out.accentWalls = true;
  if (/\bstained (?:wood|trim|doors?|cabinets?)\b.{0,20}\b(paint|painted|painting)\b|\bpaint(?:ing)? over (?:the )?stained\b/.test(t)) {
    out.hasStainedWood = true;
  }

  if (/\bwalk[\s-]?in closet\b/.test(t)) out.closets = 'walkin';
  else if (/\bcloset (?:interiors?|insides?)\b|\binside (?:the |my )?closets?\b/.test(t)) out.closets = 'standard';
  if (/\bwire shelving\b/.test(t)) out.closetShelving = 'wire';
  else if (/\bbuilt[\s-]?in shelving\b|\bbuilt[\s-]?in shelves\b/.test(t)) out.closetShelving = 'built_in';

  if (/\b(extensive|severe|major|significant) (?:wood )?rot\b/.test(t)) out.woodRotExtent = 'major';
  else if (/\b(some|moderate|a bit of) (?:wood )?rot\b/.test(t)) out.woodRotExtent = 'moderate';

  return out;
}

/** Ceiling height — a real multiplier on wall/ceiling square footage, independent of ceiling TYPE (flat/popcorn/vaulted). */
export function extractCeilingHeight(text: string): 'nine_foot' | 'ten_plus' | 'vaulted_mixed' | null {
  const t = text.toLowerCase();
  if (/\b(vaulted|cathedral)\b/.test(t)) return 'vaulted_mixed';
  if (/\b(10|ten)[\s-]?(?:\+|plus)?\s*f(?:oo|ee)?t ceilings?\b|\bhigh ceilings?\b/.test(t)) return 'ten_plus';
  if (/\b(9|nine)[\s-]?f(?:oo|ee)?t ceilings?\b/.test(t)) return 'nine_foot';
  return null;
}

/**
 * Exterior surface/finish details mirroring the interior ones above —
 * exterior color change, overall condition, stucco condition, fascia/trim,
 * and railing material all already have pricing logic but no extraction.
 */
export function extractExteriorSurfaceDetails(text: string): {
  exteriorColorChange?: 'same' | 'different';
  exteriorCondition?: 'fair' | 'poor';
  stuccoCondition?: 'new_stucco' | 'needs_repair';
  exteriorTrim?: boolean;
  exteriorRailingMaterial?: 'metal' | 'composite' | 'cable';
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractExteriorSurfaceDetails> = {};

  if (/\bsame color (?:on the outside|outside|for the exterior)\b|\bexterior.{0,15}same color\b/.test(t)) out.exteriorColorChange = 'same';
  else if (/\bdifferent color (?:on the outside|outside|for the exterior)\b|\bexterior.{0,15}different color\b|\bchanging the exterior color\b/.test(t)) out.exteriorColorChange = 'different';

  if (/\b(exterior|outside|siding).{0,20}\b(peeling|failing paint|really rough|in bad shape|falling apart)\b/.test(t)) out.exteriorCondition = 'poor';
  else if (/\b(exterior|outside|siding).{0,20}\b(some fading|a bit worn|minor (?:issues|wear))\b/.test(t)) out.exteriorCondition = 'fair';

  if (/\bnew stucco\b|\bstucco (?:was |is )?just (?:installed|applied|done)\b/.test(t)) out.stuccoCondition = 'new_stucco';
  else if (/\bstucco (?:needs repair|is cracked|has cracks|needs patching)\b|\bcracked stucco\b/.test(t)) out.stuccoCondition = 'needs_repair';

  if (/\b(fascia|exterior trim)\b/.test(t)) out.exteriorTrim = true;

  if (/\bmetal railings?\b/.test(t) && /\b(deck|porch|balcony|exterior|outside)\b/.test(t)) out.exteriorRailingMaterial = 'metal';
  else if (/\bcomposite railings?\b/.test(t)) out.exteriorRailingMaterial = 'composite';
  else if (/\bcable railings?\b/.test(t)) out.exteriorRailingMaterial = 'cable';

  return out;
}

/**
 * Specialty services — fireplace, exposed beams, built-ins, garage epoxy
 * floor, furniture painting. All five already have dedicated pricing in
 * estimateEngine.ts (see ctx.specialtyServices) but previously had zero
 * extraction — a fireplace or exposed-beam mention would just be silently
 * dropped on the floor.
 */
export function extractSpecialtyServices(text: string): {
  fireplace?: boolean;
  fireplaceType?: 'brick_paint' | 'brick_whitewash' | 'stone' | 'mantel_only';
  beams?: boolean;
  beamLocation?: 'vaulted';
  builtIns?: boolean;
  epoxy?: boolean;
  furniture?: boolean;
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractSpecialtyServices> = {};

  if (/\bfireplace\b|\bmantel\b/.test(t)) {
    out.fireplace = true;
    if (/\bwhitewash/.test(t)) out.fireplaceType = 'brick_whitewash';
    else if (/\bstone fireplace\b/.test(t)) out.fireplaceType = 'stone';
    else if (/\bmantel only\b|\bjust the mantel\b/.test(t)) out.fireplaceType = 'mantel_only';
    else if (/\bbrick fireplace\b/.test(t)) out.fireplaceType = 'brick_paint';
  }

  if (/\bexposed beams?\b|\bwood beams?\b|\bceiling beams?\b/.test(t)) {
    out.beams = true;
    if (/\bvaulted\b/.test(t)) out.beamLocation = 'vaulted';
  }

  if (/\bbuilt[\s-]?ins?\b|\bbuilt[\s-]?in (?:bookshelf|bookshelves|shelving|cabinetry)\b/.test(t)) out.builtIns = true;

  if (/\bepoxy\b.{0,20}\bgarage\b|\bgarage floor\b.{0,20}\bepoxy\b|\bepoxy (?:the )?(?:garage )?floor\b/.test(t)) out.epoxy = true;

  if (/\bpaint (?:this|my|the|a) (?:dresser|table|chair|cabinet piece|bookshelf|nightstand|desk)\b/.test(t)) out.furniture = true;

  return out;
}

/**
 * Sequenced or cure-time-dependent work that requires a second visit:
 * "paint the baseboards before install, touch up after", "window glazing
 * needs to set before painting", "prime now, finish coat after the other
 * trades", "spray the cabinet doors off-site then reinstall", etc.
 */
export function extractMultiTrip(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(before it'?s? installed|before installation|then (?:come back|touch up|return)|touch[\s-]?ups? after|come back (?:and|to) (?:paint|finish|touch)|after (?:the )?install(?:ation)?)\b/.test(t) ||
    /\b(needs? (?:time|a day|\d+ hours?|\d+ days?) to (?:set|cure|dry)|needs? to (?:cure|set) before|has to (?:cure|set|dry) (?:first|before)|window glazing)\b/.test(t) ||
    /\b(prime (?:now|first)[,.]? (?:and )?(?:finish|topcoat|final coat) (?:coat )?after|second (?:trip|visit) (?:to|for) (?:paint|finish)|off[\s-]?site (?:and|then) reinstall)\b/.test(t)
  );
}

/** Specialty access equipment — a real rental cost, not just extra labor time. */
export function extractSpecialEquipment(text: string): 'extended_ladder' | 'scaffolding' | 'lift' | null {
  const t = text.toLowerCase();
  if (/\b(boom lift|scissor lift|cherry picker|man[\s-]?lift|aerial lift)\b/.test(t)) return 'lift';
  if (/\b(scaffold(?:ing)?|swing stage)\b/.test(t)) return 'scaffolding';
  if (/\b(extension ladder|\d{2}[\s-]?f(?:oo|ee)?t ladder|fall protection|really high (?:peak|roof|gable))\b/.test(t)) return 'extended_ladder';
  return null;
}

/**
 * Hardware/fixture removal & reinstall around the work area — towel bars,
 * curtain rods, switch plates, outlet covers, vent covers, mirrors, light
 * fixtures, thermostats, smoke detectors, blinds.
 */
export function extractFixtureRemoval(text: string): 'minor' | 'extensive' | null {
  const t = text.toLowerCase();
  const mentioned = /\b(towel bar|curtain rod|switch plates?|outlet covers?|vent covers?|register covers?|mirror|light fixtures?|ceiling fan|thermostat|smoke detectors?|blinds|shelf brackets?|house numbers?|mailbox)\b.*\b(remove|removed|removal|take down|taken down|off)\b|\b(remove|removed|removal|take down|taken down)\b.*\b(towel bar|curtain rod|switch plates?|outlet covers?|vent covers?|register covers?|mirror|light fixtures?|ceiling fan|thermostat|smoke detectors?|blinds|shelf brackets?)\b/.test(t);
  if (!mentioned) return null;
  if (/\b(all|every|whole house|each room|throughout)\b/.test(t)) return 'extensive';
  return 'minor';
}

/** New hardware installation (cabinet hinges/knobs/pulls, switch plates) — handyman-adjacent add-on. */
export function extractHardwareReplacement(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(replace|swap out|install new|put (?:up|on) new)\b.{0,20}\b(hinges?|knobs?|pulls?|handles?|switch plates?|house numbers?)\b/.test(t);
}

/** Low-odor/eco-friendly paint request — premium material line, often driven by allergies/asthma/pregnancy. */
export function extractLowVOC(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(low[\s-]?voc|zero[\s-]?voc|no[\s-]?voc|low[\s-]?odor|no[\s-]?odor|eco[\s-]?friendly paint|non[\s-]?toxic paint)\b/.test(t) ||
    (/\b(allerg(?:y|ies)|asthma|pregnant|sensitive to (?:fumes|smell))\b/.test(t) && /\bpaint\b/.test(t));
}

/** Mold/mildew present — needs treatment before painting. */
export function extractMoldTreatment(text: string): boolean {
  return /\b(mold|mildew|musty smell)\b/.test(text.toLowerCase());
}

/**
 * Exterior architectural features — garage doors, decks, fences, railings,
 * shutters, gutters, foundation, balconies, overhangs/patio covers, soffits &
 * eaves, and exterior window trim (including French-pane windows).
 */
export function extractExteriorFeatures(text: string): {
  garageDoor?: 'single' | 'double';
  entryDoor?: boolean;
  deck?: boolean;
  deckSize?: 'small' | 'medium' | 'large';
  fence?: boolean;
  fenceType?: 'picket_4ft' | 'privacy_6ft' | 'chain_link';
  fenceLinearFeet?: number;
  railings?: boolean;
  railingType?: 'simple' | 'spindles';
  balconies?: boolean;
  gutters?: boolean;
  foundation?: boolean;
  overhangs?: boolean;
  soffitsEaves?: boolean;
  exteriorShutters?: boolean;
  exteriorWindows?: boolean;
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractExteriorFeatures> = {};

  if (/\bgarage\s+doors?\b/.test(t)) {
    if (/\b(two|2|double|two[-\s]?car)\s+(?:garage\s+)?doors?\b|\bdouble\s+garage\b/.test(t)) {
      out.garageDoor = 'double';
    } else {
      out.garageDoor = 'single';
    }
  }

  if (/\b(front|entry)\s+door\b/.test(t)) out.entryDoor = true;

  if (/\bdecks?\b/.test(t) && !/\bdeck(?:ed)?\s+out\b/.test(t)) {
    out.deck = true;
    if (/\bsmall\s+deck\b/.test(t)) out.deckSize = 'small';
    else if (/\blarge\s+deck\b|\bbig\s+deck\b/.test(t)) out.deckSize = 'large';
    else if (/\bmedium\s+deck\b/.test(t)) out.deckSize = 'medium';
  }

  if (/\b(outside|outdoor|exterior)\s+(?:stair(?:case|way)?s?|steps)\b/.test(t)) {
    out.railings = true;
  }

  if (/\bfences?\b/.test(t)) {
    out.fence = true;
    if (/\bpicket\s+fence\b/.test(t)) out.fenceType = 'picket_4ft';
    else if (/\bprivacy\s+fence\b/.test(t)) out.fenceType = 'privacy_6ft';
    else if (/\bchain[\s-]?link\b/.test(t)) out.fenceType = 'chain_link';
    const fenceIdx = t.search(/\bfences?\b/);
    if (fenceIdx >= 0) {
      const window = t.slice(Math.max(0, fenceIdx - 20), fenceIdx + 30);
      const m = window.match(/\b(\d{2,4})\s*(?:linear\s*)?(?:ft\.?|feet|'|lin\.?\s*ft)\b/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (isFinite(n) && n > 0 && n < 3000) out.fenceLinearFeet = n;
      }
    }
  }

  // Bannister/railing wording without any "stair(s)" mention nearby means a
  // deck, porch, or balcony railing (exterior). Staircase railings/bannisters
  // are handled separately by extractInteriorDetails as an interior detail.
  if (/\b(railings?|hand\s*rails?|bannisters?|banisters?|balustrades?)\b/.test(t) && !/\bstair/.test(t)) {
    out.railings = true;
    if (/\bspindles?\b/.test(t)) out.railingType = 'spindles';
  }

  if (/\bbalcon(?:y|ies)\b/.test(t)) out.balconies = true;

  if (/\bgutters?\b|\bdownspouts?\b/.test(t)) out.gutters = true;

  if (/\bfoundation\b/.test(t)) out.foundation = true;

  if (/\boverhangs?\b|\bpatio\s*cover\b|\bporch\s*roof\b|\bpatios?\b/.test(t)) out.overhangs = true;

  if (/\bsoffits?\b|\beaves\b/.test(t)) out.soffitsEaves = true;

  if (/\bshutters?\b/.test(t) && /\bexterior|\boutside|\bwindow shutters|\bhouse\b/.test(t)) {
    out.exteriorShutters = true;
  }

  if (/\bwindow\s*frames?\b|\bwindow\s*trim\b|\bwindowsills?\b|\bwindow\s+sills?\b/.test(t)) {
    out.exteriorWindows = true;
  }

  return out;
}

/**
 * Interior architectural details — door frames/jambs, cabinet interiors,
 * closet shelving, interior stairway bannisters, interior brick, and
 * baseboard mentions.
 */
export function extractInteriorDetails(text: string): {
  doorFrames?: boolean;
  cabinetInsides?: boolean;
  interiorShutters?: boolean;
  stairway?: boolean;
  stairwayWithRailings?: boolean;
  interiorBrick?: boolean;
  baseboardsMentioned?: boolean;
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractInteriorDetails> = {};

  if (/\bdoor\s*frames?\b|\bdoor\s*jambs?\b|\bjambs?\b/.test(t)) out.doorFrames = true;

  if (/\b(inside|interior)\s+(?:of\s+)?(?:the\s+)?cabinets?\b|\bcabinet\s+interiors?\b/.test(t)) {
    out.cabinetInsides = true;
  }

  if (/\bshutters?\b/.test(t) && !/\bexterior|\boutside|\bhouse\b/.test(t)) {
    out.interiorShutters = true;
  }

  if (/\b(staircase|stairway|stairs)\b/.test(t)) {
    out.stairway = true;
    if (/\b(railings?|bannisters?|banisters?|balustrades?|hand\s*rails?)\b/.test(t)) {
      out.stairwayWithRailings = true;
    }
  }

  if (/\bbrick\b/.test(t) && /\bfireplace|\baccent\s+wall|\binterior\b/.test(t)) {
    out.interiorBrick = true;
  }

  if (/\bbaseboards?\b/.test(t)) out.baseboardsMentioned = true;

  return out;
}

/** French-pane windows/doors — distinct labor from standard flat panes. */
export function extractFrenchPane(text: string): { window?: boolean; door?: boolean } {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractFrenchPane> = {};
  if (/\bfrench[\s-]?pane[d]?\s+windows?\b|\bfrench\s+windows?\b/.test(t)) out.window = true;
  if (/\bfrench[\s-]?pane[d]?\s+doors?\b|\bfrench\s+doors?\b/.test(t)) out.door = true;
  return out;
}

/**
 * Rental/apartment/unit phrasing — this almost always means the interior of
 * a single dwelling unit, not the whole exterior of a multi-unit building,
 * and it means the WHOLE unit rather than one room.
 */
export function extractUnitContext(text: string): { impliesInterior: boolean; impliesWholeUnit: boolean } {
  const t = text.toLowerCase();
  const isUnit = /\b(rental\s+unit|the\s+unit|my\s+unit|apartment|apt\.?|condo(?:minium)?|duplex|studio)\b/.test(t);
  return { impliesInterior: isUnit, impliesWholeUnit: isUnit };
}

/**
 * Extract surface-scope limiters ("just walls", "no trim", "everything", etc.)
 * Returns individual yes/no/unspecified signals for each interior surface.
 */
export function extractSurfaceScope(text: string): {
  walls?: 'yes' | 'no';
  ceilings?: 'yes' | 'no';
  trim?: 'yes' | 'no';
  doors?: 'yes' | 'no';
  closets?: 'yes' | 'no';
  everything?: boolean;
  nothing?: boolean;
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractSurfaceScope> = {};

  // "everything" / "the whole room" → all yes
  if (/\b(everything|the whole room|whole thing|full (?:scope|package)|all of it|paint it all)\b/.test(t)) {
    out.everything = true;
    out.walls = 'yes';
    out.ceilings = 'yes';
    out.trim = 'yes';
    out.doors = 'yes';
    return out;
  }

  // "just walls" / "only walls" → walls yes, rest no
  const justOnly = /\b(?:just|only)\s+(?:the\s+)?([\w\s,]+?)(?:$|[.,;])/i.exec(t);
  if (justOnly) {
    const limited = justOnly[1];
    const hasWalls = /\bwalls?\b/.test(limited);
    const hasCeiling = /\bceiling/.test(limited);
    const hasTrim = /\btrim\b/.test(limited);
    const hasDoors = /\bdoors?\b/.test(limited);

    // If they said "just walls" — walls yes, default others no
    if (hasWalls && !hasCeiling && !hasTrim && !hasDoors) {
      out.walls = 'yes';
      out.ceilings = 'no';
      out.trim = 'no';
      out.doors = 'no';
      return out;
    }
    // "just walls and ceiling" — include listed, default exclude rest
    if (hasWalls) out.walls = 'yes';
    if (hasCeiling) out.ceilings = 'yes';
    if (hasTrim) out.trim = 'yes';
    if (hasDoors) out.doors = 'yes';
    if (!hasWalls) out.walls = 'no';
    if (!hasCeiling) out.ceilings = 'no';
    if (!hasTrim) out.trim = 'no';
    if (!hasDoors) out.doors = 'no';
    return out;
  }

  // Targeted negations — "no trim", "not the ceiling", "skip the doors"
  if (/\b(?:no|not|without|skip|except)\s+(?:the\s+)?trim\b/.test(t)) out.trim = 'no';
  if (/\b(?:no|not|without|skip|except)\s+(?:the\s+)?ceiling/.test(t)) out.ceilings = 'no';
  if (/\b(?:no|not|without|skip|except)\s+(?:the\s+)?doors?\b/.test(t)) out.doors = 'no';
  if (/\b(?:no|not|without|skip|except)\s+(?:the\s+)?closet/.test(t)) out.closets = 'no';

  // Targeted inclusions — "paint the trim too", "include the ceilings"
  if (/\b(?:include|with|and|plus|paint)\s+(?:the\s+)?trim\b/.test(t)) out.trim = 'yes';
  if (/\b(?:include|with|and|plus|paint)\s+(?:the\s+)?ceiling/.test(t)) out.ceilings = 'yes';
  if (/\b(?:include|with|and|plus|paint)\s+(?:the\s+)?doors?\b/.test(t)) out.doors = 'yes';

  return out;
}

/** Room size (qualitative or dimensions in feet). */
export function extractRoomSize(text: string): {
  size?: 'small' | 'medium' | 'large';
  widthFt?: number;
  lengthFt?: number;
  sqft?: number;
} {
  const t = text.toLowerCase();
  const out: ReturnType<typeof extractRoomSize> = {};

  // "10x12" or "10 by 12" or "10'x12'"
  const dim = t.match(/(\d{1,3})\s*(?:x|×|by)\s*(\d{1,3})/);
  if (dim) {
    out.widthFt = parseInt(dim[1], 10);
    out.lengthFt = parseInt(dim[2], 10);
    out.sqft = out.widthFt * out.lengthFt;
    return out;
  }

  // Explicit sqft
  const sq = extractSquareFeet(text);
  if (sq) {
    out.sqft = sq;
    return out;
  }

  if (/\b(?:small|tiny|little|compact)\b/.test(t)) out.size = 'small';
  else if (/\b(?:medium|average|normal|standard)\b/.test(t)) out.size = 'medium';
  else if (/\b(?:large|big|huge|massive|oversized|spacious)\b/.test(t)) out.size = 'large';

  return out;
}

/** Sheen / finish preference. */
export function extractSheen(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bflat\b|\bmatte\b/.test(t)) return 'flat';
  if (/\beggshell\b/.test(t)) return 'eggshell';
  if (/\bsatin\b/.test(t)) return 'satin';
  if (/\bsemi[-\s]?gloss\b/.test(t)) return 'semi-gloss';
  if (/\bgloss\b|\bhigh[-\s]?gloss\b/.test(t)) return 'gloss';
  return null;
}

/** Budget mentions — "around $3000", "my budget is 5k". */
export function extractBudget(text: string): number | null {
  const t = text.toLowerCase();
  const m = t.match(/\$\s*(\d{1,2}(?:[,.]\d{3})?|\d{3,6})\s*k?\b/);
  if (!m) {
    const k = t.match(/\b(\d{1,3})\s*k\b/);
    if (k) return parseInt(k[1], 10) * 1000;
    return null;
  }
  let n = parseInt(m[1].replace(/[,.]/g, ''), 10);
  if (/k\b/.test(m[0])) n *= 1000;
  return isFinite(n) && n > 100 && n < 500000 ? n : null;
}

// ===== Master extractor =====

export function extractAll(text: string, prev: EstimatorContext): ExtractResult {
  const patch: Partial<EstimatorContext> = {};
  const acks: string[] = [];

  const zip = extractZip(text);
  if (zip && !prev.zipCode) {
    patch.zipCode = zip;
    acks.push(`ZIP ${zip}`);
  }

  const sqft = extractSquareFeet(text);
  if (sqft && !prev.squareFeet) {
    patch.squareFeet = sqft;
    acks.push(`${sqft.toLocaleString()} sqft`);
  }

  const beds = extractBedroomCount(text);
  if (beds && !prev.bedroomCount) {
    patch.bedroomCount = beds;
    acks.push(`${beds}-bedroom`);
  }

  const stories = extractStories(text);
  if (stories && !prev.stories) {
    patch.stories = stories;
    acks.push(`${stories}-story`);
  }

  const proj = extractProjectType(text);
  if (proj && !prev.projectType) {
    patch.projectType = proj;
    acks.push(proj === 'both' ? 'interior + exterior' : proj);
  }

  const cond = extractProjectCondition(text);
  if (cond && !prev.projectCondition) {
    patch.projectCondition = cond;
    if (cond === 'new_construction') acks.push('new construction');
    else if (cond === 'renovation') acks.push('renovation');
    else acks.push('repaint');
  }

  const roomsSourceText = stripQuantifiedBedBath(text);
  const quantifiedBedBathMention = roomsSourceText !== text;
  const rooms = extractRooms(roomsSourceText);
  if (rooms.length > 0 && prev.selectedRooms.length === 0 && prev.interiorScope !== 'whole_house') {
    // A room mentioned in passing ("the kitchen has some grease stains")
    // must never narrow an already-established whole-house scope down to
    // just that room — that silently collapses the whole quote.
    patch.selectedRooms = rooms;
    patch.interiorScope = 'specific_rooms';
    acks.push(`${rooms.length} rooms`);
  } else if (
    quantifiedBedBathMention &&
    prev.selectedRooms.length === 0 &&
    !prev.interiorScope &&
    !patch.interiorScope
  ) {
    // "2 bed 1 bath", "4 bed 3 bath" etc. describe the whole place, not one room.
    patch.interiorScope = 'whole_house';
  }

  const cab = extractCabinets(text);
  if (cab.yes && prev.cabinets === 'none') {
    patch.cabinets = cab.locations.length > 1 ? 'multiple' : cab.locations[0] || 'kitchen';
    patch.cabinetLocations = cab.locations;
    acks.push('cabinets');
  }

  const color = extractColorChange(text);
  if (color && !prev.interiorColorChange) {
    patch.interiorColorChange = color;
    if (color === 'dramatic') acks.push('dramatic color change');
    else if (color === 'different') acks.push('color change');
  }

  const siding = extractSidingType(text);
  if (siding && !prev.sidingType) {
    patch.sidingType = siding;
    acks.push(siding);
  }

  const ceiling = extractCeilingType(text);
  if (ceiling && !prev.ceilingType) {
    patch.ceilingType = ceiling;
    if (ceiling === 'popcorn') acks.push('popcorn ceilings');
    else if (ceiling === 'vaulted') acks.push('vaulted ceilings');
  }

  const damage = extractDamageSignals(text);
  const addPrep = (key: string) => {
    const existing = patch.prepWork ?? prev.prepWork ?? [];
    if (!existing.includes(key)) patch.prepWork = [...existing, key];
  };
  if (damage.wallpaper) {
    addPrep('wallpaper_removal');
    acks.push('wallpaper removal');
  }
  if (damage.rot) {
    addPrep('wood_rot');
    acks.push('wood rot');
  }
  if (damage.heavyPrep) {
    patch.drywallRepairExtent = 'major';
    acks.push('heavy prep');
  } else if (damage.holes && !damage.heavyPrep) {
    patch.drywallRepairExtent = patch.drywallRepairExtent || prev.drywallRepairExtent || 'minor';
  }

  const access = extractAccessSignals(text);
  if (access.vacant) {
    patch.occupancy = 'vacant';
  } else if (access.furnished || access.occupied) {
    patch.occupancy = 'furnished';
  }

  const propType = extractPropertyType(text);
  if (propType && !prev.propertyType) {
    patch.propertyType = propType;
    if (propType === 'rental') acks.push('rental property');
    else if (propType === 'multi_unit') acks.push('multi-unit');
    else if (propType === 'commercial') acks.push('commercial');
  }

  const timeline = extractTimeline(text);
  if (timeline && !prev.timeline) {
    patch.timeline = timeline;
    if (timeline === 'asap') acks.push('ASAP');
  }

  const yearBuilt = extractYearBuilt(text);
  if (yearBuilt && !prev.yearBuilt) {
    patch.yearBuilt = yearBuilt;
    if (yearBuilt < 1978) acks.push('pre-1978 construction');
  }

  const accessDifficulty = extractAccessDifficulty(text);
  if (accessDifficulty && prev.accessRestrictions === 'none') {
    patch.accessRestrictions = accessDifficulty;
    acks.push('tough access');
  }

  if (extractHOA(text) && prev.hoa !== 'yes') {
    patch.hoa = 'yes';
    acks.push('HOA');
  }

  if (extractMultiTrip(text) && prev.multiTripRequired !== 'yes') {
    patch.multiTripRequired = 'yes';
    acks.push('return trip needed');
  }

  const equipment = extractSpecialEquipment(text);
  if (equipment && prev.specialEquipment === 'none') {
    patch.specialEquipment = equipment;
    acks.push(equipment === 'lift' ? 'lift needed' : equipment === 'scaffolding' ? 'scaffolding needed' : 'tall ladder needed');
  }

  const fixtureRemoval = extractFixtureRemoval(text);
  if (fixtureRemoval && prev.fixtureRemoval === 'none') {
    patch.fixtureRemoval = fixtureRemoval;
    acks.push('fixture removal');
  }

  if (extractHardwareReplacement(text) && prev.hardwareReplacement !== 'yes') {
    patch.hardwareReplacement = 'yes';
    acks.push('new hardware');
  }

  if (extractLowVOC(text) && prev.lowVocRequested !== 'yes') {
    patch.lowVocRequested = 'yes';
    acks.push('low-VOC paint');
  }

  if (extractMoldTreatment(text)) {
    addPrep('mold_treatment');
    acks.push('mold treatment');
  }

  const interiorSurface = extractInteriorSurfaceDetails(text);
  if (interiorSurface.wallTexture && !prev.wallTexture) {
    patch.wallTexture = interiorSurface.wallTexture;
    acks.push(interiorSurface.wallTexture.replace('_', ' '));
  }
  if (interiorSurface.trimCondition && prev.trimCondition === 'existing_good') {
    patch.trimCondition = interiorSurface.trimCondition;
    acks.push(interiorSurface.trimCondition === 'new' ? 'new trim' : 'trim needs work');
  }
  if (interiorSurface.crownMolding && prev.crownMolding !== 'yes') {
    patch.crownMolding = 'yes';
    acks.push('crown molding');
  }
  if (interiorSurface.wainscoting && prev.wainscoting !== 'yes') {
    patch.wainscoting = 'yes';
    acks.push('wainscoting');
  }
  if (interiorSurface.accentWalls && prev.accentWalls !== 'yes') {
    patch.accentWalls = 'yes';
    acks.push('accent wall');
  }
  if (interiorSurface.hasStainedWood && prev.hasStainedWood !== 'yes') {
    patch.hasStainedWood = 'yes';
    acks.push('stained wood prep');
  }
  if (interiorSurface.closets && prev.closets === 'none') {
    patch.closets = interiorSurface.closets;
    acks.push(interiorSurface.closets === 'walkin' ? 'walk-in closet' : 'closet interiors');
  }
  if (interiorSurface.closetShelving && prev.closetShelving === 'none') {
    patch.closetShelving = interiorSurface.closetShelving;
  }
  if (interiorSurface.woodRotExtent && prev.woodRotExtent === 'minor') {
    patch.woodRotExtent = interiorSurface.woodRotExtent;
    addPrep('wood_rot');
  }

  const ceilingHeight = extractCeilingHeight(text);
  if (ceilingHeight && (!prev.ceilingHeight || prev.ceilingHeight === 'standard')) {
    patch.ceilingHeight = ceilingHeight;
    acks.push(ceilingHeight === 'vaulted_mixed' ? 'vaulted ceilings' : `${ceilingHeight === 'ten_plus' ? '10+' : '9'} ft ceilings`);
  }

  const exteriorSurface = extractExteriorSurfaceDetails(text);
  if (exteriorSurface.exteriorColorChange && !prev.exteriorColorChange) {
    patch.exteriorColorChange = exteriorSurface.exteriorColorChange;
  }
  if (exteriorSurface.exteriorCondition && prev.exteriorCondition === 'good') {
    patch.exteriorCondition = exteriorSurface.exteriorCondition;
    acks.push(`exterior in ${exteriorSurface.exteriorCondition} condition`);
  }
  if (exteriorSurface.stuccoCondition && prev.stuccoCondition === 'good') {
    patch.stuccoCondition = exteriorSurface.stuccoCondition;
    acks.push(exteriorSurface.stuccoCondition === 'new_stucco' ? 'new stucco' : 'stucco repair needed');
  }
  if (exteriorSurface.exteriorTrim && prev.exteriorTrim !== 'yes') {
    patch.exteriorTrim = 'yes';
    acks.push('exterior trim/fascia');
  }
  if (exteriorSurface.exteriorRailingMaterial && prev.exteriorRailingMaterial === 'wood') {
    patch.exteriorRailingMaterial = exteriorSurface.exteriorRailingMaterial;
  }

  const specialty = extractSpecialtyServices(text);
  const addSpecialty = (key: string) => {
    const existing = patch.specialtyServices ?? prev.specialtyServices ?? [];
    if (!existing.includes(key)) patch.specialtyServices = [...existing, key];
  };
  if (specialty.fireplace) {
    addSpecialty('fireplace');
    if (specialty.fireplaceType) patch.fireplaceType = specialty.fireplaceType;
    acks.push('fireplace');
  }
  if (specialty.beams) {
    addSpecialty('beams');
    if (specialty.beamLocation) patch.beamLocation = specialty.beamLocation;
    acks.push('exposed beams');
  }
  if (specialty.builtIns) {
    addSpecialty('built_ins');
    acks.push('built-ins');
  }
  if (specialty.epoxy) {
    addSpecialty('epoxy');
    acks.push('garage epoxy floor');
  }
  if (specialty.furniture) {
    addSpecialty('furniture');
    acks.push('furniture piece');
  }

  // Rental unit / apartment / condo — whole-unit scope, not a single room
  const unitCtx = extractUnitContext(text);
  if (unitCtx.impliesWholeUnit && !prev.interiorScope && prev.selectedRooms.length === 0) {
    patch.interiorScope = 'whole_house';
    acks.push('whole unit');
  }

  // Exterior architectural features
  const ext = extractExteriorFeatures(text);
  if (ext.garageDoor && prev.garageDoor === 'none') {
    patch.garageDoor = ext.garageDoor;
    acks.push(`${ext.garageDoor} garage door`);
  }
  if (ext.entryDoor && prev.entryDoor === 'no') {
    patch.entryDoor = 'yes';
    acks.push('entry door');
  }
  if (ext.deck && prev.deck === 'none') {
    patch.deck = 'yes';
    if (ext.deckSize) patch.deckSize = ext.deckSize;
    acks.push('deck');
  }
  if (ext.fence && prev.fence === 'none') {
    patch.fence = 'yes';
    if (ext.fenceType) patch.fenceType = ext.fenceType;
    if (ext.fenceLinearFeet) patch.fenceLinearFeet = ext.fenceLinearFeet;
    acks.push(ext.fenceType === 'picket_4ft' ? 'picket fence' : 'fence');
  }
  if (ext.railings && prev.railings === 'none') {
    patch.railings = 'yes';
    if (ext.railingType) patch.railingType = ext.railingType;
    acks.push('railings');
  }
  if (ext.balconies && prev.balconies === 'none') {
    patch.balconies = 'yes';
    acks.push('balconies');
  }
  if (ext.gutters && prev.gutters === 'no') {
    patch.gutters = 'yes';
    acks.push('gutters');
  }
  if (ext.foundation && prev.foundation === 'no') {
    patch.foundation = 'yes';
    acks.push('foundation');
  }
  if (ext.overhangs && prev.overhangs === 'no') {
    patch.overhangs = 'yes';
    acks.push('overhangs/patio cover');
  }
  if (ext.soffitsEaves && prev.soffitsEaves !== 'yes') {
    patch.soffitsEaves = 'yes';
    acks.push('soffits & eaves');
  }
  if (ext.exteriorShutters && prev.exteriorShutters === 'no') {
    patch.exteriorShutters = 'yes';
    acks.push('exterior shutters');
  }
  if (ext.exteriorWindows && prev.exteriorWindows === 'none') {
    patch.exteriorWindows = 'trim_only';
    acks.push('exterior window trim');
  }

  // Interior architectural details
  const interiorDetails = extractInteriorDetails(text);
  if (interiorDetails.doorFrames && prev.doorFrames === 'no') {
    patch.doorFrames = 'yes';
    acks.push('door frames');
  }
  if (interiorDetails.cabinetInsides && prev.cabinetScope !== 'inside_too') {
    patch.cabinetScope = 'inside_too';
    acks.push('cabinet interiors');
  }
  if (interiorDetails.interiorShutters && prev.interiorShutters === 'no') {
    patch.interiorShutters = 'yes';
    acks.push('interior shutters');
  }
  if (interiorDetails.stairway && prev.stairways === 'none') {
    patch.stairways = 'yes';
    patch.stairwayDetails = interiorDetails.stairwayWithRailings ? 'walls_and_railings' : 'walls_only';
    acks.push('staircase');
  } else if (interiorDetails.stairwayWithRailings && prev.stairways === 'yes' && prev.stairwayDetails !== 'walls_and_railings') {
    patch.stairwayDetails = 'walls_and_railings';
    acks.push('bannister/railings');
  }
  if (interiorDetails.interiorBrick && !prev.specialtyServices.includes('brick')) {
    patch.specialtyServices = [...(patch.specialtyServices ?? prev.specialtyServices), 'brick'];
    acks.push('interior brick');
  }
  if (interiorDetails.baseboardsMentioned && prev.baseboards !== 'yes') {
    patch.baseboards = 'yes';
  }

  // French-pane windows/doors
  const frenchPane = extractFrenchPane(text);
  if (frenchPane.window && !prev.windowTypes.includes('french_pane')) {
    patch.windowTypes = [...(patch.windowTypes ?? prev.windowTypes), 'french_pane'];
    acks.push('French-pane windows');
  }
  if (frenchPane.door && !prev.doorTypes.includes('french')) {
    patch.doorTypes = [...(patch.doorTypes ?? prev.doorTypes), 'french'];
    acks.push('French doors');
  }

  // Surface scope limiters
  const surf = extractSurfaceScope(text);
  if (surf.walls !== undefined) patch.interiorWalls = surf.walls;
  if (surf.ceilings !== undefined) patch.interiorCeilings = surf.ceilings;
  if (surf.trim !== undefined) patch.interiorTrim = surf.trim;
  if (surf.doors !== undefined) patch.interiorDoors = surf.doors === 'yes' ? 'some' : 'none';
  if (surf.closets !== undefined) patch.closets = surf.closets === 'yes' ? 'standard' : 'none';
  if (surf.everything) acks.push('whole room');
  if (surf.walls === 'yes' && surf.trim === 'no') acks.push('walls only');

  // Room size (qualitative or dimensions)
  if (!prev.squareFeet) {
    const rs = extractRoomSize(text);
    if (rs.sqft) {
      // sqft here refers to FLOOR sqft; store on squareFeet only if this seems whole-project
      // For single-room contexts, mark the room's floor sqft in a note.
      patch.additionalDetails = `${prev.additionalDetails ? prev.additionalDetails + '; ' : ''}room ${rs.widthFt && rs.lengthFt ? `${rs.widthFt}x${rs.lengthFt}` : `${rs.sqft}sqft`}`;
      acks.push(`${rs.widthFt && rs.lengthFt ? `${rs.widthFt}×${rs.lengthFt}` : `${rs.sqft} sqft`}`);
    } else if (rs.size) {
      patch.additionalDetails = `${prev.additionalDetails ? prev.additionalDetails + '; ' : ''}${rs.size} room`;
      acks.push(`${rs.size} room`);
    }
  }

  // Sheen
  const sheen = extractSheen(text);
  if (sheen) {
    patch.additionalDetails = `${prev.additionalDetails ? prev.additionalDetails + '; ' : ''}${sheen} sheen`;
  }

  return { patch, acknowledgements: acks };
}
