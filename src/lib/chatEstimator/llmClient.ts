// ============================================================================
// LLM Extraction Client
// ============================================================================
// Calls the `chat-estimator-extract` Supabase Edge Function to have Claude
// interpret the user's latest message instead of the local regex-based
// extractors. This is a pure enhancement layer: on any failure, timeout, or
// malformed response, `extractWithLLM` returns null and the caller
// (chatEngine.ts) falls back to the local rules engine automatically. The
// LLM never sees or influences pricing — it only fills the same
// EstimatorContext fields the rules engine fills, which the existing
// deterministic pricing engine then prices exactly as before.
//
// Every field coming back from the model is whitelisted and validated here
// before it's allowed anywhere near the context — a hallucinated or
// malformed value is dropped rather than merged.
// ============================================================================

import { supabase } from '../supabase';
import type { EstimatorContext } from '../types';
import type { Intent } from './intents';
import { makeInitialContext } from './defaultContext';

const DEFAULT_CONTEXT = makeInitialContext();

/**
 * Only send fields that differ from a brand-new context's defaults. Without
 * this, placeholder defaults like interiorWalls: 'yes' (present before the
 * user has even said interior/exterior) get presented to the model as
 * "already known" facts — which previously caused it to see those interior
 * defaults sitting alongside a user answering "exterior" and conclude the
 * job must be "both", since interior details looked pre-confirmed.
 */
function diffFromDefaults(ctx: EstimatorContext): Partial<EstimatorContext> {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(ctx) as Array<keyof EstimatorContext>) {
    const value = ctx[key];
    const defaultValue = DEFAULT_CONTEXT[key];
    if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
      diff[key] = value;
    }
  }
  return diff as Partial<EstimatorContext>;
}

const TIMEOUT_MS = 8000;

export interface LLMExtractResult {
  patch: Partial<EstimatorContext>;
  acknowledgements: string[];
  intents: Intent[];
}

interface ChatTurn {
  role: 'bot' | 'user';
  text: string;
}

const VALID_INTENTS: Intent[] = [
  'greeting', 'ask_clarification', 'ask_example', 'express_uncertainty',
  'meta_cost', 'meta_how_it_works', 'meta_bot_check', 'meta_real_person',
  'meta_time', 'meta_privacy', 'off_topic', 'deflection', 'negation',
  'confirmation', 'scope_limiter', 'frustration', 'ready_to_finish',
  'restart', 'color_question', 'recommend_question', 'painter_question',
  'booking_question', 'provide_info',
];

const ROOM_KEYS = [
  'master_bedroom', 'bedroom_2', 'bedroom_3', 'bedroom_4', 'living_room',
  'dining_room', 'kitchen', 'bathroom_master', 'bathroom_2', 'bathroom_3',
  'office', 'laundry', 'hallway', 'entryway', 'garage', 'bonus_room',
];

function isEnum<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

function clampNumber(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : NaN;
  return isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

/** Whitelist + validate the raw tool-call input before it's allowed near pricing state. */
function sanitize(raw: Record<string, unknown>, prev: EstimatorContext): Partial<EstimatorContext> {
  const patch: Partial<EstimatorContext> = {};

  const zip = raw.zipCode;
  if (typeof zip === 'string' && /^\d{5}$/.test(zip)) patch.zipCode = zip;

  const sqft = clampNumber(raw.squareFeet, 100, 50000);
  if (sqft) patch.squareFeet = sqft;

  const beds = clampNumber(raw.bedroomCount, 0, 20);
  if (beds !== null) patch.bedroomCount = beds;

  const stories = clampNumber(raw.stories, 1, 3);
  if (stories) patch.stories = stories;

  const yearBuilt = clampNumber(raw.yearBuilt, 1800, 2030);
  if (yearBuilt) patch.yearBuilt = yearBuilt;

  if (isEnum(raw.propertyType, ['residential', 'rental', 'multi_unit', 'commercial'] as const)) patch.propertyType = raw.propertyType;
  if (isEnum(raw.timeline, ['asap', 'this_month', 'no_rush'] as const)) patch.timeline = raw.timeline;
  if (isEnum(raw.accessRestrictions, ['some', 'significant'] as const)) patch.accessRestrictions = raw.accessRestrictions;
  if (isEnum(raw.hoa, ['yes', 'no'] as const)) patch.hoa = raw.hoa;

  if (isEnum(raw.projectType, ['interior', 'exterior', 'both'] as const)) patch.projectType = raw.projectType;
  if (isEnum(raw.projectCondition, ['repaint', 'new_construction', 'renovation'] as const)) patch.projectCondition = raw.projectCondition;
  if (isEnum(raw.interiorScope, ['whole_house', 'specific_rooms'] as const)) patch.interiorScope = raw.interiorScope;

  if (Array.isArray(raw.selectedRooms)) {
    const rooms = raw.selectedRooms.filter((r) => ROOM_KEYS.includes(r));
    if (rooms.length > 0) patch.selectedRooms = rooms;
  }

  if (isEnum(raw.interiorWalls, ['yes', 'no'] as const)) patch.interiorWalls = raw.interiorWalls;
  if (isEnum(raw.interiorCeilings, ['yes', 'no'] as const)) patch.interiorCeilings = raw.interiorCeilings;
  if (isEnum(raw.interiorTrim, ['yes', 'no'] as const)) patch.interiorTrim = raw.interiorTrim;
  if (isEnum(raw.interiorDoors, ['none', 'some', 'all'] as const)) patch.interiorDoors = raw.interiorDoors;
  if (isEnum(raw.doorFrames, ['yes', 'no'] as const)) patch.doorFrames = raw.doorFrames;
  if (isEnum(raw.cabinets, ['none', 'kitchen', 'bathroom', 'laundry', 'multiple'] as const)) patch.cabinets = raw.cabinets;
  if (isEnum(raw.cabinetScope, ['fronts_only', 'inside_too'] as const)) patch.cabinetScope = raw.cabinetScope;
  if (isEnum(raw.closets, ['none', 'standard', 'walkin', 'both'] as const)) patch.closets = raw.closets;
  if (isEnum(raw.stairways, ['none', 'yes'] as const)) patch.stairways = raw.stairways;
  if (isEnum(raw.stairwayDetails, ['walls_only', 'walls_and_railings', 'full'] as const)) patch.stairwayDetails = raw.stairwayDetails;
  if (isEnum(raw.interiorShutters, ['yes', 'no'] as const)) patch.interiorShutters = raw.interiorShutters;
  if (isEnum(raw.interiorColorChange, ['same', 'different', 'dramatic'] as const)) patch.interiorColorChange = raw.interiorColorChange;
  if (isEnum(raw.ceilingType, ['flat', 'popcorn', 'vaulted'] as const)) patch.ceilingType = raw.ceilingType;
  if (isEnum(raw.ceilingHeight, ['nine_foot', 'ten_plus', 'vaulted_mixed'] as const)) patch.ceilingHeight = raw.ceilingHeight;
  if (isEnum(raw.wallTexture, ['smooth', 'textured', 'heavy_texture'] as const)) patch.wallTexture = raw.wallTexture;
  if (isEnum(raw.trimCondition, ['new', 'existing_fair'] as const)) patch.trimCondition = raw.trimCondition;
  if (isEnum(raw.crownMolding, ['yes'] as const)) patch.crownMolding = raw.crownMolding;
  if (isEnum(raw.wainscoting, ['yes'] as const)) patch.wainscoting = raw.wainscoting;
  if (isEnum(raw.accentWalls, ['yes'] as const)) patch.accentWalls = raw.accentWalls;
  if (isEnum(raw.hasStainedWood, ['yes'] as const)) patch.hasStainedWood = raw.hasStainedWood;
  if (isEnum(raw.closetShelving, ['wire', 'built_in'] as const)) patch.closetShelving = raw.closetShelving;
  if (isEnum(raw.woodRotExtent, ['moderate', 'major'] as const)) patch.woodRotExtent = raw.woodRotExtent;
  if (isEnum(raw.exteriorColorChange, ['same', 'different'] as const)) patch.exteriorColorChange = raw.exteriorColorChange;
  if (isEnum(raw.exteriorCondition, ['fair', 'poor'] as const)) patch.exteriorCondition = raw.exteriorCondition;
  if (isEnum(raw.stuccoCondition, ['new_stucco', 'needs_repair'] as const)) patch.stuccoCondition = raw.stuccoCondition;
  if (isEnum(raw.exteriorTrim, ['yes'] as const)) patch.exteriorTrim = raw.exteriorTrim;
  if (isEnum(raw.exteriorRailingMaterial, ['metal', 'composite', 'cable'] as const)) patch.exteriorRailingMaterial = raw.exteriorRailingMaterial;
  if (isEnum(raw.fireplaceType, ['brick_paint', 'brick_whitewash', 'stone', 'mantel_only'] as const)) patch.fireplaceType = raw.fireplaceType;
  if (isEnum(raw.beamLocation, ['vaulted'] as const)) patch.beamLocation = raw.beamLocation;
  if (isEnum(raw.sidingType, ['stucco', 'wood', 'vinyl', 'hardie', 'brick', 'stone', 'aluminum', 'mixed'] as const)) patch.sidingType = raw.sidingType;
  if (isEnum(raw.garageDoor, ['none', 'single', 'double'] as const)) patch.garageDoor = raw.garageDoor;
  if (isEnum(raw.entryDoor, ['yes', 'no'] as const)) patch.entryDoor = raw.entryDoor;
  if (isEnum(raw.deck, ['none', 'yes'] as const)) patch.deck = raw.deck;
  if (isEnum(raw.deckSize, ['small', 'medium', 'large'] as const)) patch.deckSize = raw.deckSize;
  if (isEnum(raw.fence, ['none', 'yes'] as const)) patch.fence = raw.fence;
  if (isEnum(raw.fenceType, ['picket_4ft', 'privacy_6ft', 'chain_link'] as const)) patch.fenceType = raw.fenceType;
  const fenceFt = clampNumber(raw.fenceLinearFeet, 1, 3000);
  if (fenceFt) patch.fenceLinearFeet = fenceFt;
  if (isEnum(raw.railings, ['none', 'yes'] as const)) patch.railings = raw.railings;
  if (isEnum(raw.railingType, ['simple', 'spindles', 'both'] as const)) patch.railingType = raw.railingType;
  if (isEnum(raw.balconies, ['none', 'yes'] as const)) patch.balconies = raw.balconies;
  if (isEnum(raw.gutters, ['yes', 'no'] as const)) patch.gutters = raw.gutters;
  if (isEnum(raw.foundation, ['yes', 'no'] as const)) patch.foundation = raw.foundation;
  if (isEnum(raw.overhangs, ['yes', 'no'] as const)) patch.overhangs = raw.overhangs;
  if (isEnum(raw.soffitsEaves, ['yes', 'no'] as const)) patch.soffitsEaves = raw.soffitsEaves;
  if (isEnum(raw.exteriorShutters, ['yes', 'no'] as const)) patch.exteriorShutters = raw.exteriorShutters;
  if (isEnum(raw.exteriorWindows, ['none', 'trim_only', 'full'] as const)) patch.exteriorWindows = raw.exteriorWindows;
  if (isEnum(raw.occupancy, ['vacant', 'furnished', 'occupied'] as const)) patch.occupancy = raw.occupancy;
  if (isEnum(raw.multiTripRequired, ['yes'] as const)) patch.multiTripRequired = raw.multiTripRequired;
  if (isEnum(raw.specialEquipment, ['extended_ladder', 'scaffolding', 'lift'] as const)) patch.specialEquipment = raw.specialEquipment;
  if (isEnum(raw.fixtureRemoval, ['minor', 'extensive'] as const)) patch.fixtureRemoval = raw.fixtureRemoval;
  if (isEnum(raw.hardwareReplacement, ['yes'] as const)) patch.hardwareReplacement = raw.hardwareReplacement;
  if (isEnum(raw.lowVocRequested, ['yes'] as const)) patch.lowVocRequested = raw.lowVocRequested;
  if (isEnum(raw.drywallRepairExtent, ['minor', 'moderate', 'major'] as const)) patch.drywallRepairExtent = raw.drywallRepairExtent;

  // Cumulative arrays: merge (add), never overwrite.
  if (Array.isArray(raw.windowTypesAdd)) {
    const add = raw.windowTypesAdd.filter((v) => v === 'french_pane' || v === 'bay');
    const merged = Array.from(new Set([...prev.windowTypes, ...add]));
    if (merged.length !== prev.windowTypes.length) patch.windowTypes = merged;
  }
  if (Array.isArray(raw.doorTypesAdd)) {
    const add = raw.doorTypesAdd.filter((v) => v === 'french');
    const merged = Array.from(new Set([...prev.doorTypes, ...add]));
    if (merged.length !== prev.doorTypes.length) patch.doorTypes = merged;
  }
  if (Array.isArray(raw.specialtyServicesAdd)) {
    const allowed = ['fireplace', 'beams', 'built_ins', 'epoxy', 'furniture', 'brick'];
    const add = raw.specialtyServicesAdd.filter((v) => allowed.includes(v));
    const merged = Array.from(new Set([...prev.specialtyServices, ...add]));
    if (merged.length !== prev.specialtyServices.length) patch.specialtyServices = merged;
  }
  if (Array.isArray(raw.prepWorkAdd)) {
    const allowed = ['caulking', 'stain_cover', 'drywall_repair', 'wood_rot', 'wallpaper_removal', 'power_washing', 'lead_test', 'mold_treatment'];
    const add = raw.prepWorkAdd.filter((v) => allowed.includes(v));
    const merged = Array.from(new Set([...prev.prepWork, ...add]));
    if (merged.length !== prev.prepWork.length) patch.prepWork = merged;
  }

  return patch;
}

function sanitizeIntents(raw: unknown): Intent[] {
  if (!Array.isArray(raw)) return ['provide_info'];
  const valid = raw.filter((v): v is Intent => VALID_INTENTS.includes(v as Intent));
  return valid.length > 0 ? valid : ['provide_info'];
}

// Meta-commentary about the conversation/user ("user frustrated", "confirmed
// prior details") occasionally slips in instead of an actual job fact. These
// are never legitimate acknowledgements, so drop them defensively even
// though the prompt also tells the model not to produce them.
const META_COMMENTARY_RE = /\b(user|customer|frustrat|confirm|prior detail|conversation|reset|reasoning|intent)\b/i;

function sanitizeAcks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => typeof v === 'string' && v.length > 0 && v.length < 60 && !META_COMMENTARY_RE.test(v))
    .slice(0, 6);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LLM extraction timed out')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Ask the LLM to interpret the user's latest message. Returns null on any
 * failure so the caller can fall back to the local rules engine — this
 * function is designed to never throw.
 */
export async function extractWithLLM(
  message: string,
  ctx: EstimatorContext,
  history: ChatTurn[],
  lastBotQuestion: string | null,
): Promise<LLMExtractResult | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('chat-estimator-extract', {
        body: { message, history, ctx: diffFromDefaults(ctx), lastBotQuestion },
      }),
      TIMEOUT_MS,
    );

    if (error || !data?.result) return null;

    const raw = data.result as Record<string, unknown>;
    return {
      patch: sanitize(raw, ctx),
      acknowledgements: sanitizeAcks(raw.acknowledgements),
      intents: sanitizeIntents(raw.intents),
    };
  } catch {
    return null;
  }
}
