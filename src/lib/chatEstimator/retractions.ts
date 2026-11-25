// ============================================================================
// Taking something back: "I changed my mind, no common areas", "never mind the closets", "wait, no", "forget the fence"
// ============================================================================
// A customer must be able to take back something they said and have it come off the list. A message with one of these cues that names
// something in the job removes that thing (and what hangs off it) and records it as answered so it is not asked about again. A cue with
// nothing named ("never mind", "wait no", "forget it") takes back the last answer, the same as "back up".
// ============================================================================

import type { EstimatorContext } from '../types';

export interface Retraction {
  /** What to change in the notes (absent for a bare "never mind": that one backs up a step). */
  patch?: Partial<EstimatorContext>;
  /** Questions that are settled by this, so they are not asked again. */
  answered?: string[];
  /** Surfaces to remember as ruled out. */
  excluded?: string[];
  /** What was taken off, for the reply ("the common areas"). */
  label?: string;
  /** A bare cue with nothing named. */
  generic?: boolean;
}

/** "I changed my mind", "never mind", "wait, no", "scratch that", "forget about the...", "actually, skip...", "leave it out". */
export const RETRACT_CUE = new RegExp(
  '\\b(?:i\\s+)?(?:changed my mind|change my mind|changing my mind|never\\s?mind|nvm|wait,?\\s+no|scratch (?:that|it)|strike that|forget (?:it|that|about|the|all)|' +
    'actually,?\\s+(?:no|skip|let\'?s skip|don\'?t|leave|forget|take)|cancel (?:that|it)|take (?:that|it|them) (?:out|off)|on second thought|not anymore|' +
    'oops,?\\s+no|no wait)\\b',
  'i',
);

interface Target {
  re: RegExp;
  label: string;
  patch: Partial<EstimatorContext>;
  answered?: string[];
  excluded?: string[];
}

const TARGETS: Target[] = [
  { re: /\b(?:common (?:areas?|spaces?)|hall(?:way)?s|corridors?|lobb(?:y|ies)|stair(?:well)?s|laundry (?:room|area))\b/, label: 'the common areas', patch: { commonAreas: 'no', commonAreaSqft: null }, answered: ['common_areas'] },
  { re: /\b(?:closet shel(?:ves|ving|f)|shel(?:ves|ving) in the closets?)\b|\bshel(?:ves|ving)\b/, label: 'the closet shelves', patch: { closetShelving: 'none' }, answered: ['closet_shelves'] },
  { re: /\bclosets?\b/, label: 'the closets', patch: { closets: 'none', closetShelving: 'none', closetCount: null, closetKinds: undefined }, answered: ['closets_included', 'closet_shelves', 'closet_count'], excluded: ['closets'] },
  { re: /\bcabinet(?:s|ry)?\b|\bvanit(?:y|ies)\b/, label: 'the cabinets', patch: { cabinets: 'none', cabinetLocations: [], cabinetDoorCount: null }, answered: ['upsell_cabinets', 'cabinet_finish', 'cabinet_count', 'cabinet_scope', 'cabinet_method', 'cabinet_hardware'], excluded: ['cabinets'] },
  { re: /\bceilings?\b/, label: 'the ceilings', patch: { interiorCeilings: 'no' }, excluded: ['ceilings'] },
  { re: /\b(?:trim|baseboards?)\b/, label: 'the trim', patch: { interiorTrim: 'no', trimLinearFeet: null }, excluded: ['trim'] },
  { re: /\bdoors?\b/, label: 'the doors', patch: { interiorDoors: 'none', doorCount: null, doorsIncluded: false }, excluded: ['doors'] },
  { re: /\bfenc(?:e|es|ing)\b/, label: 'the fence', patch: { fence: 'none', fenceLinearFeet: null, fenceHeightFt: null }, answered: ['fence_size', 'fence_height'] },
  { re: /\bdeck\b/, label: 'the deck', patch: { deck: 'none', deckSqft: null, deckSize: '' }, answered: ['deck_size'] },
  { re: /\b(?:overhangs?|patio covers?|pergolas?|carports?)\b/, label: 'the overhangs', patch: { overhangs: 'no', overhangSqft: null }, answered: ['overhang_size'] },
  { re: /\b(?:gutters?|downspouts?)\b/, label: 'the gutters', patch: { gutters: 'no' } },
  { re: /\bshutters?\b/, label: 'the shutters', patch: { exteriorShutters: 'no', exteriorShutterCount: null, interiorShutters: 'no', interiorShutterCount: null }, answered: ['shutter_count'] },
  { re: /\bgarage doors?\b/, label: 'the garage door', patch: { garageDoor: 'none' } },
  { re: /\b(?:front|entry|entrance) doors?\b/, label: 'the entry door', patch: { entryDoor: 'no' } },
  { re: /\b(?:balcon(?:y|ies)|breezeways?)\b/, label: 'the balconies', patch: { balconies: 'none', balconyCount: null } },
  { re: /\brailings?\b/, label: 'the railings', patch: { railings: 'none', railingType: '' } },
  { re: /\bwindows?\b/, label: 'the windows', patch: { exteriorWindows: 'none', exteriorWindowCount: null, interiorWindows: 'none', windowCount: null } },
  { re: /\bfireplace|mantel\b/, label: 'the fireplace', patch: { fireplaceType: '', fireplaceCount: null } },
];

/** What a message takes back, if it takes anything back: null for an ordinary message. */
export function readRetraction(text: string): Retraction | null {
  const low = text.toLowerCase();
  const cue = RETRACT_CUE.test(low);
  if (!cue) return null;
  // the most specific thing named (the list goes from specific to general: "closet shelves" before "closets")
  for (const t of TARGETS) {
    if (!t.re.test(low)) continue;
    return { patch: t.patch, answered: t.answered, excluded: t.excluded, label: t.label };
  }
  if (low.split(/\s+/).filter(Boolean).length <= 5) return { generic: true };
  return null;
}
