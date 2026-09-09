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
//   - chips(ctx): optional tap-to-answer chips
//
// Additionally exports `metaBank` — canned answers for user questions TO the
// bot (cost, how-it-works, real-person, booking, etc.).
// ============================================================================

import type { EstimatorContext } from '../types';

export interface Topic {
  id: string;
  priority: number;
  relevant: (ctx: EstimatorContext) => boolean;
  alreadyAnswered: (ctx: EstimatorContext) => boolean;
  ask: (ctx: EstimatorContext) => string;
  clarify: (ctx: EstimatorContext) => string;
  example: (ctx: EstimatorContext) => string;
  chips?: (ctx: EstimatorContext) => string[];
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

const isCommercialLike = (c: EstimatorContext) => c.propertyType === 'commercial' || c.propertyType === 'multi_unit';

// ===== Topic list (priority order) =====

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
          "Quick one — interior, exterior, or both?",
          "Are we working on the inside, the outside, or both?",
          "Is this interior or exterior painting?",
          "Interior, exterior, or the whole house inside and out?",
          "What are we tackling — inside, outside, or both?",
          "Just so I scope this right — inside, outside, or both?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Interior means inside the house — walls, ceilings, trim, etc. Exterior means the outside — siding, trim, fascia, that sort of thing.",
    example: () =>
      "For instance: 'interior' would be painting the bedrooms and living room. 'Exterior' would be painting the outside of the house.",
    chips: () => ['Interior', 'Exterior', 'Both'],
  },

  // ——————————————————————————————————————————
  // Room selection
  // ——————————————————————————————————————————
  {
    id: 'which_rooms',
    priority: 15,
    relevant: (c) => c.projectType === 'interior' || c.projectType === 'both',
    alreadyAnswered: (c) =>
      c.interiorScope === 'whole_house' || c.selectedRooms.length > 0,
    ask: (c) => {
      const t = c.additionalDetails.toLowerCase();
      const vague = /(a room|just a room|one room)/.test(t);
      if (vague) {
        return "Got it — which room? Bedroom, living room, kitchen, bathroom, something else?";
      }
      return pick(
        [
          "Which rooms are we painting? List as many as you like.",
          "Which room or rooms should we price out?",
          "What rooms are on the list?",
          "Which spaces are we covering — go ahead and rattle them off.",
          "Give me the room list — bedrooms, living areas, whatever's getting painted.",
          "What all needs paint? Just name the rooms.",
        ],
        seed(c),
      );
    },
    clarify: () =>
      "Just give me the type of room — 'master bedroom', 'kids room', 'kitchen', 'living room'. Whatever you've got.",
    example: () =>
      "Like 'master bedroom and kids room' or 'just the kitchen' or 'living room, dining room, hallway'.",
    chips: () => ['Bedroom', 'Living room', 'Kitchen', 'Bathroom', 'Whole house'],
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
          `What size ${label} are we talking? Small/medium/large is fine if you don't know exact numbers.`,
        ],
        seed(c),
      );
    },
    clarify: () =>
      "Rough idea is fine — small is about 10×10, medium is 12×14, large is 16×18 or bigger. If you know exact dimensions that's even better.",
    example: () =>
      "You could say 'small', or '11 by 12', or '144 square feet', or 'medium size, probably 12 by 12'.",
    chips: () => ['Small', 'Medium', 'Large', 'Not sure'],
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
      !c.squareFeet,
    alreadyAnswered: (c) => !!c.squareFeet,
    ask: (c) => {
      if (isCommercialLike(c)) {
        return pick(
          [
            "About how big is the space — total square footage?",
            "What's the total square footage we're working with?",
            "Roughly how many square feet is the space?",
          ],
          seed(c),
        );
      }
      if (c.bedroomCount) {
        return pick(
          [
            "And about how many square feet is the place? Bedroom count alone can vary a lot in size, so a rough number helps me price it right.",
            "Got the bedroom count — do you also know roughly the square footage? It varies enough that a real number helps.",
          ],
          seed(c),
        );
      }
      return pick(
        [
          "About how big is the place? Square footage or bedroom count works — whatever you know.",
          "Roughly how big is it — square footage, or even just bedroom count if that's easier?",
          "What's the size of the place? A square footage number is ideal, but bedroom count works too.",
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
    chips: () => ['Under 1500', '1500-2500', '2500-4000', 'Over 4000'],
  },

  // ——————————————————————————————————————————
  // Surfaces — what in the room(s) is getting painted
  // ——————————————————————————————————————————
  {
    id: 'surfaces',
    priority: 25,
    relevant: (c) => c.projectType === 'interior' || c.projectType === 'both',
    alreadyAnswered: (c) =>
      // Answered if any of the surface scope fields has been set explicitly from "just walls" etc.
      (c.interiorWalls === 'yes' &&
        (c.interiorCeilings === 'no' || c.interiorTrim === 'no' || c.interiorDoors === 'none')) ||
      c.additionalDetails.toLowerCase().includes('walls only') ||
      c.additionalDetails.toLowerCase().includes('whole room'),
    ask: (c) => {
      const singular = c.selectedRooms.length === 1;
      const hasKitchen = c.selectedRooms.includes('kitchen');
      if (hasKitchen) {
        return "For the kitchen — walls, ceiling, trim, doors, and are the cabinets getting painted too?";
      }
      if (singular) {
        const label = roomLabel(c.selectedRooms[0]);
        return pick(
          [
            `In that ${label}, are we doing just the walls, or walls + ceiling + trim + doors — or somewhere in between?`,
            `For the ${label} — just walls, or the full package (ceiling, trim, doors too)?`,
          ],
          seed(c),
        );
      }
      return pick(
        [
          "Are we painting just the walls in those rooms, or the full package — walls, ceilings, trim, doors?",
          "For those rooms — just walls, or everything (ceilings, trim, doors included)?",
          "How much of each room — walls only, or the full walls/ceiling/trim/door package?",
        ],
        seed(c),
      );
    },
    clarify: () =>
      "Some folks just want walls refreshed. Others want the whole package — walls, ceiling, trim, doors, closets. Either works. You can also mix and match.",
    example: () =>
      "'Just walls' is common. Or 'walls and ceiling, no trim'. Or 'everything except the doors'.",
    chips: () => ['Just walls', 'Walls + ceiling', 'Everything', 'Not sure'],
  },

  // ——————————————————————————————————————————
  // Condition — only ask if user hasn't already told us
  // ——————————————————————————————————————————
  {
    id: 'condition',
    priority: 30,
    relevant: (c) => c.projectType !== 'exterior' && c.projectCondition !== 'new_construction',
    alreadyAnswered: (c) => {
      const t = c.additionalDetails.toLowerCase();
      return (
        c.prepWork.length > 0 ||
        c.drywallRepairExtent === 'major' ||
        c.drywallRepairExtent === 'moderate' ||
        /\b(good|clean|great|fine|pristine|move[-\s]?in)\b/.test(t)
      );
    },
    ask: (c) =>
      pick(
        [
          "How are the walls looking right now — smooth and ready, or any holes, cracks, wallpaper, popcorn ceilings, anything like that?",
          "What kind of shape is it in — clean and ready for paint, or are there repairs to deal with first?",
          "Any prep concerns I should know about — holes, wallpaper, popcorn ceilings, water stains, that sort of thing?",
          "Is it in good shape overall, or is there some damage/repair work mixed in?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Basically: is it a clean paint job, or are there repairs needed first? Little stuff like nail holes is normal — I mean things like wallpaper to strip, popcorn ceilings to scrape, water damage.",
    example: () =>
      "E.g., 'it's in good shape, just nail holes', 'wallpaper in one room', 'popcorn ceiling in the living room', or 'some water damage in a corner'.",
    chips: () => ['Good shape', 'Some repairs', 'Needs a lot of prep'],
  },

  // ——————————————————————————————————————————
  // Ownership — rentals/multi-unit/commercial price differently than an
  // owner-occupied home. Applies to interior AND exterior jobs alike.
  // ——————————————————————————————————————————
  {
    id: 'property_ownership',
    priority: 32,
    relevant: () => true,
    alreadyAnswered: (c) => !!c.propertyType,
    ask: (c) =>
      pick(
        [
          "Is this your own home, or a rental/investment property? (Also let me know if it's a multi-unit building or a commercial space — those price differently too.)",
          "Quick one — owner-occupied, a rental you own, a multi-unit building, or commercial space?",
          "Whose place is this — you live there, it's a rental, multiple units, or a business?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Rentals usually don't need the same showroom-perfect finish a place you live in day-to-day does, so that can bring the price down a bit. Multi-unit buildings get a volume discount. Commercial space has different insurance/scheduling overhead, so it runs a bit higher.",
    example: () =>
      "E.g., 'it's our home', 'it's a rental I own', 'it's a 6-unit apartment building', or 'commercial office space'.",
    chips: () => ['My home', 'Rental property', 'Multiple units', 'Commercial'],
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
      "Since it's a business — does this need to happen after hours or on weekends so it doesn't disrupt operations, or can the crew work during the day?",
    clarify: () =>
      "After-hours or weekend work usually means a bit of a premium since it's outside a normal crew schedule — but it keeps the business running without interruption.",
    example: () =>
      "E.g., 'needs to be nights/weekends, we're open during the day' or 'daytime is fine, we're flexible'.",
    chips: () => ['After hours/weekends', 'Daytime is fine'],
  },

  // ——————————————————————————————————————————
  // Color change — always worth asking for interior
  // ——————————————————————————————————————————
  {
    id: 'color_change',
    priority: 35,
    relevant: (c) => c.projectType === 'interior' || c.projectType === 'both',
    alreadyAnswered: (c) => !!c.interiorColorChange,
    ask: (c) =>
      pick(
        [
          "Same color going back, or a different one? And if different — anything dramatic like dark-to-light?",
          "Sticking with the same color, or changing it up? Let me know if it's a big shift like dark to light.",
          "Are we matching the existing color or going with something new?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Going over the same color is usually one coat. A different color is typically two coats. Dark to light (or vice versa) can be three coats, which bumps the price a bit.",
    example: () =>
      "Like 'same beige going back up' / 'changing to a light gray' / 'going from dark navy to white'.",
    chips: () => ['Same color', 'Different color', 'Dramatic change', 'Not sure yet'],
  },

  // ——————————————————————————————————————————
  // Renovation context — only if condition is reno/new
  // ——————————————————————————————————————————
  {
    id: 'reno_context',
    priority: 40,
    relevant: (c) => c.projectCondition === 'renovation' || c.projectCondition === 'new_construction',
    alreadyAnswered: (c) => c.additionalDetails.toLowerCase().includes('drywall') ||
      c.additionalDetails.toLowerCase().includes('contractor'),
    ask: (c) =>
      pick(
        [
          "Since it's a renovation: where are the other trades at? Drywall taped and textured, trim installed, primer done — or still in progress?",
          "How far along are the other trades — is drywall/trim finished, or is stuff still being installed?",
          "What stage is the space in — ready for paint, or are other contractors still working?",
        ],
        seed(c),
      ),
    clarify: () =>
      "I just need to know what stage the space is in. If drywall and trim are still being installed, I'll assume a full prep. If everything's installed and just waiting for paint, it's less work.",
    example: () =>
      "E.g., 'drywall is up and textured, no trim yet', or 'everything installed, just needs paint', or 'honestly not sure'.",
    chips: () => ['Drywall done, trim done', 'Still in progress', 'Not sure'],
  },

  // ——————————————————————————————————————————
  // Exterior siding — only if project has exterior component
  // ——————————————————————————————————————————
  {
    id: 'siding',
    priority: 45,
    relevant: (c) => c.projectType === 'exterior' || c.projectType === 'both',
    alreadyAnswered: (c) => !!c.sidingType,
    ask: (c) =>
      pick(
        [
          "What's the exterior made of — stucco, wood, Hardie board, vinyl, brick, or a mix?",
          "What kind of siding does it have?",
          "What material is the outside — stucco, wood, fiber cement, vinyl, brick, something else?",
        ],
        seed(c),
      ),
    clarify: () =>
      "Just the material of the outside walls. In SoCal most homes are stucco. Older homes often have wood siding. Newer ones use Hardie board (fiber cement).",
    example: () =>
      "Stucco, wood, Hardie, vinyl, brick, stone, or something else — just the general material.",
    chips: () => ['Stucco', 'Wood', 'Hardie', 'Brick', 'Mixed'],
  },

  // ——————————————————————————————————————————
  // Exterior stories
  // ——————————————————————————————————————————
  {
    id: 'stories',
    priority: 48,
    relevant: (c) => c.projectType === 'exterior' || c.projectType === 'both',
    alreadyAnswered: (c) => !!c.stories,
    ask: (c) => {
      if (isCommercialLike(c)) {
        return pick(["How many stories is the building?", "Is the building single-story, two-story, or taller?"], seed(c));
      }
      return pick(
        ["How many stories is the house?", "Is it single-story, two-story, or taller?", "How tall is the place — how many stories?"],
        seed(c),
      );
    },
    clarify: () =>
      "Just how tall it is — 1, 2, or 3 stories. Each extra story means more ladder/scaffold time.",
    example: (c) => (isCommercialLike(c) ? "E.g., 'single story' / 'two story' / 'three-story building'." : "E.g., 'single story' / 'two story' / 'it's a three-story townhouse'."),
    chips: () => ['1-story', '2-story', '3-story'],
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
          "What ZIP code is the property in? Helps me calibrate local pricing.",
          "What's the ZIP code there? Rates vary quite a bit by area.",
          "Where's this located — what ZIP code?",
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
    alreadyAnswered: (c) => (c.projectType === 'exterior' ? !!c.timeline : !!c.occupancy && !!c.timeline),
    ask: (c) => {
      const exteriorOnly = c.projectType === 'exterior';
      const commercial = isCommercialLike(c);
      if (exteriorOnly) {
        return pick(["Last thing — when would you like this done?", "And what's the timeline on this — any rush, or flexible?"], seed(c));
      }
      if (c.occupancy && !c.timeline) {
        return pick(["Last thing — when would you like this done?", "And what's the timeline — any rush, or flexible?"], seed(c));
      }
      if (!c.occupancy && c.timeline) {
        if (commercial) {
          return pick(
            ["Last thing — will the space still be open/operating during the work, or empty?",
              "Will the business still be running while we work, or will it be closed/vacant?"],
            seed(c),
          );
        }
        return pick(
          ["Last thing — will the property be occupied, furnished, or completely empty when we work?",
            "Will it be lived-in during the work, furnished but empty, or totally vacant?"],
          seed(c),
        );
      }
      if (commercial) {
        return pick(
          [
            "Last thing — when would you like this done, and will the business still be operating during the work, or closed/vacant?",
            "Two quick ones — timeline, and will you still be open for business during the work?",
          ],
          seed(c),
        );
      }
      return pick(
        [
          "Last thing — when would you like this done, and will it be occupied / furnished / or empty when we work?",
          "Two quick ones to wrap up — timeline, and will the place be occupied, furnished, or empty while we work?",
        ],
        seed(c),
      );
    },
    clarify: (c) => {
      if (c.projectType === 'exterior') return "Timeline helps me flag rush jobs, which run a bit higher since it usually means pulling a crew off another job.";
      return isCommercialLike(c)
        ? "Timeline helps me flag rush or after-hours work. Knowing if you're open during the job matters too — working around customers/staff takes more care."
        : "Timeline helps me flag rush jobs, which run a bit higher since it usually means pulling a crew off another job. Knowing if it's lived-in matters too because we have to be more careful protecting stuff.";
    },
    example: (c) => {
      if (c.projectType === 'exterior') return "E.g., 'ASAP' / 'sometime next month' / 'whenever, no rush'.";
      return isCommercialLike(c)
        ? "E.g., 'ASAP, we'll be closed for it' / 'next month, still open for business' / 'whenever, no rush'."
        : "E.g., 'ASAP, place is vacant' / 'next month, we'll still be living there' / 'whenever, nothing urgent'.";
    },
    chips: (c) => {
      if (c.projectType === 'exterior') return ['ASAP', 'This month', 'No rush'];
      const commercial = isCommercialLike(c);
      if (c.occupancy && !c.timeline) return ['ASAP', 'This month', 'No rush'];
      if (!c.occupancy && c.timeline) return commercial ? ['Still operating', 'Closed/vacant'] : ['Vacant', 'Furnished', 'Occupied'];
      return commercial ? ['ASAP · closed for it', 'This month · still open', 'No rush'] : ['ASAP · vacant', 'This month · occupied', 'No rush'];
    },
  },
];

// ===== Topic picker =====

export function pickNextTopic(ctx: EstimatorContext, asked: string[]): Topic | null {
  const candidates = TOPICS.filter(
    (t) =>
      !asked.includes(t.id) &&
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
    "Totally free to get the estimate. At the end I'll show you a guaranteed price plus painters in your area — you only pay the painter if you book. No card needed to keep chatting.",

  how_it_works: () =>
    "You describe the job, I ask a few follow-ups, then I put together a price. You'll see 2-4 verified painters who'd take the job, plus a 'guaranteed price' option where we fan the job out to our whole pool.",

  bot_check: () =>
    "Yep, I'm an AI helper — but my pricing is backed by real contractor data and actual painters bid on these jobs. I'm usually faster than a phone call.",

  real_person: () =>
    "Sure — you can call or text Isaac at (619) 724-2702 any time. Or keep going with me and we'll have your estimate in under two minutes.",

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
