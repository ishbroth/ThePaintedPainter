const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}

// ---------------------------------------------------------------- topics
patch('src/lib/chatEstimator/topics.ts', [
  // which_rooms
  ["    alreadyAnswered: (c) =>\n      c.interiorScope === 'whole_house' || c.selectedRooms.length > 0,\n    ask: (c) => {\n      const t = c.additionalDetails.toLowerCase();\n      const vague",
    "    alreadyAnswered: (c) =>\n      c.interiorScope === 'whole_house' || c.selectedRooms.length > 0 || isNarrowInteriorJob(c),\n    ask: (c) => {\n      const t = c.additionalDetails.toLowerCase();\n      const vague"],
  // house_size
  ["    relevant: (c) =>\n      c.projectType !== 'exterior' &&\n      c.interiorScope === 'whole_house' &&\n      !c.squareFeet,",
    "    relevant: (c) =>\n      c.projectType !== 'exterior' &&\n      c.interiorScope === 'whole_house' &&\n      !c.squareFeet &&\n      !isNarrowInteriorJob(c),"],
  // trim_scope
  ["    alreadyAnswered: (c) => c.trimScopeAddressed || c.doorFrames === 'yes' || c.specialtyServices.includes('built_ins'),",
    "    alreadyAnswered: (c) => c.trimScopeAddressed || c.trimLinearFeet != null || c.doorFrames === 'yes' || c.specialtyServices.includes('built_ins'),"],
  // condition
  ["    relevant: (c) => c.projectType !== 'exterior' && c.projectCondition !== 'new_construction',\n    alreadyAnswered: (c) => {\n      const t = c.additionalDetails.toLowerCase();",
    "    relevant: (c) => c.projectType !== 'exterior' && c.projectCondition !== 'new_construction' && c.stairwayDetails !== 'railings_only' && c.cabinets === 'none',\n    alreadyAnswered: (c) => {\n      const t = c.additionalDetails.toLowerCase();"],
  // color_change
  ["    relevant: (c) => c.projectType === 'interior' || c.projectType === 'both',\n    alreadyAnswered: (c) => !!c.interiorColorChange,",
    "    relevant: (c) =>\n      (c.projectType === 'interior' || c.projectType === 'both') &&\n      (c.interiorWalls !== 'no' || c.interiorCeilings === 'yes' || c.interiorTrim === 'yes' || c.cabinets !== 'none'),\n    alreadyAnswered: (c) => !!c.interiorColorChange,"],
  // siding
  ["    relevant: (c) => c.projectType === 'exterior' || c.projectType === 'both',\n    alreadyAnswered: (c) => !!c.sidingType,",
    "    relevant: (c) => (c.projectType === 'exterior' || c.projectType === 'both') && c.exteriorBody !== 'no',\n    alreadyAnswered: (c) => !!c.sidingType,"],
  // stories
  ["    relevant: (c) => c.projectType === 'exterior' || c.projectType === 'both',\n    alreadyAnswered: (c) => !!c.stories,",
    "    relevant: (c) =>\n      (c.projectType === 'exterior' || c.projectType === 'both') &&\n      (c.exteriorBody !== 'no' || c.exteriorTrim === 'yes' || c.gutters === 'yes' || c.soffitsEaves === 'yes' || c.exteriorWindows !== 'none'),\n    alreadyAnswered: (c) => !!c.stories,"],
  // timeline: any form of timing counts as answered
  ["    alreadyAnswered: (c) => (c.projectType === 'exterior' ? !!c.timeline : !!c.occupancy && !!c.timeline),",
    "    alreadyAnswered: (c) => (c.projectType === 'exterior' ? hasTiming(c) : !!c.occupancy && hasTiming(c)),"],
  ["      if (c.occupancy && !c.timeline) {", "      if (c.occupancy && !hasTiming(c)) {"],
  ["      if (!c.occupancy && c.timeline) {", "      if (!c.occupancy && hasTiming(c)) {"],
  // helpers
  ["const isCommercialLike = (c: EstimatorContext) =>",
    `/** Any form of timing counts: ASAP/no-rush, a start date, a range, or "my dates are flexible". */
const hasTiming = (c: EstimatorContext) => !!(c.timeline || c.startDate || c.endDate || c.datesFlexible);

/** The customer narrowed the job to one thing (a railing, cabinets, trim footage, popcorn removal...) so whole-house questions don't apply. */
const isNarrowInteriorJob = (c: EstimatorContext) =>
  c.interiorWalls === 'no' &&
  c.surfacesAddressed &&
  (c.stairwayDetails === 'railings_only' || c.cabinets !== 'none' || c.trimLinearFeet != null || c.popcornCeilingSqft != null || c.prepWork.includes('popcorn_removal') || c.interiorTrim === 'yes' || c.interiorCeilings === 'yes');

const isCommercialLike = (c: EstimatorContext) =>`],
]);

// ---------------------------------------------------------------- extractors (the rules engine fallback)
patch('src/lib/chatEstimator/extractors.ts', [
  // property type: owners / "I live here"
  ["  if (/\\b(my home|our house|we live (?:here|there|in it)|owner[\\s-]?occupied|primary residence|our (?:forever )?home)\\b/.test(t)) {\n    return 'residential';\n  }",
    "  if (/\\b(my home|our house|my house|my condo|my townhome|my townhouse|my place|we live (?:here|there|in it)|i live (?:here|there|in it)|owner[\\s-]?occupied|primary residence|our (?:forever )?home|i own (?:it|the (?:house|home|condo|place))|we own (?:it|the (?:house|home|condo|place)))\\b/.test(t)) {\n    return 'residential';\n  }"],
  // timeline: "no rush" must beat the bare word "rush"; "whenever" and month-only phrasing
  ["  if (/\\b(asap|urgent|as soon as possible|this week|next week|by (?:next )?weekend|rush|need(?:s|ed)? (?:it |this )?done (?:now|immediately|next week)|right away)\\b/.test(t)) {\n    return 'asap';\n  }\n  if (/\\b(no rush|whenever|not urgent|flexible timeline|no hurry|nothing urgent)\\b/.test(t)) {\n    return 'no_rush';\n  }\n  if (/\\b(this month|within a month|next few weeks|couple weeks)\\b/.test(t)) {\n    return 'this_month';\n  }\n  return null;",
    "  if (/\\b(no rush|not (?:in )?a rush|whenever|not urgent|flexible timeline|no hurry|nothing urgent|no deadline|take your time|any ?time)\\b/.test(t)) {\n    return 'no_rush';\n  }\n  if (/\\b(asap|urgent|as soon as possible|this week|next week|(?:this|next) weekend|by (?:next )?weekend|rush|need(?:s|ed)? (?:it |this )?done (?:now|immediately|next week)|right away)\\b/.test(t)) {\n    return 'asap';\n  }\n  if (/\\b(this month|within a month|next few weeks|couple weeks|next month|mid[\\s-]?(?:month|\\w+)|end of the month|before (?:the )?holidays?|before (?:thanksgiving|christmas))\\b/.test(t)) {\n    return 'this_month';\n  }\n  // a named month with no day (like sometime in March) is a loose window, not a rush\n  if (/\\b(?:in|during|sometime in|early|late|around)\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b/.test(t)) {\n    return 'no_rush';\n  }\n  if (/\\b(?:spring|summer|fall|autumn|winter)\\b/.test(t)) return 'no_rush';\n  return null;"],
  // color change
  ["  if (/\\b(different\\s+color|new\\s+color|change\\s+the\\s+color|changing\\s+color)\\b/.test(t)) return 'different';\n  if (/\\b(same\\s+color|match(?:ing)?\\s+(?:the\\s+)?existing)\\b/.test(t)) return 'same';\n  return null;",
    "  if (/\\b(different\\s+color|new\\s+color|change\\s+the\\s+color|changing\\s+color|different\\s+one|something\\s+(?:new|different)|a\\s+(?:new|different)\\s+(?:shade|one|paint)|going\\s+(?:from\\s+[\\w\\s-]{2,30}\\s+)?to\\s+(?:a\\s+|an\\s+)?(?:\\w+\\s+)?(?:white|grey|gray|beige|tan|blue|green|navy|black|red|yellow|cream|color|shade|dark|light|darker|lighter|bold|brighter)|changing\\s+(?:it\\s+)?(?:from\\s+[\\w\\s-]{2,30}\\s+)?to|switching\\s+to|painting\\s+it\\s+(?:a\\s+)?(?:new|different)|repainting\\s+(?:it\\s+)?(?:a\\s+)?(?:new|different))\\b/.test(t)) return 'different';\n  if (/\\b(same\\s+(?:\\w+\\s+)?colou?r|same\\s+(?:white|beige|grey|gray|tan|cream)|match(?:ing)?\\s+(?:the\\s+)?(?:existing|current)|keep(?:ing)?\\s+(?:the\\s+)?(?:same|current|existing)|no\\s+colou?r\\s+change|not\\s+changing\\s+(?:the\\s+)?colou?r|staying\\s+(?:the\\s+)?same|just\\s+(?:a\\s+)?(?:fresh coat|refresh|touch[\\s-]?up))\\b/.test(t)) return 'same';\n  return null;"],
  // occupancy: "i live here" / "lived-in" / "occupied"
  ["    occupied: /\\b(occupied|we live|living here|we'?re still (?:here|in)|kids at home|pets at home)\\b/.test(t),",
    "    occupied: /\\b(occupied|we live|i live|living here|lived[\\s-]?in|live in it|we'?re still (?:here|in)|kids at home|pets at home|people living)\\b/.test(t),"],
]);
console.log('ok');
