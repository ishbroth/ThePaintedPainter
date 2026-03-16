import type { ConversationState, EstimatorContext, UserResponseStyle, ConversationNode } from './types';
import { allNodes, nodeOrder } from './conversationNodes';

// ===== Initial Context =====

export function createInitialContext(): EstimatorContext {
  return {
    zipCode: '',
    state: '',
    yearBuilt: null,
    propertyType: '',
    projectType: '',
    interiorScope: '',
    selectedRooms: [],
    interiorWalls: '',
    accentWalls: '',
    interiorCeilings: '',
    ceilingType: '',
    interiorTrim: '',
    crownMolding: '',
    wainscoting: '',
    baseboards: '',
    interiorDoors: '',
    doorCount: null,
    doorTypes: [],
    doorFrames: '',
    interiorWindows: '',
    windowCount: null,
    windowTypes: [],
    cabinets: '',
    cabinetLocations: [],
    closets: '',
    closetCount: null,
    stairways: '',
    stairwayCount: null,
    stairwayDetails: '',
    interiorShutters: '',
    interiorColorChange: '',
    exteriorScope: '',
    sidingType: '',
    exteriorTrim: '',
    soffitsEaves: '',
    exteriorShutters: '',
    exteriorShutterCount: null,
    garageDoor: '',
    entryDoor: '',
    railings: '',
    railingType: '',
    balconies: '',
    balconyCount: null,
    deck: '',
    deckSize: '',
    fence: '',
    fenceLinearFeet: null,
    gutters: '',
    foundation: '',
    exteriorWindows: '',
    exteriorWindowCount: null,
    overhangs: '',
    accessRestrictions: '',
    exteriorColorChange: '',
    exteriorCondition: '',
    prepWork: [],
    caulkingExtent: '',
    drywallRepairExtent: '',
    woodRotExtent: '',
    wallpaperRooms: null,
    popcornCeilingRooms: null,
    squareFeet: null,
    stories: null,
    ceilingHeight: '',
    occupancy: '',
    utilities: '',
    hoa: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactNotes: '',
    projectCondition: '',
    hasStainedWood: '',
    bedroomCount: null,
    trimCondition: '',
    wallTexture: '',
    doorMaterial: '',
    cabinetScope: '',
    closetShelving: '',
    stuccoCondition: '',
    exteriorRailingMaterial: '',
    interiorRailingMaterial: '',
    additionalDetails: '',
    specialtyServices: [],
    fireplaceType: '',
    fireplaceCount: null,
    beamLinearFeet: null,
    beamLocation: '',
    builtInCount: null,
    epoxyGarageSqft: null,
    epoxyType: '',
    furnitureItems: [],
    brickSqft: null,
    brickTreatment: '',
    answeredQuestions: 0,
    responseStyle: 'normal',
    responseLengths: [],
    specialtyReferrals: [],
    isHighCostArea: false,
    stateComplianceNotes: [],
  };
}

// ===== Initialize Conversation =====

export function initializeConversation(): ConversationState {
  return {
    currentNodeId: 'welcome',
    context: createInitialContext(),
    history: [],
    isComplete: false,
    estimate: null,
  };
}

// ===== Response Style Detection =====

function detectResponseStyle(ctx: EstimatorContext): UserResponseStyle {
  if (ctx.answeredQuestions < 4) return 'normal';

  const avgLength =
    ctx.responseLengths.length > 0
      ? ctx.responseLengths.reduce((a, b) => a + b, 0) / ctx.responseLengths.length
      : 5;

  if (avgLength <= 2 && ctx.answeredQuestions >= 4) return 'terse';
  if (avgLength >= 15 && ctx.answeredQuestions >= 6) return 'detailed';
  return 'normal';
}

// ===== Resolve Next Node (walk skip chains) =====

function resolveNextNode(nodeId: string | null, ctx: EstimatorContext): string | null {
  let currentId = nodeId;
  let safety = 0;

  while (currentId && safety < 100) {
    const node = allNodes[currentId];
    if (!node) return currentId;

    // Special handling for specialty_check virtual node
    if (currentId === 'specialty_check') {
      if (ctx.specialtyReferrals.length > 0) {
        return 'specialty_warning';
      }
      currentId = node.nextNodeId;
      safety++;
      continue;
    }

    if (node.skipWhen && node.skipWhen(ctx)) {
      currentId = node.nextNodeId;
      safety++;
      continue;
    }

    return currentId;
  }

  return currentId;
}

// ===== Advance Conversation =====

export function advanceConversation(
  state: ConversationState,
  answer: string | string[]
): ConversationState {
  const currentNode = allNodes[state.currentNodeId];
  if (!currentNode) return { ...state, isComplete: true };

  // Apply answer to context
  let newContext = { ...state.context };
  if (currentNode.onAnswer) {
    const updates = currentNode.onAnswer(newContext, answer);
    newContext = { ...newContext, ...updates };
  }

  // Track response for style detection
  const answerStr = Array.isArray(answer) ? answer.join(',') : answer;
  newContext.answeredQuestions += 1;
  newContext.responseLengths = [...newContext.responseLengths, answerStr.length];
  newContext.responseStyle = detectResponseStyle(newContext);

  // Record in history
  const newHistory = [...state.history, { nodeId: state.currentNodeId, answer }];

  // Resolve next node
  const nextNodeId = resolveNextNode(currentNode.nextNodeId, newContext);

  // Check if we've reached the result
  if (!nextNodeId || nextNodeId === 'result') {
    return {
      currentNodeId: 'result',
      context: newContext,
      history: newHistory,
      isComplete: true,
      estimate: null, // Will be calculated by the component
    };
  }

  return {
    currentNodeId: nextNodeId,
    context: newContext,
    history: newHistory,
    isComplete: false,
    estimate: null,
  };
}

// ===== Go Back =====

export function goBack(state: ConversationState): ConversationState {
  if (state.history.length === 0) return state;

  const newHistory = state.history.slice(0, -1);

  // Replay from scratch to rebuild context
  let replayState = initializeConversation();
  for (const entry of newHistory) {
    replayState = advanceConversation(replayState, entry.answer);
  }

  return replayState;
}

// ===== Progress Calculation =====

export function getProgress(state: ConversationState): number {
  const currentIndex = nodeOrder.indexOf(state.currentNodeId);
  if (currentIndex === -1) return 100;

  // Count only non-skipped nodes up to current position for accurate progress
  let activeNodes = 0;
  let passedNodes = 0;

  for (let i = 0; i < nodeOrder.length; i++) {
    const node = allNodes[nodeOrder[i]];
    if (!node) continue;
    const isSkipped = node.skipWhen && node.skipWhen(state.context);
    if (!isSkipped) {
      activeNodes++;
      if (i < currentIndex) passedNodes++;
    }
  }

  if (activeNodes === 0) return 0;
  return Math.round((passedNodes / activeNodes) * 100);
}

// ===== Get Current Node =====

export function getCurrentNode(state: ConversationState): ConversationNode | null {
  return allNodes[state.currentNodeId] || null;
}

// ===== Validate Answer =====

export function validateAnswer(
  state: ConversationState,
  answer: string | string[]
): string | null {
  const node = allNodes[state.currentNodeId];
  if (!node || !node.validate) return null;
  return node.validate(answer);
}
