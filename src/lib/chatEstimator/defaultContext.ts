// Split out from chatEngine.ts so llmClient.ts can import it too (to diff
// the current context against its defaults) without a circular dependency —
// chatEngine.ts imports llmClient.ts, so llmClient.ts can't import back from
// chatEngine.ts.

import type { EstimatorContext } from '../types';

export function makeInitialContext(): EstimatorContext {
  return {
    zipCode: '', state: '', yearBuilt: null, propertyType: '', projectType: '',
    interiorScope: '', selectedRooms: [], interiorWalls: 'yes', accentWalls: 'no',
    interiorCeilings: 'yes', ceilingType: '', interiorTrim: 'yes', crownMolding: 'no',
    wainscoting: 'no', baseboards: 'yes', interiorDoors: 'some', doorCount: null, doorTypes: [],
    doorFrames: 'no', interiorWindows: 'none', windowCount: null, windowTypes: [],
    cabinets: 'none', cabinetLocations: [], closets: 'none', closetCount: null,
    stairways: 'none', stairwayCount: null, stairwayDetails: '', interiorShutters: 'no',
    interiorColorChange: '',
    exteriorScope: 'full', sidingType: '', exteriorTrim: 'no', soffitsEaves: 'no',
    exteriorShutters: 'no', exteriorShutterCount: null, garageDoor: 'none', entryDoor: 'no',
    railings: 'none', railingType: '', balconies: 'none', balconyCount: null,
    deck: 'none', deckSize: '', fence: 'none', fenceLinearFeet: null, fenceType: 'privacy_6ft', gutters: 'no',
    foundation: 'no', exteriorWindows: 'none', exteriorWindowCount: null, overhangs: 'no',
    accessRestrictions: 'none', exteriorColorChange: '', exteriorCondition: 'good',
    prepWork: [], caulkingExtent: 'minor', drywallRepairExtent: 'minor',
    woodRotExtent: 'minor', wallpaperRooms: null, popcornCeilingRooms: null,
    multiTripRequired: '', specialEquipment: 'none', fixtureRemoval: 'none',
    hardwareReplacement: 'no', lowVocRequested: 'no',
    squareFeet: null, stories: null, ceilingHeight: 'standard', occupancy: '',
    utilities: 'yes', hoa: 'no', timeline: '',
    contactName: '', contactPhone: '', contactEmail: '', contactNotes: '',
    projectCondition: '', hasStainedWood: 'no', bedroomCount: null,
    trimCondition: 'existing_good', wallTexture: 'smooth', doorMaterial: 'wood',
    cabinetScope: 'fronts_only', closetShelving: 'none', stuccoCondition: 'good',
    exteriorRailingMaterial: 'wood', interiorRailingMaterial: 'wood', additionalDetails: '',
    specialtyServices: [], fireplaceType: '', fireplaceCount: null, beamLinearFeet: null,
    beamLocation: 'standard', builtInCount: null, epoxyGarageSqft: null, epoxyType: 'basic',
    furnitureItems: [], brickSqft: null, brickTreatment: 'paint',
    answeredQuestions: 0, responseStyle: 'normal', responseLengths: [],
    specialtyReferrals: [], isHighCostArea: false, stateComplianceNotes: [],
  };
}
