// ============================================================================
// What a painter asks about each item, and what each answer does to the price
// ============================================================================
// The data behind itemInterviews.ts. Built from how professional estimators price each item (cost guides from Angi, HomeAdvisor, Fixr,
// HomeGuide and Bob Vila, plus contractor practice). Multipliers are relative to the usual case for that item (the price line the engine
// already makes); where the sources gave no figure they are conservative midpoints, meant to be tuned against real bids.
//
// Option order matters: the first option whose `match` fits the customer's reply wins. A brushed-off question ("doesn't matter") takes the
// highest-multiplier option, so the number never comes in short.
// ============================================================================

import type { EstimatorContext } from '../types';
import type { ItemOption, ItemSpec } from './itemInterviews';

const o = (value: string, label: string, match: RegExp, mult?: number, extra: Partial<ItemOption> = {}): ItemOption => ({ value, label, match, mult, ...extra });

const has = (c: EstimatorContext, s: string) => c.specialtyServices.includes(s);
const outside = (c: EstimatorContext) => c.projectType === 'exterior' || c.projectType === 'both';
/** The house body is being painted: a door, gutter or shutter on it is a small add-on, so only its main questions are asked. On its own it gets them all. */
const onHouse = (c: EstimatorContext) => outside(c) && c.exteriorBody !== 'no' && !c.standaloneStructure;

// shared answers for "what shape is it in?"
const GOOD = /\b(?:good|great|fine|solid|sound|excellent|decent|ok|okay|no (?:problems|issues))\b/;
const WORN = /\b(?:faded|worn|chalky|dull|dirty|scuffed|some wear|weathered|mildew|gr[ae]y)\b/;
const BAD = /\b(?:peel(?:ing|s)?|flak(?:ing|y)|chip(?:ping|ped)|rust(?:y|ed)?|rot(?:ted|ten)?|cracked|cracking|damaged|bad|rough|terrible|awful|falling apart|heavy wear|loose|broken)\b/;

export const ITEM_SPECS: ItemSpec[] = [
  // ——————————————————————————————————— Staircase railing (inside)
  {
    key: 'stair_rail',
    thing: 'staircase railing',
    present: (c) => c.stairways === 'yes' && ['railings_only', 'walls_and_railings', 'full'].includes(c.stairwayDetails),
    lineKeys: ['stairs'],
    priority: 34.82,
    questions: [
      {
        key: 'material', label: 'what the railing is made of', hint: 'Wood, or iron/metal?',
        ask: ["What's the railing made of: wood, wrought iron, or another metal?", "Is the railing wood, or is it iron or metal?"],
        clarify: "Wood is the most common. Wrought iron and metal balusters take more time (rust prep, a special primer, lots of small surfaces) so they are priced higher.",
        example: "Say 'wood', 'wood with iron balusters' or 'wrought iron'.",
        when: (c) => !c.interiorRailingMaterial || c.interiorRailingMaterial === 'wood',
        options: [
          o('iron', 'wrought iron', /\b(?:wrought|iron)\b/, 1, { said: /\bwrought iron\b|\biron (?:rail|baluster|spindle)/, ctxPatch: { interiorRailingMaterial: 'wrought_iron' } }),
          o('metal', 'metal', /\b(?:metal|steel|aluminum|aluminium)\b/, 1, { ctxPatch: { interiorRailingMaterial: 'metal' } }),
          o('wood', 'wood', /\b(?:wood|wooden|oak|pine|maple)\b/, 1),
        ],
      },
      {
        key: 'now', label: 'whether the railing is painted or stained now', hint: 'Painted, stained, or bare?',
        ask: ["Is the railing painted right now, or is it stained or varnished wood?", "What's on the railing now: paint, stain or varnish, or bare wood?"],
        clarify: "Painted wood just needs a scuff sand and new paint. Stained or varnished wood has to be sanded and primed with a bonding primer before it can be painted, which adds real labor.",
        example: "Say 'painted white', 'stained oak' or 'bare wood'.",
        when: (_c, a) => a.material !== 'iron' && a.material !== 'metal',
        options: [
          o('stained', 'stained/varnished now', /\b(?:stain|stained|varnish|varnished|natural|dark wood|clear coat|polyurethane|oak)\b/, 1.15, { said: /\b(?:stained|varnished) (?:rail|banister|baluster|stair)|(?:rail|banister|baluster|stair)\w*[^.,;]{0,20}\b(?:stained|varnished)\b/ }),
          o('bare', 'bare wood', /\b(?:bare|raw|unfinished|new wood|never (?:been )?(?:painted|stained))\b/, 1.1),
          o('painted', 'painted now', /\b(?:paint|painted|white|enamel)\b/, 1),
        ],
      },
      {
        key: 'goal', label: 'what you want done to the railing', hint: 'Paint it, restain, or strip?',
        ask: ["What do you want done: paint it, restain it, or strip it back and refinish?", "Is the plan to paint it, re-stain it, or strip it down and refinish?"],
        clarify: "Going from stain to paint needs primer. Keeping it stained means sanding and restaining. Stripping to bare wood and refinishing is the most work.",
        example: "Say 'paint it white', 'restain it' or 'strip and refinish'.",
        when: (_c, a) => a.now === 'stained' || a.now === 'bare',
        options: [
          o('strip', 'strip and refinish', /\b(?:strip|stripped|stripping|refinish|refinishing|bare wood|down to)\b/, 1.7),
          o('restain', 'restain', /\b(?:re-?stain|stain it|keep (?:it )?stained|keep the stain|same stain|varnish)\b/, 1.3),
          o('paint', 'stain to paint', /\b(?:paint|painted|white|black|go (?:to|with))\b/, 1.3),
        ],
      },
      {
        key: 'style', label: 'how many spindles the railing has', hint: 'Plain rail, or lots of spindles?',
        ask: ["Is it a plain rail with a few posts, or does it have lots of spindles (balusters)?", "Does the railing have spindles between the rail and the stairs, or is it more solid?"],
        clarify: "Every spindle has four sides and often a turned profile, so spindles are what take the time. A solid half-wall is priced like wall.",
        example: "Say 'lots of spindles', 'just a plain rail' or 'a solid half wall'.",
        when: (c) => c.stairwayDetails === 'railings_only',
        options: [
          o('spindles', 'spindle balusters', /\b(?:spindles?|balusters?|pickets?|lots|many|ornate|turned)\b/, 1, { ctxPatch: { railingType: 'spindles' } }),
          o('solid', 'solid/half wall', /\b(?:solid|half[\s-]?wall|panel|closed|wall)\b/, 0.7, { ctxPatch: { railingType: 'simple' } }),
          o('simple', 'plain rail', /\b(?:plain|simple|just (?:a )?rail|few|cable|post)\b/, 1, { ctxPatch: { railingType: 'simple' } }),
        ],
      },
      {
        key: 'condition', label: 'what shape the railing is in', hint: 'What shape is it in?',
        ask: ["What shape is the railing in: good, worn, or peeling and damaged?", "How's it holding up: fine, a bit worn, or peeling and beat up?"],
        clarify: "Peeling, chipped or rusty railings need scraping and repair before any paint goes on.",
        example: "Say 'good shape', 'a little worn' or 'peeling in spots'.",
        options: [
          o('bad', 'peeling/damaged', BAD, 1.25),
          o('worn', 'worn', WORN, 1.08),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Railing outside (deck, porch, balcony)
  {
    key: 'ext_rail',
    thing: 'exterior railing',
    present: (c) => c.railings === 'yes' && outside(c),
    lineKeys: ['railings'],
    priority: 34.81,
    questions: [
      {
        key: 'material', label: 'what the railing is made of', hint: 'Wood, metal, or other?',
        ask: ["What's the railing made of: wood, metal or iron, aluminum, cable, or composite/vinyl?", "Is the railing wood, metal, or something like composite or vinyl?"],
        clarify: "Wood and iron are painted or stained. Composite and vinyl usually shouldn't be painted at all, and cable rail only has its posts painted.",
        example: "Say 'wood', 'wrought iron' or 'composite'.",
        when: (c) => !c.exteriorRailingMaterial || c.exteriorRailingMaterial === 'wood',
        options: [
          o('iron', 'iron/metal', /\b(?:iron|metal|steel)\b/, 1, { ctxPatch: { exteriorRailingMaterial: 'metal' } }),
          o('aluminum', 'aluminum', /\b(?:alumin(?:um|ium))\b/, 1.1),
          o('cable', 'cable rail', /\bcable\b/, 1, { ctxPatch: { exteriorRailingMaterial: 'cable' } }),
          o('composite', 'composite/vinyl (may not be paintable)', /\b(?:composite|vinyl|trex|pvc|plastic)\b/, 1, { ctxPatch: { exteriorRailingMaterial: 'composite' } }),
          o('wood', 'wood', /\b(?:wood|wooden|cedar|redwood|pine|treated)\b/, 1),
        ],
      },
      {
        key: 'height', label: 'how high off the ground the railing is', hint: 'Ground level, or upstairs?',
        ask: ["Is the railing at ground level, or up on a second floor?", "How high up is it: ground level, or a second-story deck or balcony?"],
        clarify: "A second-story railing means ladder or scaffold work, which adds time.",
        example: "Say 'ground level' or 'second story'.",
        when: (c) => c.deck !== 'yes', // a deck's own height answer covers its railing
        options: [
          o('upper', 'second story', /\b(?:second|2nd|upper|upstairs|third|high|balcony|story)\b/, 1.25),
          o('ground', 'ground level', /\b(?:ground|first|low|main|level)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what shape the railing is in', hint: 'What shape is it in?',
        ask: ["What shape is the railing in: fine, weathered, or peeling and rusty?", "How's the railing holding up: solid, weathered and gray, or peeling or rusting?"],
        clarify: "Weathered wood needs washing and sanding. Peeling paint and rust need scraping, wire brushing and a rust-blocking primer first.",
        example: "Say 'good', 'weathered' or 'peeling and rusty'.",
        when: (c) => c.deck !== 'yes', // on a deck, the deck's own condition answer covers it
        options: [
          o('bad', 'peeling/rusty', BAD, 1.4),
          o('worn', 'weathered', WORN, 1.2),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Fence
  {
    key: 'fence',
    thing: 'fence',
    present: (c) => c.fence === 'yes',
    lineKeys: ['fence'],
    priority: 34.52,
    questions: [
      {
        key: 'material', label: 'what the fence is made of', hint: 'Wood, metal, vinyl, or block?',
        ask: ["What's the fence made of: wood, metal or wrought iron, vinyl, or a block wall?", "Is it a wood fence, or metal, vinyl or block?"],
        clarify: "Wood fences are the usual paint or stain job. Metal needs rust treatment, block needs masonry primer, and vinyl usually shouldn't be painted.",
        example: "Say 'wood', 'wrought iron' or 'block wall'.",
        when: (c) => c.fenceType !== 'chain_link',
        options: [
          o('block', 'block wall', /\b(?:block|cmu|cinder|masonry|brick|stucco)\b/, 1.3),
          o('iron', 'iron/metal', /\b(?:iron|metal|steel|alumin(?:um|ium))\b/, 1.1),
          o('vinyl', 'vinyl (usually not painted)', /\bvinyl|pvc|plastic\b/, 0.8),
          o('wood', 'wood', /\b(?:wood|wooden|cedar|redwood|pine|picket|privacy|board)\b/, 1),
        ],
      },
      {
        key: 'now', label: 'what is on the fence now', hint: 'Bare, stained, or painted?',
        ask: ["Is the wood bare, stained, or painted right now?", "What's on the fence now: nothing (bare wood), stain, or paint?"],
        clarify: "New bare wood needs a seal coat (and time to dry out if it is brand new). Painted fences need scraping and sanding first, and stain going to paint needs primer.",
        example: "Say 'bare gray wood', 'stained' or 'painted white'.",
        when: (_c, a) => a.material === 'wood' || a.material === undefined,
        options: [
          o('painted', 'painted now (scrape and sand)', /\b(?:paint|painted|white)\b/, 1.2),
          o('stained', 'stained now', /\b(?:stain|stained|sealed|sealer)\b/, 1),
          o('bare', 'bare wood', /\b(?:bare|raw|new|unfinished|weathered|gr[ae]y|never)\b/, 1.1),
        ],
      },
      {
        key: 'goal', label: 'whether you want the fence painted or stained', hint: 'Paint, or stain/seal?',
        ask: ["Do you want the fence painted, or stained or sealed?", "Paint it, or stain and seal it?"],
        clarify: "Stain and sealer soak into the wood and are quicker to apply. Paint covers completely, takes a primer coat and lasts differently.",
        example: "Say 'paint' or 'stain'.",
        when: (_c, a) => a.material === 'wood' || a.material === undefined,
        options: [
          o('paint', 'paint (primed)', /\b(?:paint|painted|primer|color|solid)\b/, 1.15),
          o('stain', 'stain/seal', /\b(?:stain|seal|sealer|sealant|clear|transparent|natural|waterproof)\b/, 0.9),
        ],
      },
      {
        key: 'sides', label: 'whether one side or both sides of the fence are done', hint: 'One side, or both?',
        ask: ["Do you want both sides of the fence done, or just your side?", "Both sides, or only the side you see?"],
        clarify: "Both sides roughly doubles the work. A fence shared with a neighbor is often just your side.",
        example: "Say 'both sides' or 'just my side'.",
        options: [
          o('both', 'both sides', /\b(?:both|two sides|each side|all sides|inside and out)\b/, 1),
          o('one', 'one side only', /\b(?:one|just (?:my|our|the|this)|only (?:my|our|the|this)|my side|our side|front side|one side|single)\b/, 0.55),
        ],
      },
      {
        key: 'condition', label: 'what shape the fence is in', hint: 'Fine, mildewed, or rotting?',
        ask: ["What shape is it in: pretty good, gray and mildewy, or peeling with some loose or rotted boards?", "How's the fence holding up: fine, weathered, or falling apart in spots?"],
        clarify: "Mildew and gray wood need a wash first. Peeling paint gets scraped, and rotted or loose boards need carpentry before painting.",
        example: "Say 'pretty good', 'gray and mildewy' or 'some rotted boards'.",
        options: [
          o('bad', 'peeling/rotted boards', BAD, 1.35),
          o('worn', 'needs a wash first', WORN, 1.15),
          o('good', 'good shape', GOOD, 1),
        ],
      },
      {
        key: 'gates', label: 'how many gates the fence has', hint: 'How many gates?',
        ask: ["How many gates does the fence have?", "Any gates in it, and how many?"],
        clarify: "Each gate has two faces plus a frame and edges, so each one is priced on its own.",
        example: "Say 'none', 'one' or 'three'.",
        options: [
          o('many', '3+ gates', /\b(?:three|3|four|4|five|5|several|many|a few)\b/, 1, { add: { description: 'Fence gates (3 or more)', amount: 350, category: 'Exterior' } }),
          o('some', '1-2 gates', /\b(?:one|1|two|2|a gate|a couple|single|double)\b/, 1, { add: { description: 'Fence gate(s)', amount: 140, category: 'Exterior' } }),
          o('none', 'no gates', /\b(?:no|none|zero|nope|without)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Front door
  {
    key: 'entry_door',
    thing: 'front door',
    present: (c) => c.entryDoor === 'yes',
    lineKeys: ['entry_door'],
    priority: 34.91,
    questions: [
      {
        key: 'finish', label: 'what the front door is finished with now', hint: 'Painted or stained now?',
        ask: ["Is the front door painted now, or is it stained or varnished wood?", "What's the front door's finish: paint, or a stain or varnish?"],
        clarify: "A painted door is the simplest. Stained or varnished wood needs sanding, stripping and several coats of a weather-grade finish, so it takes two or three times as long.",
        example: "Say 'painted', 'stained wood' or 'stained, and I want it painted'.",
        options: [
          o('stain_to_paint', 'stained, going to paint', /\b(?:stain\w*|varnish\w*)\b.*\b(?:paint|painted|white|black)\b|\bpaint\b.*\b(?:over|instead)\b/, 1.8),
          o('stain', 'stained/varnished (refinish)', /\b(?:stain|stained|varnish|varnished|natural|wood grain|clear|refinish|stripped?)\b/, 2.2),
          o('paint', 'painted', /\b(?:paint|painted|fiberglass|steel|white|enamel)\b/, 1),
        ],
      },
      {
        key: 'glass', label: 'whether the door has glass, sidelights or a transom', hint: 'Glass, sidelights, transom?',
        ask: ["Does the door have glass, side windows (sidelights) or a transom window above it?", "Any glass in or around the door, like sidelights or a transom?"],
        clarify: "Glass and sidelights have to be masked or cut in around, and each extra frame adds time.",
        example: "Say 'no glass', 'a glass insert' or 'two sidelights'.",
        options: [
          o('sidelights', 'sidelights/transom', /\b(?:sidelights?|side lights?|side windows?|transom)\b/, 1.5),
          o('glass', 'glass inserts', /\b(?:glass|window|panes?|lites?)\b/, 1.2),
          o('none', 'plain door', /\b(?:no|none|plain|solid|nope|just a door)\b/, 1),
        ],
      },
      {
        key: 'double', label: 'whether it is a single or a double door', hint: 'Single or double door?',
        ask: ["Is it a single door, or a double door?", "One door or a pair?"],
        clarify: "A pair of doors is nearly twice the surface.",
        example: "Say 'single' or 'double doors'.",
        options: [
          o('double', 'double door', /\b(?:double|pair|two doors|french|both doors|2 doors)\b/, 1.8),
          o('single', 'single door', /\b(?:single|one|just one|regular|standard|1)\b/, 1),
        ],
      },
      {
        key: 'sides', label: 'whether the inside of the door is painted too', hint: 'Outside only, or both sides?',
        ask: ["Do you want just the outside of the door, or the inside and the frame as well?", "Outside face only, or both sides and the frame?"],
        clarify: "The inside face, the edges and the frame count as real extra surface.",
        example: "Say 'outside only' or 'both sides and the frame'.",
        when: (c) => !onHouse(c),
        options: [
          o('both', 'both sides and frame', /\b(?:both|inside|frame|jamb|all|everything|each side)\b/, 1),
          o('outside', 'outside face only', /\b(?:outside|exterior|just the front|one side|only|front)\b/, 0.65),
        ],
      },
      {
        key: 'condition', label: 'what shape the front door is in', hint: 'Faded, peeling, or fine?',
        ask: ["What shape is the door in: good, faded and sun-beaten, or peeling and damaged?", "How's the door holding up: fine, faded, or peeling?"],
        clarify: "Sun-baked or peeling finish needs sanding and spot repair before any new coat will stick.",
        example: "Say 'good', 'faded' or 'peeling'.",
        when: (c) => !onHouse(c),
        options: [
          o('bad', 'peeling/damaged', BAD, 1.4),
          o('worn', 'faded', WORN, 1.15),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Garage door
  {
    key: 'garage_door',
    thing: 'garage door',
    present: (c) => c.garageDoor !== 'none',
    lineKeys: ['garage_door'],
    priority: 34.92,
    questions: [
      {
        key: 'material', label: 'what the garage door is made of', hint: 'Steel, wood, or other?',
        ask: ["What's the garage door made of: steel, wood, aluminum or fiberglass?", "Is the garage door steel, wood, or something else?"],
        clarify: "Steel is the most common and the simplest to paint. Wood needs more sanding and more coats.",
        example: "Say 'steel' or 'wood'.",
        options: [
          o('wood', 'wood', /\b(?:wood|wooden|cedar)\b/, 1.4),
          o('other', 'aluminum/fiberglass', /\b(?:alumin(?:um|ium)|fiberglass|vinyl|composite)\b/, 1),
          o('steel', 'steel', /\b(?:steel|metal|insulated|standard|normal)\b/, 1),
        ],
      },
      {
        key: 'style', label: 'what style the garage door is', hint: 'Flat, paneled, or carriage?',
        ask: ["Is the door flat, paneled, or carriage-style with trim and decorative hardware?", "What style: smooth and flat, raised panels, or carriage-house?"],
        clarify: "Raised panels and carriage-style doors have a lot more edges and detail than a flat door.",
        example: "Say 'paneled', 'flat' or 'carriage-house style'.",
        when: (c) => !onHouse(c),
        options: [
          o('carriage', 'carriage style', /\b(?:carriage|decorative|trim|hardware|windows?)\b/, 1.4),
          o('panel', 'paneled', /\b(?:panel|panels|paneled|raised)\b/, 1.15),
          o('flat', 'flat', /\b(?:flat|smooth|plain|simple)\b/, 1),
        ],
      },
      {
        key: 'inside', label: 'whether the inside of the garage door is painted too', hint: 'Outside only, or inside too?',
        ask: ["Do you want the inside of the garage door painted too, or only the outside?", "Just the outside face of the door, or the inside as well?"],
        clarify: "The inside face is a whole extra side to paint.",
        example: "Say 'outside only' or 'both sides'.",
        options: [
          o('both', 'inside too', /\b(?:both|inside|each side|two sides|yes)\b/, 1.7),
          o('outside', 'outside only', /\b(?:outside|exterior|just the front|one side|only|no)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what shape the garage door is in', hint: 'Faded, peeling, or rusty?',
        ask: ["What shape is it in: good, faded and chalky, or peeling and rusty?", "How's the garage door's finish: fine, faded, or peeling and rusting?"],
        clarify: "Rust and peeling mean scraping, rust treatment and primer first.",
        example: "Say 'faded', 'good' or 'peeling'.",
        when: (c) => !onHouse(c),
        options: [
          o('bad', 'peeling/rusty', BAD, 1.5),
          o('worn', 'faded/chalky', WORN, 1.1),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Outside shutters
  {
    key: 'ext_shutters',
    thing: 'exterior shutters',
    present: (c) => c.exteriorShutters === 'yes',
    lineKeys: ['ext_shutters'],
    priority: 29.96,
    questions: [
      {
        key: 'style', label: 'what style the shutters are', hint: 'Louvered, panel, or plank?',
        ask: ["Are the shutters louvered (slatted), solid panel, or board-and-batten?", "What style are the shutters: louvered, flat panel, or plank-style?"],
        clarify: "Louvered shutters take about twice as long because every slat is painted individually.",
        example: "Say 'louvered' or 'flat panel'.",
        options: [
          o('louvered', 'louvered', /\b(?:louver\w*|slat\w*|blinds?)\b/, 1.7),
          o('batten', 'board-and-batten', /\b(?:board|batten|plank)\b/, 1.1),
          o('panel', 'panel', /\b(?:panel|panels|solid|flat|raised)\b/, 1),
        ],
      },
      {
        key: 'material', label: 'what the shutters are made of', hint: 'Wood, vinyl, or composite?',
        ask: ["What are the shutters made of: wood, vinyl, composite or aluminum?", "Wood shutters, or vinyl or composite?"],
        clarify: "Vinyl and composite need paint made for them and lighter colors; wood is the usual paint job.",
        example: "Say 'wood' or 'vinyl'.",
        options: [
          o('vinyl', 'vinyl/composite', /\b(?:vinyl|composite|plastic|pvc|alumin(?:um|ium))\b/, 1),
          o('wood', 'wood', /\b(?:wood|wooden|cedar)\b/, 1.1),
        ],
      },
      {
        key: 'height', label: 'whether the shutters are upstairs', hint: 'Ground floor, or upstairs?',
        ask: ["Are the shutters all on the ground floor, or are some upstairs?", "Any shutters on a second floor?"],
        clarify: "Upstairs shutters need ladder time.",
        example: "Say 'all ground floor' or 'some upstairs'.",
        when: (c) => !onHouse(c),
        options: [
          o('upper', 'some upstairs', /\b(?:upstairs|second|2nd|upper|some|both|top|yes)\b/, 1.3),
          o('ground', 'ground floor', /\b(?:ground|first|downstairs|all|low|no)\b/, 1),
        ],
      },
      {
        key: 'removal', label: 'whether the shutters can come off the house', hint: 'Take them off, or paint in place?',
        ask: ["Can the shutters come off the house to be sprayed, or should they be painted in place?", "Okay to take the shutters down for painting, or do they stay up?"],
        clarify: "Taking them off to spray is quicker and gives a smoother finish; painting in place is slower.",
        example: "Say 'take them off' or 'paint in place'.",
        when: (c) => !onHouse(c),
        options: [
          o('inplace', 'painted in place', /\b(?:in place|on the house|stay|leave them|up|don'?t remove)\b/, 1),
          o('off', 'removed and sprayed', /\b(?:off|remove|take (?:them )?(?:down|off)|spray|yes|sure)\b/, 0.85),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Inside doors
  {
    key: 'int_doors',
    thing: 'interior doors',
    present: (c) => c.interiorDoors !== 'none' && !!c.doorsIncluded,
    lineKeys: ['doors'],
    priority: 29.915,
    questions: [
      {
        key: 'style', label: 'what style the doors are', hint: 'Flat, paneled, or glass?',
        ask: ["What style are the doors: flat and smooth, paneled (raised or shaker), or French doors with glass panes?", "Are the doors plain flat slabs, paneled, or glass-pane French doors?"],
        clarify: "Paneled doors take about a third more time than flat ones, and glass-pane doors take two to three times as long because every pane is cut in.",
        example: "Say 'flat', 'six-panel' or 'French doors'.",
        options: [
          o('french', 'French/glass-pane doors', /\b(?:french|glass|panes?|lites?|divided)\b/, 2.5),
          o('mixed', 'mix of door styles', /\b(?:mix|mixed|both|different|variety)\b/, 1.6),
          o('panel', 'paneled doors', /\b(?:panel\w*|shaker|raised|six[\s-]?panel|craftsman)\b/, 1.3),
          o('flat', 'flat doors', /\b(?:flat|smooth|plain|slab|hollow|simple)\b/, 1),
        ],
      },
      {
        key: 'sides', label: 'whether both sides of the doors are painted', hint: 'Both sides, or one?',
        ask: ["Both sides of each door and the edges, or just the room side?", "Do you want both faces of the doors done, or only one?"],
        clarify: "Both sides plus the edges is the full price. One side only is about half.",
        example: "Say 'both sides' or 'just the room side'.",
        options: [
          o('both', 'both sides', /\b(?:both|each side|two sides|front and back|all|yes|edges)\b/, 1),
          o('one', 'one side only', /\b(?:one|just|only|room side|single)\b/, 0.6),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Windows
  {
    key: 'windows',
    thing: 'windows',
    present: (c) => c.interiorWindows !== 'none' || c.exteriorWindows !== 'none',
    lineKeys: ['windows', 'ext_windows'],
    priority: 29.925,
    questions: [
      {
        key: 'style', label: 'what style the windows are', hint: 'Plain panes, or many small panes?',
        ask: ["What kind of windows are they: standard single or double-hung, or many small panes (divided lite), or large bay or bow windows?", "Are the windows plain, or divided into lots of small panes?"],
        clarify: "Windows divided into small panes take two to four times as long as a plain window, because every pane is cut in separately.",
        example: "Say 'standard', 'lots of small panes' or 'a big bay window'.",
        options: [
          o('divided', 'divided-pane windows', /\b(?:divided|small panes?|muntin\w*|grids?|grilles?|many panes?|lots of panes|colonial|french|lites?)\b/, 2.5),
          o('bay', 'bay/bow windows', /\b(?:bay|bow|picture|large|big)\b/, 1.5),
          o('standard', 'standard windows', /\b(?:standard|regular|normal|plain|single|double[\s-]?hung|slider|casement|simple)\b/, 1),
        ],
      },
      {
        key: 'material', label: 'what the window frames are made of', hint: 'Wood, vinyl, or aluminum?',
        ask: ["What are the window frames made of: wood, vinyl, aluminum or clad?", "Wood frames, or vinyl or aluminum?"],
        clarify: "Wood frames are the normal paint job. Vinyl and aluminum usually are not painted, or need a special bonding paint.",
        example: "Say 'wood' or 'vinyl'.",
        options: [
          o('wood', 'wood frames', /\b(?:wood|wooden)\b/, 1),
          o('other', 'vinyl/aluminum frames (special paint)', /\b(?:vinyl|alumin(?:um|ium)|clad|fiberglass)\b/, 1.15),
        ],
      },
      {
        key: 'height', label: 'whether any windows are on an upper floor', hint: 'Ground floor, or upstairs?',
        ask: ["Are all the windows on the ground floor, or are some on a second floor?", "Any windows upstairs that need a tall ladder?"],
        clarify: "Second-floor windows outside mean ladder work, which adds about a quarter.",
        example: "Say 'all ground floor' or 'half are upstairs'.",
        when: (c) => c.exteriorWindows !== 'none',
        options: [
          o('upper', 'some upstairs', /\b(?:upstairs|second|2nd|upper|some|half|several|both|yes)\b/, 1.3),
          o('ground', 'ground floor', /\b(?:ground|first|downstairs|all|low|no)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Gutters
  {
    key: 'gutters',
    thing: 'gutters',
    present: (c) => c.gutters === 'yes',
    lineKeys: ['gutters'],
    priority: 34.93,
    questions: [
      {
        key: 'material', label: 'what the gutters are made of', hint: 'Aluminum, steel, copper, or vinyl?',
        ask: ["What are the gutters made of: aluminum, steel, copper or vinyl?", "Are the gutters metal (aluminum or steel), copper, or vinyl?"],
        clarify: "Aluminum and steel need a bonding primer. Copper is normally left alone (its green patina is the finish) and vinyl usually shouldn't be painted.",
        example: "Say 'aluminum', 'steel' or 'vinyl'.",
        options: [
          o('steel', 'steel/galvanized', /\b(?:steel|galvanized|iron)\b/, 1.15),
          o('other', 'copper/vinyl (special handling)', /\b(?:copper|vinyl|plastic)\b/, 1),
          o('aluminum', 'aluminum', /\b(?:alumin(?:um|ium)|metal|seamless)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what shape the gutters are in', hint: 'Fine, peeling, or rusty?',
        ask: ["What shape are the gutters in: good, faded, or rusty and peeling?", "Are the gutters in good shape, or rusting and peeling?"],
        clarify: "Rust gets wire-brushed and primed with a rust blocker before painting.",
        example: "Say 'good', 'faded' or 'rusty'.",
        when: (c) => !onHouse(c),
        options: [
          o('bad', 'rusty/peeling', BAD, 1.3),
          o('worn', 'faded', WORN, 1.08),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— A separate building (shed, barn, gazebo...)
  {
    key: 'outbuilding',
    thing: 'separate building',
    present: (c) => !!c.standaloneStructure,
    lineKeys: ['ext_body'],
    priority: 34.94,
    questions: [
      {
        key: 'siding', label: 'what the building is covered with', hint: 'Smooth, rough, or metal?',
        ask: ["What's the outside of it: smooth lap siding, rough plywood (T1-11) or board-and-batten, or metal?", "What's the outside surface: smooth siding, rough-sawn plywood or board-and-batten, or metal or vinyl?"],
        clarify: "Rough plywood and board-and-batten soak up 25 to 40 percent more paint and take more brushwork. Metal needs a bonding primer.",
        example: "Say 'T1-11', 'smooth siding' or 'metal'.",
        options: [
          o('rough', 'rough T1-11/board-and-batten', /\b(?:t1[\s-]?11|plywood|board|batten|rough|rustic|log|shake)\b/, 1.3),
          o('metal', 'metal', /\b(?:metal|steel|alumin(?:um|ium)|corrugated|tin)\b/, 1.1),
          o('smooth', 'smooth siding', /\b(?:smooth|lap|vinyl|stucco|hardie|plain|regular|standard)\b/, 1),
        ],
      },
      {
        key: 'height', label: 'how tall the building is', hint: 'Under 10 feet, or taller?',
        ask: ["How tall are the walls: under about ten feet, or taller than that?", "Is it a low building (ten feet or under), or taller?"],
        clarify: "Anything over about ten feet needs extension ladders or a lift.",
        example: "Say 'about 8 feet' or 'two stories tall'.",
        options: [
          o('tall', 'over 10 ft tall', /\b(?:tall|two[\s-]?stor\w+|2[\s-]?stor\w+|loft|1[1-9]|2\d|over (?:ten|10)|higher|barn|high)\b/, 1.25),
          o('low', 'under 10 ft', /\b(?:under|low|short|single|one[\s-]?stor\w+|[5-9]|ten|10|small|standard)\b/, 1),
        ],
      },
      {
        key: 'extras', label: 'what else on the building gets painted', hint: 'Outside only, or trim/inside too?',
        ask: ["Is it just the outside walls, or also the trim and doors, or the inside as well?", "Outside walls only, or the trim, doors and inside too?"],
        clarify: "Trim and doors are small add-ons. The inside is priced as its own set of walls.",
        example: "Say 'outside only' or 'inside and out'.",
        options: [
          o('inside', 'inside as well', /\b(?:inside|interior|in and out|both|everything|all)\b/, 1.5),
          o('trim', 'trim and doors too', /\b(?:trim|doors?|windows?|roof)\b/, 1.1),
          o('outside', 'outside walls only', /\b(?:outside|exterior|just|only|walls|no)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what shape the building is in', hint: 'Good, peeling, or rotting?',
        ask: ["What shape is it in: good, peeling, or has some rot or mildew?", "How is the paint and wood holding up: fine, peeling, or rotting in spots?"],
        clarify: "Peeling means scraping and priming, and rot has to be repaired before painting.",
        example: "Say 'good', 'peeling' or 'some rot'.",
        options: [
          o('bad', 'peeling/rot/mildew', BAD, 1.4),
          o('worn', 'worn/faded', WORN, 1.1),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Patio cover / overhang / pergola
  {
    key: 'patio_cover',
    thing: 'patio cover',
    present: (c) => c.overhangs === 'yes',
    lineKeys: ['overhangs'],
    priority: 34.71,
    questions: [
      {
        key: 'structure', label: 'what kind of cover it is', hint: 'Solid, open slats, or beadboard?',
        ask: ["Is it a solid ceiling, open slats and beams (like a pergola), or beadboard?", "Is the cover solid on top, open with slats, or a tongue-and-groove ceiling?"],
        clarify: "Open slats and beams have four faces each, so they take longer than a flat solid ceiling for the same size.",
        example: "Say 'solid', 'open slats' or 'beadboard'.",
        options: [
          o('open', 'open slats/beams', /\b(?:open|slats?|beams?|rafters?|pergola|lattice|louver\w*)\b/, 1.6),
          o('beadboard', 'beadboard/tongue-and-groove', /\b(?:beadboard|bead board|tongue|groove|planks?)\b/, 1.3),
          o('solid', 'solid ceiling', /\b(?:solid|flat|plain|stucco|drywall|plaster)\b/, 1),
        ],
      },
      {
        key: 'material', label: 'what the cover is made of', hint: 'Wood, stucco, or aluminum?',
        ask: ["What's it made of: wood, stucco, or aluminum?", "Is the cover wood, stucco or aluminum?"],
        clarify: "Aluminum covers are usually factory-finished and don't hold paint well. Stucco needs a masonry primer.",
        example: "Say 'wood', 'stucco' or 'aluminum'.",
        options: [
          o('aluminum', 'aluminum (special prep)', /\b(?:alumin(?:um|ium)|metal|vinyl)\b/, 1.3),
          o('stucco', 'stucco', /\bstucco|plaster\b/, 1.1),
          o('wood', 'wood', /\b(?:wood|wooden|cedar|redwood)\b/, 1),
        ],
      },
      {
        key: 'height', label: 'how high the underside is', hint: 'About how high up is it?',
        ask: ["About how high is the underside: under 9 feet, 9 to 12, or higher?", "How high is the ceiling of the cover?"],
        clarify: "Overhead work is slower and needs taller ladders or scaffold the higher it goes.",
        example: "Say 'about 8 feet' or '12 feet'.",
        options: [
          o('high', 'over 12 ft high', /\b(?:1[3-9]|2\d|over (?:12|twelve)|very high|two[\s-]?stor\w+)\b/, 1.4),
          o('mid', '9-12 ft high', /\b(?:9|10|11|12|nine|ten|eleven|twelve|medium|tall)\b/, 1.2),
          o('low', 'under 9 ft', /\b(?:[5-8]|eight|seven|low|short|standard|under)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what shape the cover is in', hint: 'Good, peeling, or stained?',
        ask: ["What shape is it in: good, peeling paint, or stained wood you want painted?", "How does it look now: fine, peeling, or natural or stained wood?"],
        clarify: "Peeling paint is scraped first, and stained wood needs primer before it can be painted.",
        example: "Say 'good', 'peeling' or 'stained'.",
        options: [
          o('bad', 'peeling or stained-to-paint', /\b(?:peel\w*|flak\w*|stain\w*|varnish\w*|bare|weathered|damaged|bad|rot\w*)\b/, 1.3),
          o('good', 'good shape', GOOD, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Fireplace and mantel
  {
    key: 'fireplace',
    thing: 'fireplace',
    present: (c) => has(c, 'fireplace') || c.fireplaceType !== '',
    lineKeys: ['fireplace'],
    priority: 30.4,
    questions: [
      {
        key: 'material', label: 'what the fireplace is made of', hint: 'Brick, stone, or tile?',
        ask: ["What's the fireplace made of: brick, stone, tile, or plaster?", "Is the fireplace brick, stone or tile?"],
        clarify: "Brick is the usual one. Stone and tile can be painted, but they need a bonding primer and are less durable.",
        example: "Say 'brick' or 'stone with a wood mantel'.",
        options: [
          o('tile', 'stone/tile (bonding primer)', /\b(?:stone|tile|marble|granite|slate)\b/, 1.2),
          o('plaster', 'plaster/drywall', /\b(?:plaster|drywall|smooth|stucco)\b/, 0.9),
          o('brick', 'brick', /\b(?:brick|masonry)\b/, 1),
        ],
      },
      {
        key: 'look', label: 'what look you want for the fireplace', hint: 'Paint, whitewash, or limewash?',
        ask: ["What look do you want: solid paint, a whitewash, a soft limewash, or a German schmear (mortar wash)?", "Painted solid, whitewashed, limewashed, or German schmear?"],
        clarify: "Solid paint is the simplest. Limewash and German schmear are more skilled techniques: schmear involves mortar work and is priced the highest.",
        example: "Say 'just paint it white', 'limewash' or 'German schmear'.",
        options: [
          o('schmear', 'German schmear', /\b(?:schmear|smear|mortar wash)\b/, 1.7),
          o('limewash', 'limewash', /\blime[\s-]?wash\b/, 1.4),
          o('whitewash', 'whitewash', /\bwhite[\s-]?wash\b/, 1.1),
          o('paint', 'solid paint', /\b(?:paint|painted|solid|white|black|color)\b/, 1),
        ],
      },
      {
        key: 'height', label: 'how big the fireplace is', hint: 'Fireplace only, or to the ceiling?',
        ask: ["How big is it: just the fireplace face, up to the mantel, or all the way to the ceiling?", "Is it only the fireplace itself, or does it run up to the ceiling?"],
        clarify: "A full-height chimney breast is much more surface and needs a taller ladder.",
        example: "Say 'just the front', 'up to the mantel' or 'floor to ceiling'.",
        options: [
          o('ceiling', 'floor to ceiling', /\b(?:ceiling|floor to|full|whole wall|all the way|vaulted|chimney)\b/, 1.4),
          o('face', 'fireplace face only', /\b(?:face|front|just|only|mantel|small|surround)\b/, 1),
        ],
      },
      {
        key: 'soot', label: 'whether the fireplace has soot staining', hint: 'Any soot or smoke staining?',
        ask: ["Is there soot or smoke staining on it?", "Any black soot or smoke marks on the brick or surround?"],
        clarify: "Soot has to be cleaned and sealed first, or it bleeds through the paint.",
        example: "Say 'no', 'a little' or 'quite a bit'.",
        options: [
          o('heavy', 'heavy soot (cleaning and sealing)', /\b(?:heavy|a lot|quite a bit|lots|bad|black|very|thick|yes)\b/, 1, { add: { description: 'Fireplace soot cleaning and sealing', amount: 200 } }),
          o('light', 'light soot', /\b(?:light|little|some|slight|bit|minor)\b/, 1.05),
          o('none', 'no soot', /\b(?:no|none|clean|nope|not)\b/, 1),
        ],
      },
      {
        key: 'firebox', label: 'whether the inside of the firebox is painted', hint: 'Paint the inside of the firebox?',
        ask: ["Do you want the inside of the firebox painted too?", "Should the inside firebox be painted with heat-resistant paint?"],
        clarify: "The firebox needs a special high-heat paint, usually black, priced separately.",
        example: "Say 'yes' or 'no, leave the inside'.",
        options: [
          o('yes', 'firebox painted (high-heat paint)', /^\W*(?:yes|yeah|yep|sure|please|inside too|do it)\b/, 1, { add: { description: 'Firebox high-heat paint', amount: 175 } }),
          o('no', 'firebox left as is', /\b(?:no|nope|leave|skip|just)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Exposed beams
  {
    key: 'beams',
    thing: 'beams',
    present: (c) => has(c, 'beams'),
    lineKeys: ['beams'],
    priority: 30.5,
    questions: [
      {
        key: 'height', label: 'how high the ceiling is', hint: 'How high is the ceiling?',
        ask: ["How high is the ceiling the beams are on: standard (8 to 9 feet), 10 to 12 feet, or higher or vaulted?", "About how tall is the ceiling where the beams are?"],
        clarify: "Height is the biggest factor for beams: tall and vaulted ceilings need scaffolding or a lift.",
        example: "Say 'about 9 feet', '12 feet' or 'vaulted'.",
        options: [
          o('vaulted', 'high or vaulted (scaffold)', /\b(?:vaulted|cathedral|1[3-9]|2\d|very high|scaffold|lift|high)\b/, 1.7),
          o('tall', '10-12 ft', /\b(?:10|11|12|ten|eleven|twelve|tall)\b/, 1.3),
          o('standard', 'standard height', /\b(?:8|9|eight|nine|standard|normal|regular)\b/, 1),
        ],
      },
      {
        key: 'finish', label: 'what the beams are finished with and what you want', hint: 'Stained now? Paint, restain, or whitewash?',
        ask: ["What do you want done with the beams: paint them, restain them, or whitewash them? And are they stained or painted now?", "Are the beams stained or painted now, and what's the plan: paint, restain or whitewash?"],
        clarify: "Going from stained wood to paint needs a stain blocker and primer. Restaining means sanding. Whitewashing is a different technique.",
        example: "Say 'stained now, paint them white', 'restain' or 'whitewash'.",
        options: [
          o('stain_to_paint', 'stained, going to paint', /\b(?:stain\w*|dark|natural|wood)\b.*\b(?:paint|white|black)\b/, 1.35),
          o('restain', 'restain', /\b(?:re-?stain|stain)\b/, 1.3),
          o('whitewash', 'whitewash', /\bwhite[\s-]?wash|pickl\w*\b/, 1.2),
          o('paint', 'paint over paint', /\b(?:paint|painted|white|same)\b/, 1),
        ],
      },
      {
        key: 'type', label: 'what the beams are', hint: 'Real wood, faux, or coffered?',
        ask: ["Are they solid wood beams, faux hollow beams, or a coffered or tray ceiling?", "Real wood beams, faux beams, or a coffered ceiling?"],
        clarify: "Faux beams are smooth and quicker; rough solid or reclaimed wood soaks up much more finish; coffered ceilings have lots of faces.",
        example: "Say 'solid rough wood', 'faux' or 'coffered'.",
        options: [
          o('rough', 'rough/reclaimed solid wood', /\b(?:rough|reclaimed|rustic|solid|real|hand[\s-]?hewn|rough[\s-]?sawn|wood)\b/, 1.2),
          o('coffer', 'coffered/tray', /\b(?:coffer\w*|tray)\b/, 1.2),
          o('faux', 'faux beams', /\b(?:faux|fake|hollow|foam|polyurethane|box|smooth)\b/, 0.85),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Brick and masonry
  {
    key: 'brick',
    thing: 'brick',
    present: (c) => has(c, 'brick') || c.brickSqft != null,
    lineKeys: ['brick'],
    priority: 30.6,
    questions: [
      {
        key: 'now', label: 'whether the brick has been painted before', hint: 'Raw, or painted before?',
        ask: ["Has the brick been painted or sealed before, or is it raw brick?", "Is it bare brick, or has it been painted already?"],
        clarify: "Raw brick takes whatever finish you like. Painted brick can't take limewash or whitewash without stripping, and peeling paint has to be scraped first.",
        example: "Say 'raw brick', 'painted and in good shape' or 'painted and peeling'.",
        options: [
          o('peeling', 'painted and peeling (scrape/strip)', /\b(?:peel\w*|flak\w*|sealed|failing|chip\w*)\b/, 1.3),
          o('painted', 'painted before', /\b(?:paint|painted|coat\w*)\b/, 1),
          o('raw', 'raw brick', /\b(?:raw|bare|unpainted|natural|never|original|exposed|no)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what condition the mortar and brick are in', hint: 'Any white powder or crumbling?',
        ask: ["Any white powder, crumbling mortar or damp spots on it?", "Does the brick or mortar show white powder, crumbling or moisture?"],
        clarify: "White powder (efflorescence) and crumbling mortar have to be cleaned and repaired first, or the paint fails.",
        example: "Say 'no', 'a bit of white powder' or 'crumbling mortar'.",
        options: [
          o('bad', 'crumbling mortar/moisture', /\b(?:crumbl\w*|damp|moist\w*|water|leak\w*|cracked|loose|bad|a lot)\b/, 1.35),
          o('powder', 'white powder (efflorescence) to clean', /\b(?:powder\w*|white|efflorescence|salt\w*|a bit|some|little)\b/, 1.15),
          o('good', 'sound', /\b(?:no|none|good|fine|clean|nope|solid)\b/, 1),
        ],
      },
      {
        key: 'height', label: 'how high the brick is', hint: 'One story, or two plus chimney?',
        ask: ["How high does the brick go: one story, two stories, or a chimney too?", "Is the brick on the ground floor only, or higher up or on a chimney?"],
        clarify: "A second story or a chimney needs ladders or a lift and adds about half again.",
        example: "Say 'just one story' or 'up the chimney'.",
        when: (c) => outside(c),
        options: [
          o('tall', 'second story or chimney', /\b(?:two|2|second|chimney|upper|tall|high|three|3)\b/, 1.5),
          o('one', 'one story', /\b(?:one|1|single|ground|low|first|short)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Garage floor / epoxy
  {
    key: 'epoxy',
    thing: 'epoxy floor',
    present: (c) => has(c, 'epoxy') || c.epoxyGarageSqft != null,
    lineKeys: ['epoxy'],
    priority: 30.7,
    questions: [
      {
        key: 'now', label: 'what the floor is like now', hint: 'Bare, coated, or sealed?',
        ask: ["What's the floor like now: bare concrete, an old coating or paint, or sealed?", "Is the concrete bare, painted or coated already, or sealed?"],
        clarify: "An old coating has to be ground off first, and sealer stops new epoxy from bonding, so both add prep.",
        example: "Say 'bare concrete', 'old epoxy peeling' or 'sealed'.",
        options: [
          o('coated', 'old coating to remove', /\b(?:coat\w*|paint\w*|epoxy|peel\w*|old)\b/, 1.25),
          o('sealed', 'sealed (grind first)', /\b(?:seal\w*|stain\w*|polished)\b/, 1.1),
          o('bare', 'bare concrete', /\b(?:bare|raw|plain|new|unfinished|concrete)\b/, 1),
        ],
      },
      {
        key: 'condition', label: 'what condition the concrete is in', hint: 'Cracks, pits, or oil stains?',
        ask: ["Any cracks, pits, flaking spots or oil stains in the floor?", "How's the concrete itself: smooth, a few cracks, lots of cracks and pitting, or heavy oil stains?"],
        clarify: "Cracks and pits have to be filled and ground smooth, and heavy oil has to be treated before anything will stick.",
        example: "Say 'a few hairline cracks', 'lots of cracks' or 'oil stains'.",
        options: [
          o('many', 'many cracks or pitting (repair)', /\b(?:many|lots|wide|spall\w*|pits?|pitted|pitting|bad|deep|large|big cracks)\b/, 1.4),
          o('oil', 'oil stains (degrease)', /\b(?:oil|grease|stains?|heavy)\b/, 1.2),
          o('few', 'a few cracks', /\b(?:few|some|hairline|small|minor|crack\w*|little)\b/, 1.15),
          o('good', 'smooth and sound', /\b(?:no|none|good|smooth|clean|fine|nope)\b/, 1),
        ],
      },
      {
        key: 'finish', label: 'what epoxy finish you want', hint: 'Solid, flake, or metallic?',
        ask: ["What finish do you want: a plain solid color, color flakes, or a metallic?", "Solid color, decorative flake, or metallic epoxy?"],
        clarify: "Solid color is the basic system. Flake adds a broadcast and a topcoat, and metallic is the most involved.",
        example: "Say 'solid gray', 'flake' or 'metallic'.",
        when: (c) => !c.epoxyType,
        options: [
          o('metallic', 'metallic epoxy', /\bmetallic\b/, 1.8),
          o('flake', 'flake system', /\b(?:flake\w*|chips?|speckle\w*|decorative|full system)\b/, 1.4),
          o('solid', 'solid color', /\b(?:solid|plain|basic|simple|one color|gray|grey)\b/, 1),
        ],
      },
      {
        key: 'moisture', label: 'whether the floor gets damp', hint: 'Does the floor ever get damp?',
        ask: ["Does the floor ever get damp, with white powder or damp patches after rain?", "Any moisture problems with the slab?"],
        clarify: "Moisture coming up through the slab makes epoxy peel, so it needs a moisture-barrier primer.",
        example: "Say 'no' or 'it gets damp sometimes'.",
        options: [
          o('damp', 'damp slab (moisture barrier)', /\b(?:damp|moist\w*|wet|sometimes|yes|white powder|leak\w*|water)\b/, 1.2),
          o('dry', 'dry', /\b(?:no|dry|never|nope|fine|not)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Built-ins and bookcases
  {
    key: 'built_ins',
    thing: 'built-in shelving',
    present: (c) => has(c, 'built_ins') || c.builtInCount != null,
    lineKeys: ['built_ins'],
    priority: 29.75,
    questions: [
      {
        key: 'now', label: 'what the built-ins are finished with now', hint: 'Painted, stained, or laminate?',
        ask: ["Are the built-ins painted now, stained wood, or laminate?", "What are they finished with now: paint, stain, or laminate?"],
        clarify: "Stained wood and laminate need degloss and a bonding primer before paint, which adds a quarter or so.",
        example: "Say 'painted white', 'stained oak' or 'laminate'.",
        options: [
          o('stained', 'stained/laminate (degloss and prime)', /\b(?:stain\w*|varnish\w*|laminate|melamine|thermofoil|oak|natural)\b/, 1.25),
          o('painted', 'painted now', /\b(?:paint\w*|white|enamel|mdf)\b/, 1),
        ],
      },
      {
        key: 'shape', label: 'what the built-ins are like', hint: 'Open shelves, or doors too?',
        ask: ["Are they open shelves only, or do they have doors and drawers too?", "Just shelves, or shelves with cabinet doors and drawers?"],
        clarify: "Every shelf has five faces plus the back, and each door or drawer front is priced like a cabinet door.",
        example: "Say 'open shelves' or 'shelves with doors at the bottom'.",
        options: [
          o('doors', 'shelves plus doors/drawers', /\b(?:doors?|drawers?|cabinet\w*|both)\b/, 1.3),
          o('open', 'open shelves', /\b(?:open|shelves|shelf|just|only|bookcase)\b/, 1),
        ],
      },
      {
        key: 'height', label: 'how tall the built-ins are', hint: 'Standard height, or floor to ceiling?',
        ask: ["How tall are they: standard height, or floor to ceiling with a ladder needed?", "Do they go up past what a normal ladder reaches?"],
        clarify: "Anything above about eight feet means ladder work.",
        example: "Say 'about 6 feet' or 'floor to ceiling'.",
        options: [
          o('tall', 'floor to ceiling', /\b(?:ceiling|tall|high|floor to|10|9|ladder|over (?:8|eight))\b/, 1.15),
          o('standard', 'standard height', /\b(?:standard|normal|short|[3-7]|six|five|four|low)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Furniture
  {
    key: 'furniture',
    thing: 'furniture',
    present: (c) => c.furnitureItems.length > 0,
    lineKeys: ['furniture'],
    priority: 29.97,
    questions: [
      {
        key: 'material', label: 'what the furniture is made of', hint: 'Solid wood, veneer, laminate, or metal?',
        ask: ["What's it made of: solid wood, veneer, laminate (like a flat-pack piece), or metal?", "Is the furniture solid wood, veneer, laminate or metal?"],
        clarify: "Veneer is thin and can't be stripped hard. Laminate needs a bonding primer, and metal needs rust treatment and a metal primer.",
        example: "Say 'solid oak', 'veneer', 'laminate' or 'wrought iron'.",
        options: [
          o('metal', 'metal (rust treatment, metal primer)', /\b(?:metal|iron|steel|alumin(?:um|ium)|wrought)\b/, 1.25),
          o('laminate', 'laminate (bonding primer)', /\b(?:laminate|particle\s?board|mdf|melamine|ikea|flat[\s-]?pack|thermofoil)\b/, 1.25),
          o('veneer', 'veneer', /\bveneer\b/, 1),
          o('wood', 'solid wood', /\b(?:solid|wood|wooden|oak|pine|maple|cherry|walnut|teak|cedar)\b/, 1),
        ],
      },
      {
        key: 'detail', label: 'how detailed the furniture is', hint: 'Plain, or carved with spindles?',
        ask: ["Is it plain, or does it have carvings, spindles or lots of detail?", "Smooth and simple, or lots of spindles and carved detail?"],
        clarify: "Spindles and carving take a lot of brush time, so heavily detailed pieces are priced higher.",
        example: "Say 'plain', 'some detail' or 'heavy carving'.",
        options: [
          o('heavy', 'heavy carving or spindles', /\b(?:heavy|carv\w*|spindles?|ornate|intricate|lots|detailed|fancy)\b/, 1.5),
          o('some', 'some detail', /\b(?:some|bit|little|moderate|trim|routed)\b/, 1.2),
          o('plain', 'plain', /\b(?:plain|simple|smooth|flat|modern|no|clean)\b/, 1),
        ],
      },
      {
        key: 'where', label: 'whether the furniture lives outside', hint: 'Indoor, or outdoor use?',
        ask: ["Does it live inside the house, or out on a patio or deck?", "Is it used inside, or outside in the weather?"],
        clarify: "Outdoor pieces need an exterior-grade finish and more prep for weathering.",
        example: "Say 'inside' or 'it's patio furniture'.",
        when: (c) => c.projectType !== 'interior' || c.furnitureItems.some((i) => /lounger|bench|table_dining|chair/.test(i)),
        options: [
          o('outdoor', 'outdoor use (exterior-grade finish)', /\b(?:outdoor|outside|patio|deck|garden|porch|yard|pool)\b/, 1.2),
          o('indoor', 'kept inside', /\b(?:indoor|inside|house|living|bedroom|kitchen|dining room)\b/, 1),
        ],
      },
    ],
  },

  // ——————————————————————————————————— Closets
  {
    key: 'closets',
    thing: 'closets',
    present: (c) => c.closets !== 'none',
    lineKeys: ['closets'],
    priority: 29.935,
    questions: [
      {
        key: 'shelves', label: 'what the closet shelving is', hint: 'Wire, wood, or laminate shelves?',
        ask: ["What are the closet shelves: wire, wood, or laminate?", "Wire shelving, wood shelves, or laminate?"],
        clarify: "Wire shelving is slow to paint and often not worth it; wood shelves are normal; laminate needs a bonding primer.",
        example: "Say 'wire', 'wood' or 'laminate'.",
        options: [
          o('laminate', 'laminate shelves', /\b(?:laminate|melamine|white shelves)\b/, 1.3),
          o('wood', 'wood shelves', /\b(?:wood|wooden|shelves)\b/, 1.2),
          o('wire', 'wire shelving (left alone)', /\b(?:wire|rod|none|no shelves|just a rod)\b/, 1),
        ],
      },
      {
        key: 'contents', label: 'whether the closets are empty', hint: 'Empty, or full of stuff?',
        ask: ["Will the closets be emptied for the painters, or will we work around clothes and shelves?", "Empty closets, or full?"],
        clarify: "A full closet has to be masked and cut in around, which adds a lot of time.",
        example: "Say 'empty' or 'full of stuff'.",
        options: [
          o('full', 'full (work around contents)', /\b(?:full|clothes|stuff|work around|not empty|contents|items)\b/, 1.3),
          o('empty', 'empty', /\b(?:empty|cleared|nothing|will empty|vacant|yes)\b/, 1),
        ],
      },
    ],
  },
];
