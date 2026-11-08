// ============================================================================
// Topics + Response Bank
// ============================================================================
// Replaces the old static QUESTIONS array.
// Each topic has:
//   - relevant(ctx): should we consider this topic at all?
//   - alreadyAnswered(ctx): is ctx already sufficient to skip this?
//   - ask(ctx): primary question (multiple variants, rotated for freshness)
//   - clarify(ctx): "like what?" / "what do you mean?" response
//   - example(ctx): "give me an example" response
//
// Additionally exports `metaBank` — canned answers for user questions TO the
// bot (cost, how-it-works, real-person, booking, etc.).
// ============================================================================

import type { EstimatorContext } from '../types';
import { isIsolatedDetailJob } from './details';
import { itemsPhrase } from './items';

export interface Topic {
  id: string;
  priority: number;
  relevant: (ctx: EstimatorContext) => boolean;
  alreadyAnswered: (ctx: EstimatorContext) => boolean;
  ask: (ctx: EstimatorContext) => string;
  clarify: (ctx: EstimatorContext) => string;
  example: (ctx: EstimatorContext) => string;
}

// Deterministic "rotation" based on a seed so the same ctx picks the same
// variant (keeps tests stable; removes apparent randomness).
function pick<T>(variants: T[], seedStr: string): T {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}

// Includes responseLengths so even the FIRST question (asked before
// zipCode/projectType/selectedRooms exist) varies by how much the user
// already typed — without this, every brand-new conversation produced the
// exact same opening follow-up question, which is a big part of what reads
// as "scripted" on repeat testing.
const seed = (ctx: EstimatorContext) =>
  `${ctx.zipCode}|${ctx.projectType}|${ctx.selectedRooms.join(',')}|${ctx.responseLengths.join(',')}|${ctx.squareFeet}|${ctx.bedroomCount}|${ctx.propertyType}`;

/** Natural label for a STANDARD_ROOMS key, for room-specific phrasing. */
function roomLabel(room: string | undefined): string {
  switch (room) {
    case 'master_bedroom': return 'master bedroom';
    case 'bedroom_2': return 'bedroom';
    case 'bedroom_3': return 'bedroom';
    case 'bedroom_4': return 'bedroom';
    case 'living_room': return 'living room';
    case 'dining_room': return 'dining room';
    case 'kitchen': return 'kitchen';
    case 'bathroom_master': return 'master bath';
    case 'bathroom_2': return 'bathroom';
    case 'bathroom_3': return 'half bath';
    case 'office': return 'office';
    case 'laundry': return 'laundry room';
    case 'hallway': return 'hallway';
    case 'entryway': return 'entryway';
    case 'garage': return 'garage';
    case 'bonus_room': return 'bonus room';
    default: return 'room';
  }
}

/** Any form of timing counts: ASAP/no-rush, a start date, a range, or "my dates are flexible". */
const hasTiming = (c: EstimatorContext) => !!(c.timeline || c.startDate || c.endDate || c.datesFlexible);

/** The customer narrowed the job to one thing (a railing, cabinets, trim footage, popcorn removal...) so whole-house questions don't apply. */
const isNarrowInteriorJob = (c: EstimatorContext) =>
  c.interiorWalls === 'no' &&
  c.surfacesAddressed &&
  (isIsolatedDetailJob(c) || c.closets !== 'none' || c.furnitureItems.length > 0 || c.stairwayDetails === 'railings_only' || c.cabinets !== 'none' || c.trimLinearFeet != null || c.popcornCeilingSqft != null || c.prepWork.includes('popcorn_removal') || c.interiorTrim === 'yes' || c.interiorCeilings === 'yes');

/** The small trim details a stand-alone detail job is about, in words ("chair rail and crown moulding"). */
function detailLabel(c: EstimatorContext): string {
  const parts = [c.chairRail === 'yes' ? 'chair rail' : '', c.crownMolding === 'yes' ? 'crown moulding' : '', c.wainscoting === 'yes' ? 'wainscoting' : '', c.interiorTrim === 'yes' ? 'baseboards' : ''].filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] ?? 'trim';
}

/**
 * The job is one fixed item or part of a room, not the room: the cabinets (or vanities), built-in shelving, a mantel, a railing. The walls,
 * ceilings, trim and doors are off (the customer said so, or it was only that item), so the room questions never apply unless the customer
 * adds those surfaces (then they are in scope again, and this is '').
 */
export function componentKind(c: EstimatorContext): '' | 'cabinets' | 'builtins' | 'mantel' | 'railing' {
  if (c.itemsOnly) return '';
  const off = c.interiorWalls === 'no' && c.interiorCeilings !== 'yes' && c.interiorTrim !== 'yes' && c.interiorDoors === 'none' && c.surfacesAddressed;
  if (!off || (c.projectType !== 'interior' && c.projectType !== 'both')) return '';
  if (c.cabinets !== 'none') return 'cabinets';
  if (c.stairwayDetails === 'railings_only') return 'railing';
  if (c.fireplaceType === 'mantel_only') return 'mantel';
  if (c.specialtyServices.includes('built_ins') && c.closets === 'none') return 'builtins';
  return '';
}

/** The job is only a few trim details or some furniture, and the customer said so: no "add the ceilings?" suggestions. */
const skipUpsells = (c: EstimatorContext) =>
  c.itemsOnly || componentKind(c) !== '' || isIsolatedDetailJob(c) || (c.interiorWalls === 'no' && c.interiorCeilings === 'no' && c.surfacesAddressed && (c.furnitureItems.length > 0 || c.closets !== 'none'));

const isCommercialLike = (c: EstimatorContext) => c.propertyType === 'commercial' || c.propertyType === 'multi_unit';

// ===== Topic list (priority order) =====

/**
 * The whole job is things that stand apart from a house (a shed, a deck, a fence, patio furniture, an overhang, a piece of furniture):
 * whether the customer lives there, rents or owns it, and whether the home is occupied or empty, don't matter for those.
 */
export function isStandaloneOnlyJob(c: EstimatorContext): boolean {
  if (c.standaloneStructure || c.itemsOnly || componentKind(c) !== '') return true;
  if (c.projectType === 'exterior' && c.exteriorBody === 'no') return true;
  const furnitureOnly = c.furnitureItems.length > 0 && c.selectedRooms.length === 0 && c.interiorScope === '' && !c.squareFeet && !c.bedroomCount;
  return furnitureOnly && (c.projectType === 'interior' || c.projectType === '');
}

/** An outside job (the house itself, not just a fence or a deck): the exterior interview applies. */
function isExteriorJob(c: EstimatorContext): boolean {
  return (c.projectType === 'exterior' || c.projectType === 'both') && c.exteriorBody !== 'no' && !c.standaloneStructure;
}

/** Something is actually being painted (not just washed), so the paint questions apply. */
function paintingJob(c: EstimatorContext): boolean {
  if (!c.projectType) return false;
  const washOnly = c.projectType === 'exterior' && c.exteriorBody === 'no' && c.prepWork.includes('power_washing') && c.fence === 'none' && c.deck === 'none' && !c.standaloneStructure;
  return !washOnly;
}

/** An exterior question (ext_*) the customer has already answered. */
function extDone(c: EstimatorContext, id: string): boolean {
  return (c.extAnswered ?? []).includes(id);
}

export const TOPICS: Topic[] = [
  // ——————————————————————————————————————————
  // Project type — only ask if truly ambiguous
  // ——————————————————————————————————————————
  {
    id: 'project_type',
    priority: 10,
    relevant: () => true,
    alreadyAnswered: (c) => !!c.projectType,
    ask: (c) =>
      pick(
        [
          "Quick one, is this interior, exterior, or both?",
          "Are we working on the inside, the outside, or both?",
          "Is this interior or exterior painting?",
          "Are we painting the inside, the outside, or both?",
          "What are we tackling, the inside, the outside, or both?",
          "Just so I scope this right, is it inside, outside, or both?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Interior means inside the house — walls, ceilings, trim, etc. Exterior means the outside — siding, trim, fascia, that sort of thing.",
    example: () =>
      "For instance: 'interior' would be painting the bedrooms and living room. 'Exterior' would be painting the outside of the house.",
  },

  // ——————————————————————————————————————————
  // Multi-unit properties (duplex, apartment building, townhomes...): inside or outside first (project_type, above), then how many units are
  // being painted (inside) or how many buildings there are (outside). The other inside questions are then about a typical unit, asked once.
  // ——————————————————————————————————————————
  {
    id: 'unit_count',
    priority: 12,
    relevant: (c) => c.propertyType === 'multi_unit' && (c.projectType === 'interior' || c.projectType === 'both') && c.unitCount == null,
    alreadyAnswered: (c) => c.unitCount != null || extDone(c, 'unit_count'),
    ask: (c) =>
      c.unitsTotal
        ? "You mentioned " + c.unitsTotal + " units. Are all " + c.unitsTotal + " being painted, or only some of them? A number is fine, like 'all " + c.unitsTotal + "' or 'just two'."
        : pick(
          ["How many units are being painted? A number is fine, like '12', 'all 8' or 'two of the six'.", "How many units are we painting? Just give me a number, like '6' or 'all 10'."],
          seed(c),
        ),
    clarify: () => "I price one typical unit and then work out the rest from how many units there are, since identical units go faster and cost less each than a one-off job.",
    example: () => "Something like '12', 'all 8', 'a dozen' or 'just two of the six'.",
  },
  {
    id: 'building_count',
    priority: 12.5,
    relevant: (c) => c.propertyType === 'multi_unit' && (c.projectType === 'exterior' || c.projectType === 'both') && c.buildingCount == null,
    alreadyAnswered: (c) => c.buildingCount != null || extDone(c, 'building_count'),
    ask: () => "How many buildings are being painted? A number is fine.",
    clarify: () => "Each building needs its own setup and access equipment, so the number of buildings matters as much as their size.",
    example: () => "Something like '1', '3 buildings' or 'two'.",
  },
  {
    id: 'ceiling_height',
    priority: 30.2,
    relevant: (c) =>
      (c.projectType === 'interior' || c.projectType === 'both') &&
      c.surfacesAddressed &&
      (c.interiorWalls !== 'no' || c.interiorCeilings !== 'no' || c.crownMolding === 'yes') &&
      !c.ceilingHeightKnown,
    alreadyAnswered: (c) => !!c.ceilingHeightKnown || c.ceilingHeight !== 'standard' || extDone(c, 'ceiling_height'),
    ask: (c) =>
      c.propertyType === 'multi_unit' && c.unitCount != null
        ? "In a typical unit, is it standard ceiling height (around 8 feet)? If not, about how tall are they: 9 ft, 10 ft, 12 ft or more, or vaulted?"
        : pick(
          [
            "Is it standard ceiling height, around 8 feet? If not, about how tall are they (9 ft, 10 ft, 12 ft or more, or vaulted)?",
            "Are the ceilings standard height (about 8 feet), or higher? If higher, roughly how tall: 9 ft, 10 ft, 12 ft or more, or vaulted?",
          ],
          seed(c),
        ),
    clarify: () => "Taller ceilings mean more wall area and, above about 9 to 10 feet, ladders or scaffolding and slower work, so the height changes the price.",
    example: () => "Say 'yes, standard', '9 ft', '10 foot ceilings', '12 ft or more', 'vaulted' or just 'high ceilings'.",
  },
  {
    // Hallways, stairwells, lobbies and laundry rooms are extra scope on a multi-unit job.
    id: 'common_areas',
    priority: 31.5,
    relevant: (c) => c.propertyType === 'multi_unit' && (c.projectType === 'interior' || c.projectType === 'both') && c.unitCount != null,
    alreadyAnswered: (c) => c.commonAreas !== '' || extDone(c, 'common_areas'),
    ask: () => "Are the common areas part of the job too, like the hallways, stairwells, lobby or laundry room?",
    clarify: () => "Hallways, stairwells, lobbies and laundry rooms are painted separately from the units, usually with more protection and access work, so I price them as their own item.",
    example: () => "Say 'yes, the hallways and stairwells' or 'no, just the units'.",
  },
  {
    id: 'balcony_count',
    priority: 34.9,
    relevant: (c) => c.balconies === 'yes' && c.balconyCount == null,
    alreadyAnswered: (c) => c.balconyCount != null || extDone(c, 'balcony_count'),
    ask: (c) => (c.propertyType === 'multi_unit' ? "About how many balconies are there in all, across the buildings?" : "About how many balconies are there?"),
    clarify: () => "Each balcony is priced on its own (floor and railing), so I need a rough count.",
    example: () => "Something like '12 balconies' or 'about 24'.",
  },
  {
    // Outside on a multi-unit property: the parts that are not the wall.
    id: 'ext_mu_access',
    priority: 48.97,
    relevant: (c) => c.propertyType === 'multi_unit' && isExteriorJob(c) && c.balconies === 'none' && c.railings === 'none',
    alreadyAnswered: (c) => c.balconies !== 'none' || c.railings !== 'none' || extDone(c, 'ext_mu_access'),
    ask: () => "Do the buildings have balconies, outside stairwells, railings or breezeways that need painting too?",
    clarify: () => "On apartment buildings these are often a big part of the job: balcony floors and railings, exterior stairs and landings, and walkways.",
    example: () => "Say 'yes, balconies and the stairs' or 'no, just the walls'.",
  },
  // ——————————————————————————————————————————
  // Room selection
  // ——————————————————————————————————————————
  {
    id: 'which_rooms',
    priority: 15,
    relevant: (c) => c.projectType === 'interior' || c.projectType === 'both',
    alreadyAnswered: (c) =>
      c.interiorScope === 'whole_house' || c.selectedRooms.length > 0 || isNarrowInteriorJob(c),
    ask: (c) => {
      const t = c.additionalDetails.toLowerCase();
      const vague = /(a room|just a room|one room)/.test(t);
      if (vague) {
        return "Got it, which room?";
      }
      return pick(
        [
          "Which rooms are we painting?",
          "Which room or rooms should we price out?",
          "What rooms are on the list?",
          "Which spaces are we covering?",
          "What rooms are getting painted?",
          "What all needs paint?",
        ],
        seed(c),
      );
    },
    clarify: () =>
      "Just give me the type of room — 'master bedroom', 'kids room', 'kitchen', 'living room'. Whatever you've got.",
    example: () =>
      "Like 'master bedroom and kids room' or 'just the kitchen' or 'living room, dining room, hallway'.",
  },

  // ——————————————————————————————————————————
  // Room size — ask after we know which room, if still vague
  // ——————————————————————————————————————————
  {
    id: 'room_size',
    priority: 20,
    relevant: (c) =>
      c.projectType !== 'exterior' &&
      c.interiorScope === 'specific_rooms' &&
      c.selectedRooms.length === 1 &&
      !c.squareFeet,
    alreadyAnswered: (c) => {
      const d = c.additionalDetails.toLowerCase();
      return !!(c.squareFeet || /\b(small|medium|large|\d+x\d+|\d+\s*sq)/.test(d));
    },
    ask: (c) => {
      const label = roomLabel(c.selectedRooms[0]);
      return pick(
        [
          `About how big is that ${label}? Small, medium, large, or do you happen to know the dimensions?`,
          `How big is the ${label} — rough size or actual dimensions, either works.`,
          `What size ${label} are we talking? Small, medium, or large is fine if you don't know exact numbers.`,
        ],
        seed(c),
      );
    },
    clarify: () =>
      "Rough idea is fine — small is about 10×10, medium is 12×14, large is 16×18 or bigger. If you know exact dimensions that's even better.",
    example: () =>
      "You could say 'small', or '11 by 12', or '144 square feet', or 'medium size, probably 12 by 12'.",
  },

  // ——————————————————————————————————————————
  // Whole-house / whole-space square footage
  // ——————————————————————————————————————————
  {
    id: 'house_size',
    priority: 22,
    relevant: (c) =>
      c.projectType !== 'exterior' &&
      c.interiorScope === 'whole_house' &&
      !c.squareFeet &&
      !isNarrowInteriorJob(c),
    alreadyAnswered: (c) => !!c.squareFeet,
    ask: (c) => {
      if (c.propertyType === 'multi_unit' && c.unitCount != null) {
        return "About how big is a typical unit, in square feet? If they vary, give me the sizes you know (like 'studios 500, one-bedrooms 700, twos 950', or with how many of each) and I'll work out the average. Or how many bedrooms?";
      }
      if (isCommercialLike(c)) {
        return pick(
          [
            "About how big is the space, in total square feet?",
            "What's the total square footage we're working with?",
            "Roughly how many square feet is the space?",
          ],
          seed(c),
        );
      }
      if (c.bedroomCount) {
        return pick(
          [
            "And about how many square feet is the place?",
            "Got the bedroom count. Do you also know roughly how many square feet it is?",
          ],
          seed(c),
        );
      }
      return pick(
        [
          "About how big is the place?",
          "Roughly how big is it?",
          "What's the size of the place?",
        ],
        seed(c),
      );
    },
    clarify: (c) =>
      isCommercialLike(c)
        ? "I'll use it to estimate the total wall + ceiling area — a rough square footage is fine."
        : "I'll use it to estimate the total wall + ceiling area. You can say something like '1,800 square feet' or '3 bedroom 2 bath'.",
    example: (c) =>
      isCommercialLike(c)
        ? "E.g., '3000 sqft' or 'not sure, maybe 5000?'"
        : "E.g., '1500 sqft' or '4 bedrooms' or 'not sure, maybe 2000?'",
  },

  // ——————————————————————————————————————————
  // Surfaces — what in the room(s) is getting painted
  // ——————————————————————————————————————————
  {
    id: 'surfaces',
    priority: 25,
    relevant: (c) => c.projectType === 'interior' || c.projectType === 'both',
    alreadyAnswered: (c) =>
      // Answered once ANY surface scope field has moved off its default —
      // this used to require interiorWalls === 'yes' specifically, which
      // "trim only" (walls: no, ceilings: no, trim: yes, doors: none) never
      // satisfies, so the topic kept re-asking a scope the customer had
      // already given. surfacesAddressed covers the OPPOSITE gap: a
      // narrative "everything" confirmation (e.g. "ceilings painted, walls
      // painted, trim and doors painted") that never sets any field to
      // "no"/"none" at all, since that IS the (identical-looking) default —
      // see the field comments in types.ts.
      c.surfacesAddressed ||
      c.interiorWalls === 'no' ||
      c.additionalDetails.toLowerCase().includes('walls only') ||
      c.additionalDetails.toLowerCase().includes('whole room'),
    ask: (c) => {
      // Part of the answer is known ("no trim"): ask about the rest instead of assuming walls only.
      if (c.interiorTrim === 'no' && c.interiorCeilings !== 'no' && c.interiorDoors !== 'none') {
        return "No trim, got it. What about the ceilings and the doors, are those getting painted?";
      }
      if (c.interiorCeilings === 'no' && c.interiorTrim !== 'no') {
        return "No ceilings, got it. And the trim and doors, are those getting painted too?";
      }
      if (c.propertyType === 'multi_unit' && c.unitCount != null) return 'In a typical unit, what all is getting painted (walls, ceilings, trim, doors)?';
      const hasKitchen = c.selectedRooms.includes('kitchen');
      if (hasKitchen) {
        return "For the kitchen, what all is getting painted, and are the cabinets included?";
      }
      return 'Which surfaces are we painting?';
    },
    clarify: () =>
      "Some folks just want walls refreshed. Others want the whole package — walls, ceiling, trim, doors, closets. Either works. You can also mix and match.",
    example: () =>
      "'Just walls' is common. Or 'walls and ceiling, no trim'. Or 'everything except the doors'.",
  },

  // ——————————————————————————————————————————
  // Exterior interview: size, then what else beyond the siding gets painted (one question each), the windows, the shape the
  // outside is in and the repairs it needs, and the color. Each is asked once; location and timing come after.
  // ——————————————————————————————————————————
  {
    id: 'ext_size',
    priority: 46,
    relevant: (c) => (isExteriorJob(c) || !!c.standaloneStructure) && !c.squareFeet && !c.bedroomCount,
    alreadyAnswered: (c) => !!c.squareFeet || !!c.bedroomCount,
    ask: (c) =>
      c.standaloneStructure
        ? `About how big is the ${c.standaloneStructure}, in square feet? Or its length and width.`
        : c.propertyType === 'multi_unit'
        ? 'About how big are the buildings, in total square feet of all of them together? Or the number of units and roughly how big each is.'
        : pick(
        [
          'About how big is the house, in square feet?',
          "Roughly how many square feet is the house? A rough number is fine.",
        ],
        seed(c),
      ),
    clarify: () => "The size of the house (the living space, not the lot) is what I use to estimate how much surface there is to paint.",
    example: () => "Something like '2,000 square feet', or '4 bedrooms' if you don't know the number.",
  },
  {
    id: 'ext_trim',
    priority: 48.1,
    relevant: (c) => isExteriorJob(c) && c.exteriorTrim !== 'yes' && c.soffitsEaves !== 'yes',
    alreadyAnswered: (c) => c.exteriorTrim === 'yes' || c.soffitsEaves === 'yes' || extDone(c, 'ext_trim'),
    ask: (c) =>
      pick(
        [
          "Are we painting the trim, fascia, soffits and eaves too?",
          "What about the trim, fascia, eaves and soffits, are those getting painted?",
        ],
        seed(c),
      ),
    clarify: () => "That's the boards around the roofline and around the windows and doors (trim and fascia), plus the underside of the roof overhang (eaves and soffits). They're usually painted along with the siding.",
    example: () => "Just say 'yes, all of it' or 'no, just the siding'.",
  },
  {
    id: 'ext_doors',
    priority: 48.2,
    relevant: (c) => isExteriorJob(c) && c.entryDoor !== 'yes',
    alreadyAnswered: (c) => c.entryDoor === 'yes' || extDone(c, 'ext_doors'),
    ask: (c) => pick(["What about the front door, is that getting painted?", "Is the front door part of the job?"], seed(c)),
    clarify: () => "I mean the front entry door, and any other exterior doors you want painted.",
    example: () => "Just say 'yes, the front door' or 'no'.",
  },
  {
    id: 'ext_garage',
    priority: 48.3,
    relevant: (c) => isExteriorJob(c) && c.garageDoor === 'none',
    alreadyAnswered: (c) => c.garageDoor !== 'none' || extDone(c, 'ext_garage'),
    ask: (c) => pick(["And the garage door?", "Does the garage door get painted too?"], seed(c)),
    clarify: () => "Garage doors are painted separately from the walls, so I want to know whether to include them.",
    example: () => "Just say 'yes, one garage door', 'yes, two' or 'no'.",
  },
  {
    id: 'ext_garage_count',
    priority: 48.35,
    relevant: (c) => (isExteriorJob(c) || c.exteriorBody === 'no') && c.garageDoor === 'single',
    alreadyAnswered: (c) => c.garageDoor === 'double' || extDone(c, 'ext_garage_count'),
    ask: () => 'Is that one garage door, or two?',
    clarify: () => "A two-car garage often has two single doors or one wide double door; either way I just need to know how many there are.",
    example: () => "Just say 'one' or 'two'.",
  },
  {
    id: 'ext_gutters',
    priority: 48.4,
    relevant: (c) => isExteriorJob(c) && c.gutters !== 'yes',
    alreadyAnswered: (c) => c.gutters === 'yes' || extDone(c, 'ext_gutters'),
    ask: (c) => pick(["Do the gutters and downspouts need painting too?", "What about the gutters and downspouts, are those getting painted?"], seed(c)),
    clarify: () => "Gutters and downspouts can be painted to match the house.",
    example: () => "Just say 'yes, the gutters too' or 'no'.",
  },
  {
    id: 'ext_windows',
    priority: 48.6,
    relevant: (c) => isExteriorJob(c) && c.exteriorWindows === 'none',
    alreadyAnswered: (c) => c.exteriorWindows !== 'none' || extDone(c, 'ext_windows'),
    ask: (c) => pick(["What kind of windows does the house have? Vinyl windows don't need painting.", "What are the windows made of?"], seed(c)),
    clarify: () => "Vinyl windows are usually left alone. Wood windows (and French-pane windows with lots of little panes) take real painting time, and aluminum frames sometimes just need the trim around them done.",
    example: () => "Just say 'vinyl', 'wood', 'aluminum', 'French pane', or 'a mix'.",
  },
  {
    id: 'ext_window_count',
    priority: 48.7,
    relevant: (c) => isExteriorJob(c) && c.exteriorWindows !== 'none' && !c.exteriorWindowCount,
    alreadyAnswered: (c) => !!c.exteriorWindowCount || extDone(c, 'ext_window_count'),
    ask: (c) => pick(["About how many windows are getting painted?", "How many windows would that be?"], seed(c)),
    clarify: () => "A rough count of the windows that need painting is fine.",
    example: () => "Something like '12 windows' or 'about 20'.",
  },
  {
    id: 'ext_condition',
    priority: 48.8,
    relevant: (c) => isExteriorJob(c),
    alreadyAnswered: (c) => extDone(c, 'ext_condition'),
    ask: (c) => pick(["How is the paint holding up on the outside right now?", "What shape is the outside in right now?"], seed(c)),
    clarify: () => "I mean whether the paint is in decent shape, or fading, peeling or flaking. Peeling paint needs extra prep.",
    example: () => "Something like 'it's faded but fine' or 'peeling in a few spots'.",
  },
  {
    id: 'ext_repairs',
    priority: 48.9,
    relevant: (c) => isExteriorJob(c),
    alreadyAnswered: (c) => extDone(c, 'ext_repairs'),
    ask: (c) => pick(["Is there any repair work needed before painting?", "Any repairs needed first, like rotted wood, cracks or gaps?"], seed(c)),
    clarify: () => "Repairs are things like rotted wood to replace, cracks in the stucco, or gaps that need caulking before the paint goes on.",
    example: () => "Something like 'a few rotted boards' or 'no repairs needed'.",
  },
  {
    id: 'ext_color',
    priority: 49,
    relevant: (c) => isExteriorJob(c),
    alreadyAnswered: (c) => !!c.exteriorColorChange || extDone(c, 'ext_color'),
    ask: (c) => pick(["Is the house staying the same color, or going a different color?", "Are you keeping the current color, or changing it?"], seed(c)),
    clarify: () => "A new color usually takes an extra coat, and a big change like dark to light takes more.",
    example: () => "Just say 'same color' or 'a different color'.",
  },

  // ——————————————————————————————————————————
  // The paint itself: a brand if they have one, how nice, and the finish. These change the price (premium paint costs more, and a
  // customer who says the painter can choose gets the usual mid-grade assumption) and are passed to painters.
  // ——————————————————————————————————————————
  {
    id: 'paint_brand',
    priority: 37,
    relevant: (c) => paintingJob(c),
    alreadyAnswered: (c) => !!c.paintBrand || extDone(c, 'paint_brand'),
    ask: (c) =>
      pick(
        [
          'Do you have a paint brand in mind, or should the painter choose?',
          'Is there a paint brand you prefer, or is it up to the painter?',
        ],
        seed(c),
      ),
    clarify: () => "Some customers love a particular brand, like Sherwin-Williams, Benjamin Moore or Behr. If you don't have a preference, the painter picks a good one.",
    example: () => "Just say a brand like 'Benjamin Moore', or 'painter's choice'.",
  },
  {
    id: 'paint_grade',
    priority: 38,
    relevant: (c) => paintingJob(c),
    alreadyAnswered: (c) => !!c.paintGrade || extDone(c, 'paint_grade') || c.paintBrand === 'painter_choice', // "the painter can choose" covers the grade too (a grade they volunteer is still noted)
    ask: (c) =>
      pick(
        [
          'Would you like standard mid-grade paint, or a premium line?',
          'Standard mid-grade paint, or a deluxe premium paint?',
        ],
        seed(c),
      ),
    clarify: () => "Standard mid-grade paint is what most painters use and holds up well. Premium lines (like Emerald or Aura) cost more per gallon but cover better, last longer and look richer.",
    example: () => "Just say 'standard', 'premium', or 'budget'.",
  },
  {
    id: 'paint_finish',
    priority: 39,
    relevant: (c) => paintingJob(c),
    alreadyAnswered: (c) => !!c.paintFinish || extDone(c, 'paint_finish') || c.paintBrand === 'painter_choice', // ...and the finish
    ask: (c) =>
      pick(
        [
          'Do you have a finish in mind, or should the painter pick the right one for each surface?',
          'Any particular finish you want, or is the painter free to choose?',
        ],
        seed(c),
      ),
    clarify: () => "The finish is how shiny the paint is: flat or matte, eggshell, satin, semi-gloss or gloss. Painters normally choose the right one for each surface, like flat on ceilings and semi-gloss on trim.",
    example: () => "Just say 'eggshell', 'satin', or 'painter's choice'.",
  },

  // ——————————————————————————————————————————
  // Building up the job: if only some surfaces were named ("just walls"), suggest the rest one at a time (ceilings, then
  // baseboards, then doors) the way a good salesperson would, each only once, and never one the customer ruled out.
  // ——————————————————————————————————————————
  {
    id: 'upsell_ceilings',
    priority: 27,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorCeilings === 'no' && !(c.excludedSurfaces ?? []).includes('ceilings') && !skipUpsells(c),
    alreadyAnswered: (c) => c.interiorCeilings !== 'no',
    ask: (c) =>
      pick(
        [
          "Want me to add the ceilings too? Fresh ceilings make fresh walls look even better.",
          "Should we include the ceilings? They're easy to do while we're already painting the walls.",
        ],
        seed(c),
      ),
    clarify: () => "I mean painting the ceilings in those rooms along with the walls. It's quick to add while the crew is already there.",
    example: () => "Just say 'yes, add the ceilings' or 'no, leave the ceilings'.",
  },
  {
    id: 'upsell_trim',
    priority: 28,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorTrim === 'no' && !(c.excludedSurfaces ?? []).includes('trim') && !skipUpsells(c),
    alreadyAnswered: (c) => c.interiorTrim !== 'no',
    ask: (c) =>
      pick(
        [
          "How about the baseboards? Crisp, clean baseboards give the whole room a finished look.",
          "What about the baseboards? Fresh ones frame the new wall color nicely.",
        ],
        seed(c),
      ),
    clarify: () => "Baseboards are the trim along the bottom of the walls. Painting them along with the walls gives a cleaner, finished result.",
    example: () => "Just say 'yes, the baseboards too' or 'no, leave them'.",
  },
  {
    id: 'upsell_doors',
    priority: 29,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorDoors === 'none' && !skipUpsells(c) && !(c.excludedSurfaces ?? []).includes('doors') && !(c.excludedSurfaces ?? []).includes('trim'), // turned down the baseboards: nobody paints doors without trim, so don't suggest them (the closing "anything else?" still lets them mention doors)
    alreadyAnswered: (c) => c.interiorDoors !== 'none',
    ask: (c) =>
      pick(
        [
          "And the doors? Freshly painted doors tie the whole room together.",
          "Would you like the doors done too? It's the finishing touch that makes a room look new.",
        ],
        seed(c),
      ),
    clarify: () => "I mean the interior doors in those rooms. Painting them at the same time as everything else keeps the whole space looking consistent.",
    example: () => "Just say 'yes, do the doors' or 'no, skip the doors'.",
  },

  {
    // A whole inside, or a kitchen, with the trim in: the cabinets are the next thing worth asking about (they are the biggest single add-on there).
    id: 'upsell_cabinets',
    priority: 29.5,
    relevant: (c) =>
      (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorTrim === 'yes' && c.cabinets === 'none' &&
      (c.interiorScope === 'whole_house' || c.selectedRooms.includes('kitchen')) &&
      !(c.excludedSurfaces ?? []).includes('cabinets'),
    alreadyAnswered: (c) => c.cabinets !== 'none',
    ask: (c) =>
      pick(
        [
          "And the kitchen cabinets? Painted cabinets are the biggest makeover in the house. Want them included?",
          "Are the kitchen cabinets part of this too? They're a big job on their own, so I'd like to price them in if so.",
        ],
        seed(c),
      ),
    clarify: () => "I mean the kitchen cabinets: the doors and drawer fronts and the frames. Painting them is its own line in the price, so it helps to know if you want it.",
    example: () => "Just say 'yes, the kitchen cabinets too', 'cabinets in the kitchen and bathrooms', or 'no, leave the cabinets'.",
  },

  {
    // Cabinets and vanities: what they are finished with now decides the prep (bare wood needs primer, stained wood must be deglossed and sealed against bleed-through,
    // factory-primed needs the least, laminate needs a special adhesion primer), so it changes the price.
    id: 'cabinet_finish',
    priority: 29.8,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.cabinets !== 'none',
    alreadyAnswered: (c) => c.cabinetFinish !== '',
    ask: (c) =>
      pick(
        [
          "Are the cabinets (and any vanities) already painted? If not, what are they now: bare wood, stained or varnished wood, or pre-primed?",
          "Have the cabinets been painted before? If they haven't, are they bare wood, stained, or already primed?",
        ],
        seed(c),
      ),
    clarify: () => "The current finish changes the prep. Painted ones just need a good clean and sanding. Bare wood needs primer first, and stained or varnished wood has to be deglossed and sealed with a stain-blocking primer so the stain doesn't bleed through the paint.",
    example: () => "E.g., 'they're painted white now', 'bare wood', 'stained oak', 'pre-primed', or 'laminate'.",
  },

  // Cabinets as the whole job (no walls, ceilings, trim or doors): the questions that are about the cabinets themselves.
  {
    id: 'cabinet_count',
    priority: 29.7,
    relevant: (c) => componentKind(c) === 'cabinets' && c.cabinetDoorCount == null,
    alreadyAnswered: (c) => c.cabinetDoorCount != null || extDone(c, 'cabinet_count'),
    ask: (c) => pick(["About how many cabinet doors and drawer fronts are there? A rough count is fine.", "Roughly how many doors and drawers are we talking about?"], seed(c)),
    clarify: () => "Cabinets are priced by the door and drawer front, so a rough count (count each door and each drawer face) gets the price close.",
    example: () => "Something like '30 doors and drawers' or 'about 24'.",
  },
  {
    id: 'cabinet_scope',
    priority: 29.82,
    relevant: (c) => componentKind(c) === 'cabinets' && c.cabinetScope !== 'inside_too',
    alreadyAnswered: (c) => c.cabinetScope === 'inside_too' || extDone(c, 'cabinet_scope'),
    ask: (c) => pick(["Do you want the inside of the cabinet boxes painted too, or just the doors, drawer fronts and frames?", "Just the outsides (doors, drawer fronts, frames), or the insides of the boxes as well?"], seed(c)),
    clarify: () => "Painting the insides adds a lot of time (tight spaces, more coats), so it costs more. Most people paint just the outsides.",
    example: () => "Say 'outsides only' or 'yes, the insides too'.",
  },
  {
    id: 'cabinet_method',
    priority: 29.84,
    relevant: (c) => componentKind(c) === 'cabinets' && !c.cabinetMethod,
    alreadyAnswered: (c) => !!c.cabinetMethod || extDone(c, 'cabinet_method'),
    ask: (c) => pick(["Sprayed for the smoothest, factory-like finish, or brushed and rolled?", "Do you want them sprayed or brushed and rolled? Spraying looks smoother and costs more."], seed(c)),
    clarify: () => "Spraying gives a smooth, factory-like finish with no brush marks but takes more masking and set-up, so it costs more. Brushed and rolled is the standard way and still looks good.",
    example: () => "Say 'sprayed', 'brushed is fine', or 'painter's choice'.",
  },
  {
    id: 'cabinet_hardware',
    priority: 29.86,
    relevant: (c) => componentKind(c) === 'cabinets' && c.hardwareReplacement !== 'yes',
    alreadyAnswered: (c) => c.hardwareReplacement === 'yes' || extDone(c, 'cabinet_hardware'),
    ask: (c) => pick(["Are the hinges and pulls staying, or are you putting in new hardware?", "What about the hardware: reuse the existing hinges and pulls, or replace them?"], seed(c)),
    clarify: () => "The painter takes the hardware off and puts it back as part of the job. Installing new hinges or pulls is a separate small charge (the hardware itself is extra).",
    example: () => "Say 'keep the hardware' or 'new pulls and hinges'.",
  },
  {
    id: 'builtin_count',
    priority: 29.7,
    relevant: (c) => componentKind(c) === 'builtins' && c.builtInCount == null,
    alreadyAnswered: (c) => c.builtInCount != null || extDone(c, 'builtin_count'),
    ask: (c) => pick(["How many built-in units or sections are there?", "About how many built-ins or shelving sections are we painting?"], seed(c)),
    clarify: () => "Each built-in or shelving section is priced on its own, so a rough count is what I need.",
    example: () => "Something like '2 built-in bookcases' or 'one wall of shelves'.",
  },

  {
    // The same question for the baseboards/trim and the doors: bare wood needs primer, stained or varnished wood must be deglossed and sealed, painted needs the least.
    id: 'trim_door_finish',
    priority: 29.9,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && (c.interiorTrim === 'yes' || c.interiorDoors !== 'none'),
    alreadyAnswered: (c) => (c.interiorTrim !== 'yes' || c.trimFinish !== '') && (c.interiorDoors === 'none' || c.doorFinish !== ''),
    ask: (c) => {
      const what = c.interiorTrim === 'yes' && c.interiorDoors !== 'none' ? 'baseboards, trim and doors' : c.interiorTrim === 'yes' ? 'baseboards and trim' : 'doors';
      const are = c.interiorTrim === 'yes' && c.interiorDoors !== 'none' ? 'are' : 'is';
      return pick(
        [
          `Are the ${what} already painted? If not, ${are === 'are' ? 'are they' : 'is it'} bare wood, stained or varnished wood, or pre-primed?`,
          `Have the ${what} been painted before, or ${are === 'are' ? 'are they' : 'is it'} bare, stained, or already primed?`,
        ],
        seed(c),
      );
    },
    clarify: () => "The current finish changes the prep. Painted trim and doors just need a clean and a light sanding. Bare wood needs primer first, and stained or varnished wood has to be deglossed and sealed with a stain-blocking primer so it doesn't bleed through.",
    example: () => "E.g., 'all painted white', 'bare wood', 'stained oak doors, painted baseboards', or 'pre-primed'.",
  },

  // ——————————————————————————————————————————
  // How many, how long, how big: the counts and sizes behind the items the customer named (doors, windows, chairs, closets, shutters,
  // fences, decks, overhangs, railings) and the small trim details (crown moulding, chair rail, wainscoting, baseboards). A guess from the
  // size of the house is the fallback; these make the price match what is actually there. Each is asked once, and only when the item is in.
  // ——————————————————————————————————————————
  {
    id: 'door_count',
    priority: 29.91,
    relevant: (c) =>
      (c.projectType === 'interior' || c.projectType === 'both') && c.interiorDoors !== 'none' && (!!c.doorsIncluded || (c.addedSurfaces ?? []).includes('doors')) && c.doorCount == null,
    alreadyAnswered: (c) => c.doorCount != null || extDone(c, 'door_count'),
    ask: (c) => pick(["About how many doors are getting painted? A rough count is fine.", "And roughly how many doors is that?", "How many doors are we talking about, approximately?"], seed(c)),
    clarify: () => "Each door is priced on its own (both sides and the edges), so a rough count of the interior doors that need paint makes the price much closer.",
    example: () => "Something like '12 doors' or 'about 8'.",
  },
  {
    id: 'window_count',
    priority: 29.92,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.interiorWindows !== 'none' && c.windowCount == null,
    alreadyAnswered: (c) => c.windowCount != null || extDone(c, 'window_count'),
    ask: (c) => pick(["About how many windows are getting painted?", "How many windows would that be, roughly?"], seed(c)),
    clarify: () => "I price the window frames, sills and trim one window at a time, so a rough count helps.",
    example: () => "Something like '10 windows' or 'about 15'.",
  },
  {
    id: 'closet_count',
    priority: 29.93,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.closets !== 'none' && c.closetCount == null,
    alreadyAnswered: (c) => c.closetCount != null || extDone(c, 'closet_count'),
    ask: (c) => (c.closetShelving !== 'none' ? "How many closets have shelves that need painting?" : "How many closets are getting painted?"),
    clarify: () => "Closets (and the shelves and rods in them) are priced each, so a rough count is what I need.",
    example: () => "Something like '3 closets' or 'just one'.",
  },
  {
    id: 'chair_count',
    priority: 29.94,
    relevant: (c) => (c.itemsOnly && c.furnitureItems.length > 0 && !c.furnitureCountKnown) || (c.furnitureItems.includes('chair') && c.chairCount == null && !c.furnitureCountKnown),
    alreadyAnswered: (c) => c.chairCount != null || c.furnitureCountKnown || extDone(c, 'chair_count'),
    ask: (c) => {
      const kinds = [...new Set(c.furnitureItems)];
      if (kinds.length > 1) return "How many of each piece are we painting? Something like '4 chairs and a table'.";
      const noun = kinds[0] === 'chair' || kinds.length === 0 ? 'chairs' : itemsPhrase([kinds[0], kinds[0]]).replace(/^2 /, '');
      return pick([`About how many ${noun} are getting done?`, `How many ${noun} is that?`], seed(c));
    },
    clarify: () => "Each piece is priced on its own (chairs take a lot of cutting in around the spindles and legs), so I need a rough count.",
    example: () => "Something like '6 chairs', 'four', or '2 chairs and a table'.",
  },
  {
    // "furniture" with no piece named
    id: 'furniture_kind',
    priority: 29.9,
    relevant: (c) => c.furnitureUnspecified && c.furnitureItems.length === 0,
    alreadyAnswered: (c) => c.furnitureItems.length > 0 || extDone(c, 'furniture_kind'),
    ask: (c) => pick(["What kind of furniture is it, and how many pieces?", "Which pieces are we painting? A dresser, table, chairs, something else?"], seed(c)),
    clarify: () => "I price each piece on its own (a chair, a dining table, a dresser, a bookcase and so on), so I need to know what they are.",
    example: () => "Something like '4 dining chairs and a table' or 'one dresser and two nightstands'.",
  },
  {
    // what is being done to the pieces: repaint, refresh the stain, strip and refinish
    id: 'furniture_finish',
    priority: 29.96,
    relevant: (c) => c.itemsOnly && c.furnitureItems.length > 0 && !c.furnitureTreatment,
    alreadyAnswered: (c) => !!c.furnitureTreatment || extDone(c, 'furniture_finish'),
    ask: (c) =>
      pick(
        [
          `What are the ${[...new Set(c.furnitureItems)].length > 1 ? 'pieces' : itemsPhrase([c.furnitureItems[0], c.furnitureItems[0]]).replace(/^2 /, '')} like now: painted, stained or bare wood? And do you want them repainted, restained or refinished?`,
          'Is the finish painted or stained right now, and do you want a new coat of paint, a fresh stain, or stripped back and refinished?',
        ],
        seed(c),
      ),
    clarify: () => "A fresh coat over sound paint is the quickest. Restaining or stripping back to bare wood takes sanding and more coats, so it costs more per piece.",
    example: () => "Something like 'painted white, repaint them black', 'stained oak, refresh the stain', or 'strip them down and refinish'.",
  },
  {
    id: 'shutter_count',
    priority: 29.95,
    relevant: (c) => (c.exteriorShutters === 'yes' && c.exteriorShutterCount == null) || (c.interiorShutters === 'yes' && c.interiorShutterCount == null),
    alreadyAnswered: (c) => ((c.exteriorShutters !== 'yes' || c.exteriorShutterCount != null) && (c.interiorShutters !== 'yes' || c.interiorShutterCount != null)) || extDone(c, 'shutter_count'),
    ask: (c) => (c.exteriorShutters === 'yes' ? "About how many shutters are getting painted?" : "About how many interior shutters are getting painted?"),
    clarify: () => "Shutters are priced one at a time (two panels make a pair), so a rough count is what I need.",
    example: () => "Something like '8 shutters' or '10'.",
  },
  {
    id: 'railing_length',
    priority: 34.8,
    relevant: (c) => c.railings === 'yes' && c.stairRailFeet == null && c.stairwayDetails !== 'railings_only',
    alreadyAnswered: (c) => c.stairRailFeet != null || extDone(c, 'railing_length'),
    ask: (c) => pick(["About how many linear feet of railing is it in total?", "Roughly how long is the railing, in feet?"], seed(c)),
    clarify: () => "Railings are priced by the linear foot, and spindles take longer than a plain rail. A rough length is fine, and you can add the spindles in your answer.",
    example: () => "Something like '30 feet' or '20 feet with spindles'.",
  },
  {
    id: 'fence_size',
    priority: 34.5,
    relevant: (c) => c.fence === 'yes' && (c.fenceLinearFeet == null || (c.fenceHeightFt == null && c.fenceType !== 'chain_link')),
    alreadyAnswered: (c) => (c.fenceLinearFeet != null && (c.fenceHeightFt != null || c.fenceType === 'chain_link')) || extDone(c, 'fence_size'),
    ask: (c) => {
      if (c.fenceLinearFeet != null) return "And how tall is the fence, roughly?";
      if (c.fenceHeightFt != null) return "About how long is the fence in total, in linear feet?";
      return pick(
        ["About how long is the fence in linear feet, and how tall is it?", "Roughly how many linear feet of fence is it, and how high does it stand?"],
        seed(c),
      );
    },
    clarify: () => "Fences are priced by the linear foot, and a taller fence has more surface to cover per foot, so I need the length and the height.",
    example: () => "Something like '150 feet, 6 feet tall' or '80 feet of 4 foot picket'.",
  },
  {
    id: 'fence_height',
    priority: 34.51,
    relevant: (c) => c.fence === 'yes' && c.fenceLinearFeet != null && c.fenceHeightFt == null && c.fenceType !== 'chain_link',
    alreadyAnswered: (c) => c.fenceHeightFt != null || extDone(c, 'fence_height'),
    ask: () => "And how tall is the fence, roughly?",
    clarify: () => "A taller fence has more surface to cover for every foot of length.",
    example: () => "Something like '6 feet' or '4 foot picket'.",
  },
  {
    id: 'deck_size',
    priority: 34.6,
    relevant: (c) => c.deck === 'yes' && c.deckSqft == null && !c.deckSize,
    alreadyAnswered: (c) => c.deckSqft != null || !!c.deckSize || extDone(c, 'deck_size'),
    ask: (c) => pick(["About how many square feet is the deck? Or just its length and width.", "Roughly how big is the deck, in square feet or length by width?"], seed(c)),
    clarify: () => "Decks are priced by the square foot, so the size matters. Length times width is fine, I'll do the math.",
    example: () => "Something like '400 square feet' or '20 x 20'.",
  },
  {
    id: 'overhang_size',
    priority: 34.7,
    relevant: (c) => c.overhangs === 'yes' && c.overhangSqft == null,
    alreadyAnswered: (c) => c.overhangSqft != null || extDone(c, 'overhang_size'),
    ask: (c) => pick(["About how many square feet is the overhang or patio cover? Length times width works too.", "Roughly how big is the overhang or patio cover, in square feet or length by width?"], seed(c)),
    clarify: () => "Overhangs, porch ceilings and patio covers are priced by the square foot of the underside, so the size matters.",
    example: () => "Something like '200 square feet' or '10 by 20'.",
  },
  {
    // Offered on an outside job, since a fence, a deck or a patio cover is often painted along with the house.
    id: 'ext_extras',
    priority: 48.95,
    relevant: (c) => isExteriorJob(c) && (c.fence === 'none' || c.deck === 'none' || c.overhangs === 'no'),
    alreadyAnswered: (c) => (c.fence !== 'none' && c.deck !== 'none' && c.overhangs !== 'no') || extDone(c, 'ext_extras'),
    ask: (c) =>
      pick(
        ["Is there a fence, a deck, or a patio cover or overhang that should get painted too?", "Anything else outside to add, like a fence, a deck or a patio cover?"],
        seed(c),
      ),
    clarify: () => "Fences, decks and patio covers are priced separately from the house, so I'd rather include them now than have the price come in short.",
    example: () => "Say 'yes, the fence and the deck' or 'no, just the house'.",
  },
  {
    id: 'ext_extras_which',
    priority: 48.96,
    relevant: (c) => extDone(c, 'ext_extras_yes') && c.fence === 'none' && c.deck === 'none' && c.overhangs === 'no',
    alreadyAnswered: (c) => c.fence !== 'none' || c.deck !== 'none' || c.overhangs !== 'no' || extDone(c, 'ext_extras_which'),
    ask: () => "Which one: the fence, the deck, or the patio cover or overhang?",
    clarify: () => "I'd like to know which of those you have so I can ask how big it is.",
    example: () => "Say 'the fence' or 'a deck and a patio cover'.",
  },
  {
    // A job that is only crown moulding, chair rail, wainscoting or baseboards ("just the new chair rail"): the number of rooms sizes it.
    id: 'detail_rooms',
    priority: 26.1,
    relevant: (c) => isIsolatedDetailJob(c) && c.detailRoomCount == null && c.selectedRooms.length === 0 && c.squareFeet == null,
    alreadyAnswered: (c) => c.detailRoomCount != null || c.selectedRooms.length > 0 || c.squareFeet != null || extDone(c, 'detail_rooms'),
    ask: (c) => `How many rooms is the ${detailLabel(c)} in?`,
    clarify: () => "With no walls or ceilings in the job, the number of rooms is how I work out roughly how much trim there is, unless you know the length.",
    example: () => "Something like '3 rooms' or 'just the dining room'.",
  },
  {
    id: 'detail_feet_chair_rail',
    priority: 26.2,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.chairRail === 'yes' && c.chairRailLinearFeet == null,
    alreadyAnswered: (c) => c.chairRailLinearFeet != null || extDone(c, 'detail_feet_chair_rail'),
    ask: (c) => (isIsolatedDetailJob(c) ? "About how many linear feet of chair rail is that in total? If you're not sure, say so and I'll work it out from the rooms." : "About how many linear feet of chair rail is there?"),
    clarify: () => "Chair rail is priced by the linear foot. Measuring along the wall where it runs, or adding up the rooms, gives the number.",
    example: () => "Something like '60 feet' or 'about 100 linear feet'.",
  },
  {
    id: 'detail_feet_crown',
    priority: 26.3,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.crownMolding === 'yes' && c.crownLinearFeet == null,
    alreadyAnswered: (c) => c.crownLinearFeet != null || extDone(c, 'detail_feet_crown'),
    ask: (c) => (isIsolatedDetailJob(c) ? "About how many linear feet of crown moulding is that in total? If you're not sure, say so and I'll work it out from the rooms." : "About how many linear feet of crown moulding is there?"),
    clarify: () => "Crown moulding is priced by the linear foot along the top of the walls.",
    example: () => "Something like '80 feet' or 'about 150 linear feet'.",
  },
  {
    id: 'detail_feet_trim',
    priority: 26.4,
    relevant: (c) => isIsolatedDetailJob(c) && c.interiorTrim === 'yes' && c.trimLinearFeet == null,
    alreadyAnswered: (c) => c.trimLinearFeet != null || extDone(c, 'detail_feet_trim'),
    ask: () => "About how many linear feet of baseboard or trim is that in total? If you're not sure, say so and I'll work it out from the rooms.",
    clarify: () => "Baseboards and trim are priced by the linear foot.",
    example: () => "Something like '200 feet'.",
  },
  {
    id: 'detail_sqft_wainscot',
    priority: 26.5,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.wainscoting === 'yes' && c.wainscotSqft == null,
    alreadyAnswered: (c) => c.wainscotSqft != null || extDone(c, 'detail_sqft_wainscot'),
    ask: () => "About how many square feet of wainscoting or paneling is that? You can also give the length and height, like '30 x 3'.",
    clarify: () => "Wainscoting is priced by the square foot of paneling: its length along the wall times its height.",
    example: () => "Something like '100 square feet' or '30 feet long by 3 feet high'.",
  },

  // ——————————————————————————————————————————
  // Trim scope — "trim" alone only prices baseboards; door frames/casings,
  // closet shelving, and built-ins are each separate line items, so ask
  // once trim is in scope rather than silently guessing.
  // ——————————————————————————————————————————
  {
    id: 'trim_scope',
    priority: 26,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.interiorTrim === 'yes' && (c.surfacesAddressed || c.trimLinearFeet != null || c.crownMolding === 'yes'),
    alreadyAnswered: (c) => c.trimScopeAddressed || c.trimLinearFeet != null || c.doorFrames === 'yes' || c.specialtyServices.includes('built_ins'),
    ask: (c) =>
      pick(
        [
          "Quick one on the trim, what does that include?",
          "When you say trim, what all does that cover?",
          "Just to price the trim right, what does it include?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Baseboards alone is one price. Door frames, casings, closet shelving, and built-ins each add their own labor, so it helps to know which ones apply.",
    example: () =>
      "'Just baseboards', 'baseboards and door frames', or 'everything — trim, doors, closets, all of it'.",
  },

  // ——————————————————————————————————————————
  // Condition — only ask if user hasn't already told us
  // ——————————————————————————————————————————
  {
    id: 'condition',
    priority: 30,
    relevant: (c) => c.projectType !== 'exterior' && c.projectCondition !== 'new_construction' && c.stairwayDetails !== 'railings_only' && c.cabinets === 'none',
    alreadyAnswered: (c) => {
      const t = c.additionalDetails.toLowerCase();
      return (
        c.conditionAddressed ||
        c.prepWork.length > 0 ||
        c.drywallRepairExtent === 'major' ||
        c.drywallRepairExtent === 'moderate' ||
        c.projectCondition === 'repaint' ||
        c.projectCondition === 'renovation' ||
        /\b(good|clean|great|fine|pristine|move[-\s]?in)\b/.test(t)
      );
    },
    ask: (c) =>
      pick(
        [
          "How are the walls looking right now?",
          "What kind of shape is it in?",
          "Any prep concerns I should know about?",
          "Is it in good shape overall?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Basically: is it a clean paint job, or are there repairs needed first? Little stuff like nail holes is normal — I mean things like wallpaper to strip, popcorn ceilings to scrape, water damage.",
    example: () =>
      "E.g., 'it's in good shape, just nail holes', 'wallpaper in one room', 'popcorn ceiling in the living room', or 'some water damage in a corner'.",
  },

  // ——————————————————————————————————————————
  // Popcorn ceiling removal extent — only asked when removal was mentioned
  // without any indication of how much of the house it covers. If the
  // customer already said "throughout"/"most of the house"/etc., the
  // extractor infers a room count directly and this topic is skipped
  // entirely — this is a follow-up for genuine ambiguity, not a redundant
  // re-ask of something already implied.
  // ——————————————————————————————————————————
  {
    id: 'popcorn_extent',
    priority: 31,
    relevant: (c) => c.prepWork.includes('popcorn_removal'),
    alreadyAnswered: (c) => !!c.popcornCeilingRooms,
    ask: (c) =>
      pick(
        [
          "For the popcorn ceiling removal, about how many rooms are we talking?",
          "How many rooms need that popcorn texture scraped off?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Just a rough count of rooms with popcorn ceiling that need the texture removed before painting — removal is real labor with its own cost, separate from just painting.",
    example: () =>
      "E.g., '3 rooms', 'just the living room', or 'most of the house, maybe 6 rooms'.",
  },

  // ——————————————————————————————————————————
  // Ownership — rentals/multi-unit/commercial price differently than an
  // owner-occupied home. Applies to interior AND exterior jobs alike.
  // ——————————————————————————————————————————
  {
    id: 'property_ownership',
    priority: 32,
    relevant: (c) => !isStandaloneOnlyJob(c),
    alreadyAnswered: (c) => !!c.propertyType,
    ask: (c) =>
      pick(
        [
          "Are you living here, or is it a rental or something you're selling?",
          "Is this your home, or a rental?",
          "Quick one, do you live here, or is it a rental?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Rentals usually don't need the same showroom-perfect finish a place you live in day-to-day does, so that can bring the price down a bit. Multi-unit buildings get a volume discount. Commercial space has different insurance/scheduling overhead, so it runs a bit higher.",
    example: () =>
      "E.g., 'it's our home', 'it's a rental I own', 'it's a 6-unit apartment building', or 'commercial office space'.",
  },

  // ——————————————————————————————————————————
  // Commercial scheduling — after-hours/weekend work is a real premium
  // ——————————————————————————————————————————
  {
    id: 'commercial_access',
    priority: 33,
    relevant: (c) => c.propertyType === 'commercial',
    alreadyAnswered: (c) => !!c.afterHoursRequired,
    ask: () =>
      "Since it's a business, when can the crew work so it doesn't disrupt operations?",
    clarify: () =>
      "After-hours or weekend work usually means a bit of a premium since it's outside a normal crew schedule — but it keeps the business running without interruption.",
    example: () =>
      "E.g., 'needs to be nights or weekends, we're open during the day' or 'daytime is fine, we're flexible'.",
  },

  // ——————————————————————————————————————————
  // Color change — always worth asking for interior
  // ——————————————————————————————————————————
  {
    id: 'color_change',
    priority: 35,
    relevant: (c) =>
      c.itemsOnly || componentKind(c) !== '' ||
      ((c.projectType === 'interior' || c.projectType === 'both') &&
        (c.interiorWalls !== 'no' || c.interiorCeilings === 'yes' || c.interiorTrim === 'yes' || c.cabinets !== 'none')),
    alreadyAnswered: (c) => !!c.interiorColorChange,
    ask: (c) =>
      c.itemsOnly
        ? pick(
            [
              c.furnitureTreatment === 'restain' ? 'Are we matching the current stain color, or going a different shade?' : 'Are we keeping the current color, or changing it?',
              'Same color as it is now, or something new?',
            ],
            seed(c),
          )
        : pick(
        [
          "Is it the same color going back, or a different one?",
          "Are you sticking with the same color, or changing it up?",
          "Are we matching the existing color, or going with something new?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Going over the same color is usually one coat. A different color is typically two coats. Dark to light (or vice versa) can be three coats, which bumps the price a bit.",
    example: () =>
      "Like 'same beige going back up', 'changing to a light gray', or 'going from dark navy to white'.",
  },

  // ——————————————————————————————————————————
  // Color-change scope clarification — a REACTIVE follow-up only, never a
  // standing question. It only becomes relevant when the customer has
  // already volunteered something ambiguous ("several different colors"
  // with no count, or "one main color with accent walls" with no location)
  // — see extractColorScope() in extractors.ts, which is what sets
  // colorClarificationNeeded in the first place. Most jobs are one color
  // for the whole space and never touch this topic at all.
  // ——————————————————————————————————————————
  {
    id: 'color_scope_clarify',
    priority: 36,
    relevant: (c) => !!c.colorClarificationNeeded,
    alreadyAnswered: (c) => !c.colorClarificationNeeded,
    ask: (c) =>
      c.colorClarificationNeeded === 'color_count'
        ? "Roughly how many colors?"
        : "Can you describe where you want the different color(s) — which rooms or walls?",
    clarify: (c) =>
      c.colorClarificationNeeded === 'color_count'
        ? "Just a rough count — 2, 3, several — helps me price the extra cutting-in between colors."
        : "Just roughly which rooms or which walls get the different color — that's enough for me to scope it.",
    example: (c) =>
      c.colorClarificationNeeded === 'color_count'
        ? "E.g. 'three colors' or 'four, one per bedroom'."
        : "E.g. 'the living room accent wall' or 'the two kids' bedrooms'.",
  },

  // ——————————————————————————————————————————
  // Renovation context — only if condition is reno/new
  // ——————————————————————————————————————————
  {
    id: 'reno_context',
    priority: 40,
    relevant: (c) => c.projectCondition === 'renovation' || c.projectCondition === 'new_construction',
    alreadyAnswered: (c) => c.renoStageAddressed ||
      c.additionalDetails.toLowerCase().includes('drywall') ||
      c.additionalDetails.toLowerCase().includes('contractor'),
    ask: (c) =>
      pick(
        [
          "Since it's a renovation, where are the other trades at?",
          "How far along are the other trades?",
          "What stage is the space in?",
        ],
        seed(c),
      ),
    clarify: () =>
      "I just need to know what stage the space is in. If drywall and trim are still being installed, I'll assume a full prep. If everything's installed and just waiting for paint, it's less work.",
    example: () =>
      "E.g., 'drywall is up and textured, no trim yet', or 'everything installed, just needs paint', or 'honestly not sure'.",
  },

  // ——————————————————————————————————————————
  // Exterior siding — only if project has exterior component
  // ——————————————————————————————————————————
  {
    id: 'siding',
    priority: 45,
    relevant: (c) => (c.projectType === 'exterior' || c.projectType === 'both') && c.exteriorBody !== 'no',
    alreadyAnswered: (c) => !!c.sidingType,
    ask: (c) =>
      pick(
        [
          "What's the exterior made of?",
          "What kind of siding does it have?",
          "What material is the outside?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Just the material of the outside walls. In SoCal most homes are stucco. Older homes often have wood siding. Newer ones use Hardie board (fiber cement).",
    example: () =>
      "Stucco, wood, Hardie, vinyl, brick, stone, or something else — just the general material.",
  },

  // ——————————————————————————————————————————
  // Exterior stories
  // ——————————————————————————————————————————
  {
    id: 'stories',
    priority: 48,
    relevant: (c) =>
      (c.projectType === 'exterior' || c.projectType === 'both') &&
      (c.exteriorBody !== 'no' || c.exteriorTrim === 'yes' || c.gutters === 'yes' || c.soffitsEaves === 'yes' || c.exteriorWindows !== 'none'),
    alreadyAnswered: (c) => !!c.stories,
    ask: (c) => {
      if (isCommercialLike(c)) {
        return pick(["How many stories is the building?", "How tall is the building?"], seed(c));
      }
      return pick(
        ["How many stories is the house?", "How tall is the house?", "How many stories is the place?"],
        seed(c),
      );
    },
    clarify: () =>
      "Just how tall it is — 1, 2, or 3 stories. Each extra story means more ladder and scaffold time.",
    example: (c) => (isCommercialLike(c) ? "E.g., 'single story', 'two story', or 'three-story building'." : "E.g., 'single story', 'two story', or 'it's a three-story townhouse'."),
  },

  // ——————————————————————————————————————————
  // Location / ZIP — we still need it but it can come late if we have enough
  // ——————————————————————————————————————————
  {
    id: 'location',
    priority: 50,
    relevant: () => true,
    alreadyAnswered: (c) => !!c.zipCode,
    ask: (c) =>
      pick(
        [
          "What ZIP code is the property in?",
          "What's the ZIP code there?",
          "Where's this located, what ZIP code?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Just the 5-digit ZIP where the painting will happen. I use it because painter rates vary a lot by area.",
    example: () =>
      "Like 92109 for Pacific Beach, or 91941 for La Mesa, or 10001 for NYC — that kind of thing.",
  },

  // ——————————————————————————————————————————
  // Timeline + access — wrap-up
  // ——————————————————————————————————————————
  {
    id: 'timeline_and_access',
    priority: 60,
    relevant: () => true,
    // Occupancy/vacancy only matters for interior work (protecting furniture
    // and belongings while the crew is inside) — irrelevant for an
    // exterior-only job, so only timeline needs answering in that case.
    alreadyAnswered: (c) => (c.projectType === 'exterior' || isStandaloneOnlyJob(c) ? hasTiming(c) : !!c.occupancy && hasTiming(c)),
    ask: (c) => {
      const exteriorOnly = c.projectType === 'exterior' || isStandaloneOnlyJob(c);
      const commercial = isCommercialLike(c);
      if (exteriorOnly) {
        return pick(["Last thing, when would you like this done?", "And what's the timeline on this?"], seed(c));
      }
      if (c.occupancy && !hasTiming(c)) {
        return pick(["Last thing, when would you like this done?", "And what's the timeline?"], seed(c));
      }
      if (!c.occupancy && hasTiming(c)) {
        if (commercial) {
          return pick(
            ["Last thing, will the space still be open during the work?",
              "Will the business still be running while we work?"],
            seed(c),
          );
        }
        return pick(
          ["Last thing, will the property be occupied, furnished, or empty when we work?",
            "Will anyone be living there while we work?"],
          seed(c),
        );
      }
      if (commercial) {
        return pick(
          [
            "Last thing, when would you like this done, and will the business still be operating during the work?",
            "Two quick ones — timeline, and will you still be open for business during the work?",
          ],
          seed(c),
        );
      }
      return pick(
        [
          "Last thing, when would you like this done, and will anyone be there while we work?",
          "Two quick ones to wrap up, what's your timeline, and will anyone be there while we work?",
        ],
        seed(c),
      );
    },
    clarify: (c) => {
      if (c.projectType === 'exterior') return "Timeline helps me flag rush jobs, which run a bit higher since it usually means pulling a crew off another job.";
      return isCommercialLike(c)
        ? "Timeline helps me flag rush or after-hours work. Knowing if you're open during the job matters too — working around customers and staff takes more care."
        : "Timeline helps me flag rush jobs, which run a bit higher since it usually means pulling a crew off another job. Knowing if it's lived-in matters too because we have to be more careful protecting stuff.";
    },
    example: (c) => {
      if (c.projectType === 'exterior') return "E.g., 'ASAP', 'sometime next month', or 'whenever, no rush'.";
      return isCommercialLike(c)
        ? "E.g., 'ASAP, we'll be closed for it', 'next month, still open for business', or 'whenever, no rush'."
        : "E.g., 'ASAP, place is vacant', 'next month, we'll still be living there', or 'whenever, nothing urgent'.";
    },
  },
];

// ===== Topic picker =====

/**
 * A job that is only movable pieces (chairs, a table, a dresser): these are the only questions that make sense. Every room, wall,
 * ceiling, trim, door, size-of-house, who-lives-there and paint-grade question is skipped, whatever the list says, and never circled back to.
 */
const ITEM_JOB_TOPICS = new Set(['furniture_kind', 'chair_count', 'furniture_finish', 'color_change', 'paint_brand', 'location', 'timeline_and_access']);
const COMPONENT_COMMON = ['color_change', 'paint_brand', 'location', 'timeline_and_access'];
const COMPONENT_TOPICS: Record<string, string[]> = {
  cabinets: ['cabinet_count', 'cabinet_finish', 'cabinet_scope', 'cabinet_method', 'cabinet_hardware'],
  builtins: ['builtin_count'],
  mantel: [],
  railing: ['railing_length'],
};
/** An item or part-of-a-room job (cabinets, built-ins, a mantel, a railing) only asks about that item, never about the rest of the room. */
const askableFor = (ctx: EstimatorContext, id: string) => {
  if (ctx.itemsOnly) return ITEM_JOB_TOPICS.has(id);
  const kind = componentKind(ctx);
  return !kind || COMPONENT_COMMON.includes(id) || COMPONENT_TOPICS[kind].includes(id);
};

export function pickNextTopic(ctx: EstimatorContext, asked: string[]): Topic | null {
  const candidates = TOPICS.filter(
    (t) =>
      !asked.includes(t.id) &&
      askableFor(ctx, t.id) &&
      t.relevant(ctx) &&
      !t.alreadyAnswered(ctx),
  );
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0] ?? null;
}

/**
 * A topic that was asked but never satisfactorily answered — the user
 * answered something else instead, so pickNextTopic moved on and never
 * circled back on its own (once a topic id is in `asked`, it's excluded
 * forever). This finds the highest-priority such topic so it can be
 * retried once before giving up and falling back to the generic
 * "what's missing" wrap-up prompt.
 */
export function pickRetryTopic(ctx: EstimatorContext, asked: string[], retried: string[]): Topic | null {
  const candidates = TOPICS.filter(
    (t) =>
      asked.includes(t.id) &&
      !retried.includes(t.id) &&
      askableFor(ctx, t.id) &&
      t.relevant(ctx) &&
      !t.alreadyAnswered(ctx),
  );
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0] ?? null;
}

export function findTopic(id: string): Topic | null {
  return TOPICS.find((t) => t.id === id) ?? null;
}

// ===== Meta bank: canned answers for user questions TO the bot =====

export const metaBank = {
  cost: () =>
    "Totally free to get your price. At the end I'll show you a guaranteed price plus painters in your area — you only pay the painter if you book. No card needed to keep chatting.",

  how_it_works: () =>
    "You describe the job, I ask a few follow-ups, then I put together a price. You'll see 2-4 verified painters who'd take the job, plus a 'guaranteed price' option where we fan the job out to our whole pool.",

  bot_check: () =>
    "Yep, I'm an AI helper — but my pricing is backed by real contractor data and actual painters bid on these jobs. I'm usually faster than a phone call.",

  real_person: () =>
    "Sure — you can call or text Isaac at (619) 724-2702 any time. Or keep going with me and we'll have your price in under two minutes.",

  time: () =>
    "Usually 2-3 minutes. I only ask what I need to price it fairly.",

  privacy: () =>
    "Your info stays with us — we use it to connect you with painters when you book. We don't sell it or spam you.",

  painter_question: () =>
    "You'll see a shortlist of painters whose profile fits your job, each with their own price. Pick whichever one you like best. Or pick the guaranteed price — that fans the job out to the whole pool and the first available painter locks it in.",

  booking_question: () =>
    "After I give you the price, just tap the painter you want (or tap Guaranteed Price) and you'll lock it in. Small deposit at booking, balance due when the job's done.",

  color_question: () =>
    "Color's on you for this part — it doesn't change the price (same-color repaint is a little cheaper, any new color is about the same). If you want color advice, the painter you book can do a free consult.",

  recommend_question: () =>
    "Honestly? Tell me a bit about what you want painted and I'll give you a real price. Once you see the number, pick whichever painter fits your budget — or go with the guaranteed price if you want the best rate.",

  off_topic: () =>
    "Ha — let's stick to your paint job for now. What do you need painted?",

  deflection_ballpark: () =>
    "I can give you a tighter number than a ballpark in about 60 more seconds. Just tell me the ZIP and roughly what we're painting.",

  deflection_email: () =>
    "Happy to email it at the end. Quickest way is to finish the few quick questions and then I'll take your email.",

  frustration: () =>
    "Sorry about that — nothing you've told me so far is lost, let's keep going.",

  uncertainty: (lastTopic: string | null) => {
    switch (lastTopic) {
      case 'location':
        return "No problem — I can still give a ballpark without it. What city are you in?";
      case 'room_size':
        return "Totally fine. Is it small, medium, or large — just by feel?";
      case 'property_ownership':
        return "No worries — I'll price it as a standard owner-occupied home unless you tell me otherwise.";
      case 'commercial_access':
        return "No problem — I'll assume normal daytime scheduling unless you tell me otherwise.";
      case 'surfaces':
        return "All good — most folks go with walls only, so I'll default to that. Say 'everything' if you change your mind.";
      case 'condition':
        return "I'll assume it's in decent shape then — normal nail holes, no big repairs. Say so if there's wallpaper or popcorn ceilings.";
      case 'color_change':
        return "No worries — I'll assume you're doing a different color. Price doesn't change much either way.";
      case 'siding':
        return "No problem — stucco's the most common in SoCal. I'll default to that unless it's clearly wood or brick.";
      case 'house_size':
        return "No problem — I'll estimate the size from the bedroom count you gave me.";
      default:
        return "No worries — just tell me what you do know and we'll work with it.";
    }
  },

  negation_after_topic: (lastTopic: string | null) => {
    switch (lastTopic) {
      case 'condition':
        return "Good — I'll keep prep minimal then. Just the standard caulk and nail-hole fill.";
      case 'color_change':
        return "Got it — same color going back up.";
      case 'surfaces':
        return "Okay, just walls then. Trim, ceiling, and doors will stay as they are.";
      case 'commercial_access':
        return "Got it — daytime scheduling, no after-hours premium.";
      default:
        return "Got it.";
    }
  },

  greeting: () =>
    "Hey! What do you need painted?",
};
