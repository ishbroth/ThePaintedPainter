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
    interiorColorChange: '', ceilingColorChange: '',
    colorChangeScope: '', colorChangeExcludedRoomCount: null, colorCount: null, colorClarificationNeeded: '',
    multiPhaseRequested: '',
    trimLinearFeet: null, crownLinearFeet: null, accentWallCount: null, stairRailFeet: null, popcornCeilingSqft: null,
    cabinetDoorCount: null, deckSqft: null, overhangSqft: null, pressureWashSqft: null,
    fenceHeightFt: null, chairCount: null, chairRail: 'no', chairRailLinearFeet: null, wainscotSqft: null, interiorShutterCount: null, detailRoomCount: null,
    unitCount: null, unitsTotal: null, buildingCount: null, commonAreas: '', commonAreaSqft: null,
    exteriorBody: '', excludedRooms: [], excludedItems: [],
    exteriorScope: 'full', sidingType: '', houseStyle: '', trimMaterial: '', exteriorTrim: 'no', soffitsEaves: 'no',
    exteriorShutters: 'no', exteriorShutterCount: null, garageDoor: 'none', entryDoor: 'no',
    railings: 'none', railingType: '', balconies: 'none', balconyCount: null,
    deck: 'none', deckSize: '', fence: 'none', fenceLinearFeet: null, fenceType: 'privacy_6ft', gutters: 'no',
    foundation: 'no', exteriorWindows: 'none', exteriorWindowCount: null, overhangs: 'no',
    accessRestrictions: 'none', exteriorColorChange: '', exteriorCondition: 'good',
    prepWork: [], caulkingExtent: 'minor', drywallRepairExtent: 'minor', conditionAddressed: false,
    renoStageAddressed: false, trimScopeAddressed: false, surfacesAddressed: false,
    woodRotExtent: 'minor', wallpaperRooms: null, popcornCeilingRooms: null,
    multiTripRequired: '', specialEquipment: 'none', fixtureRemoval: 'none',
    hardwareReplacement: 'no', lowVocRequested: 'no',
    squareFeet: null, stories: null, ceilingHeight: 'standard', tallCeilingShare: null, occupancy: '',
    utilities: 'yes', hoa: 'no', timeline: '', startDate: '', endDate: '', datesFlexible: false, afterHoursRequired: '',
    preferredPainterId: '', preferredPainterName: '', zipFromHistory: false,
    contactName: '', contactPhone: '', contactEmail: '', contactNotes: '',
    projectCondition: '', hasStainedWood: 'no', bedroomCount: null,
    trimCondition: 'existing_good', wallTexture: 'smooth', doorMaterial: 'wood',
    cabinetScope: 'fronts_only', cabinetMethod: '', cabinetFinish: '', trimFinish: '', doorFinish: '', closetShelving: 'none', stuccoCondition: 'good',
    exteriorRailingMaterial: 'wood', interiorRailingMaterial: 'wood', additionalDetails: '',
    specialtyServices: [], fireplaceType: '', fireplaceCount: null, beamLinearFeet: null,
    beamLocation: 'standard', builtInCount: null, epoxyGarageSqft: null, epoxyType: 'basic',
    furnitureItems: [], itemsOnly: false, furnitureUnspecified: false, furnitureCountKnown: false, furnitureTreatment: '', furnitureMaterial: '', furnitureSanding: false, brickSqft: null, brickTreatment: 'paint',
    answeredQuestions: 0, responseStyle: 'normal', responseLengths: [],
    specialtyReferrals: [], isHighCostArea: false, stateComplianceNotes: [],
    photoRequests: [], photos: [],
  };
}
