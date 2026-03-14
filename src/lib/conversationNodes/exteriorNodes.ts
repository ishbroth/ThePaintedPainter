import type { ConversationNode } from '../types';

const v = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

export const exteriorNodes: Record<string, ConversationNode> = {
  exterior_scope: {
    id: 'exterior_scope',
    question: 'What is the scope of the exterior painting?',
    inputType: 'select',
    options: [
      { label: 'Full Exterior', value: 'full' },
      { label: 'Partial / Touch-up', value: 'partial' },
    ],
    nextNodeId: 'exterior_siding',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ exteriorScope: v(value) }),
  },

  exterior_siding: {
    id: 'exterior_siding',
    question: 'What type of siding does the property have?',
    inputType: 'select',
    options: [
      { label: 'Stucco', value: 'stucco' },
      { label: 'Wood (Lap/Shingle)', value: 'wood' },
      { label: 'Vinyl', value: 'vinyl' },
      { label: 'Hardie Board / Fiber Cement', value: 'hardie' },
      { label: 'Brick', value: 'brick' },
      { label: 'Stone', value: 'stone' },
      { label: 'Mixed Materials', value: 'mixed' },
    ],
    nextNodeId: 'exterior_trim',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ sidingType: v(value) }),
  },

  exterior_trim: {
    id: 'exterior_trim',
    question: 'Does the exterior trim and fascia need painting?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_soffits',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ exteriorTrim: v(value) }),
  },

  exterior_soffits: {
    id: 'exterior_soffits',
    question: 'Do the soffits and eaves need painting?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_shutters',
    category: 'exterior',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ soffitsEaves: v(value) }),
  },

  exterior_shutters: {
    id: 'exterior_shutters',
    question: 'Are there exterior shutters to be painted?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_shutter_count',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ exteriorShutters: v(value) }),
  },

  exterior_shutter_count: {
    id: 'exterior_shutter_count',
    question: 'How many shutters?',
    inputType: 'number',
    placeholder: '8',
    nextNodeId: 'exterior_garage_door',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior' || ctx.exteriorShutters !== 'yes',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 50) return 'Please enter a number between 1 and 50';
      return null;
    },
    onAnswer: (_ctx, value) => ({ exteriorShutterCount: parseInt(v(value), 10) }),
  },

  exterior_garage_door: {
    id: 'exterior_garage_door',
    question: 'Is there a garage door to be painted?',
    inputType: 'select',
    options: [
      { label: 'No Garage Door', value: 'none' },
      { label: 'Single Garage Door', value: 'single' },
      { label: 'Double Garage Door', value: 'double' },
    ],
    nextNodeId: 'exterior_entry_door',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ garageDoor: v(value) }),
  },

  exterior_entry_door: {
    id: 'exterior_entry_door',
    question: 'Does the front/entry door need painting?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_railings',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ entryDoor: v(value) }),
  },

  exterior_railings: {
    id: 'exterior_railings',
    question: 'Are there exterior railings or handrails to paint?',
    inputType: 'select',
    options: [
      { label: 'No Railings', value: 'none' },
      { label: 'Yes', value: 'yes' },
    ],
    nextNodeId: 'exterior_railing_type',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ railings: v(value) }),
  },

  exterior_railing_type: {
    id: 'exterior_railing_type',
    question: 'What type of railings?',
    inputType: 'select',
    options: [
      { label: 'Simple Handrails', value: 'simple' },
      { label: 'Railings with Spindles/Balusters', value: 'spindles' },
      { label: 'Both Types', value: 'both' },
    ],
    nextNodeId: 'exterior_balconies',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior' || ctx.railings === 'none',
    onAnswer: (_ctx, value) => ({ railingType: v(value) }),
  },

  exterior_balconies: {
    id: 'exterior_balconies',
    question: 'Are there any balconies that need painting?',
    inputType: 'select',
    options: [
      { label: 'No Balconies', value: 'none' },
      { label: 'Yes', value: 'yes' },
    ],
    nextNodeId: 'exterior_balcony_count',
    category: 'exterior',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ balconies: v(value) }),
  },

  exterior_balcony_count: {
    id: 'exterior_balcony_count',
    question: 'How many balconies?',
    inputType: 'number',
    placeholder: '1',
    nextNodeId: 'exterior_deck',
    category: 'exterior',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.balconies !== 'yes',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 10) return 'Please enter a number between 1 and 10';
      return null;
    },
    onAnswer: (_ctx, value) => ({ balconyCount: parseInt(v(value), 10) }),
  },

  exterior_deck: {
    id: 'exterior_deck',
    question: 'Is there a deck that needs staining or painting?',
    inputType: 'select',
    options: [
      { label: 'No Deck', value: 'none' },
      { label: 'Yes', value: 'yes' },
    ],
    nextNodeId: 'exterior_deck_size',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ deck: v(value) }),
  },

  exterior_deck_size: {
    id: 'exterior_deck_size',
    question: 'How large is the deck?',
    inputType: 'select',
    options: [
      { label: 'Small (under 150 sq ft)', value: 'small' },
      { label: 'Medium (150-350 sq ft)', value: 'medium' },
      { label: 'Large (350+ sq ft)', value: 'large' },
    ],
    nextNodeId: 'exterior_fence',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior' || ctx.deck !== 'yes',
    onAnswer: (_ctx, value) => ({ deckSize: v(value) }),
  },

  exterior_fence: {
    id: 'exterior_fence',
    question: 'Is there a fence to be painted or stained?',
    inputType: 'select',
    options: [
      { label: 'No Fence', value: 'none' },
      { label: 'Yes', value: 'yes' },
    ],
    nextNodeId: 'exterior_fence_size',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ fence: v(value) }),
  },

  exterior_fence_size: {
    id: 'exterior_fence_size',
    question: 'Approximately how many linear feet of fence?',
    inputType: 'number',
    placeholder: '100',
    nextNodeId: 'exterior_gutters',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior' || ctx.fence !== 'yes',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 10 || n > 2000) return 'Please enter a number between 10 and 2000';
      return null;
    },
    onAnswer: (_ctx, value) => ({ fenceLinearFeet: parseInt(v(value), 10) }),
  },

  exterior_gutters: {
    id: 'exterior_gutters',
    question: 'Do the gutters and downspouts need painting?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_foundation',
    category: 'exterior',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ gutters: v(value) }),
  },

  exterior_foundation: {
    id: 'exterior_foundation',
    question: 'Does the foundation / stem wall need painting?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_windows',
    category: 'exterior',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ foundation: v(value) }),
  },

  exterior_windows: {
    id: 'exterior_windows',
    question: 'Do exterior windows need painting?',
    inputType: 'select',
    options: [
      { label: 'No', value: 'none' },
      { label: 'Window Trim Only', value: 'trim_only' },
      { label: 'Full Window Frames & Trim', value: 'full' },
    ],
    nextNodeId: 'exterior_window_count',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ exteriorWindows: v(value) }),
  },

  exterior_window_count: {
    id: 'exterior_window_count',
    question: 'Approximately how many exterior windows?',
    inputType: 'number',
    placeholder: '12',
    nextNodeId: 'exterior_overhangs',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior' || ctx.exteriorWindows === 'none',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 200) return 'Please enter a number between 1 and 200';
      return null;
    },
    onAnswer: (_ctx, value) => ({ exteriorWindowCount: parseInt(v(value), 10) }),
  },

  exterior_overhangs: {
    id: 'exterior_overhangs',
    question: 'Are there large overhangs or covered patios to paint?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'exterior_access',
    category: 'exterior',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ overhangs: v(value) }),
  },

  exterior_access: {
    id: 'exterior_access',
    question: 'Are there any access restrictions for the exterior?',
    subtext: 'Steep hillside, tight alley, etc.',
    inputType: 'select',
    options: [
      { label: 'No Restrictions', value: 'none' },
      { label: 'Some Restrictions', value: 'some' },
      { label: 'Significant Restrictions', value: 'significant' },
    ],
    nextNodeId: 'exterior_color_change',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ accessRestrictions: v(value) }),
  },

  exterior_color_change: {
    id: 'exterior_color_change',
    question: 'How different will the new exterior colors be?',
    inputType: 'select',
    options: [
      { label: 'Same or Similar Colors', value: 'same' },
      { label: 'Different Colors', value: 'different' },
    ],
    nextNodeId: 'exterior_condition',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ exteriorColorChange: v(value) }),
  },

  exterior_condition: {
    id: 'exterior_condition',
    question: 'What is the overall condition of the exterior paint?',
    subtext: 'This affects the amount of prep work needed.',
    inputType: 'select',
    options: [
      { label: 'Good - Minor touch-ups needed', value: 'good' },
      { label: 'Fair - Some peeling/cracking', value: 'fair' },
      { label: 'Poor - Extensive peeling/damage', value: 'poor' },
    ],
    nextNodeId: 'prep_overview',
    category: 'exterior',
    skipWhen: (ctx) => ctx.projectType === 'interior',
    onAnswer: (_ctx, value) => ({ exteriorCondition: v(value) }),
  },
};
