import type { ConversationNode } from '../types';

const v = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

export const propertyNodes: Record<string, ConversationNode> = {
  property_sqft: {
    id: 'property_sqft',
    question: 'What is the approximate square footage of the property?',
    subtext: "Your best estimate is fine -- we'll refine during the on-site visit.",
    inputType: 'number',
    placeholder: '1800',
    nextNodeId: 'property_stories',
    category: 'property',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 200 || n > 50000) return 'Please enter a number between 200 and 50,000';
      return null;
    },
    onAnswer: (_ctx, value) => ({ squareFeet: parseInt(v(value), 10) }),
  },

  property_stories: {
    id: 'property_stories',
    question: 'How many stories is the property?',
    inputType: 'select',
    options: [
      { label: '1 Story', value: '1' },
      { label: '2 Stories', value: '2' },
      { label: '3+ Stories', value: '3' },
    ],
    nextNodeId: 'property_ceiling_height',
    category: 'property',
    onAnswer: (_ctx, value) => ({ stories: parseInt(v(value), 10) }),
  },

  property_ceiling_height: {
    id: 'property_ceiling_height',
    question: 'What is the typical ceiling height?',
    inputType: 'select',
    options: [
      { label: 'Standard (8 ft)', value: 'standard' },
      { label: '9 Foot Ceilings', value: 'nine_foot' },
      { label: '10+ Foot Ceilings', value: 'ten_plus' },
      { label: 'Mixed / Vaulted Areas', value: 'vaulted_mixed' },
    ],
    nextNodeId: 'property_occupancy',
    category: 'property',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ ceilingHeight: v(value) }),
  },

  property_occupancy: {
    id: 'property_occupancy',
    question: 'Will the property be occupied during painting?',
    subtext: 'Vacant properties are faster and easier to paint.',
    inputType: 'select',
    options: [
      { label: 'Vacant / Empty', value: 'vacant' },
      { label: 'Furnished but Unoccupied', value: 'furnished' },
      { label: 'Occupied / Living There', value: 'occupied' },
    ],
    nextNodeId: 'property_utilities',
    category: 'property',
    onAnswer: (_ctx, value) => ({ occupancy: v(value) }),
  },

  property_utilities: {
    id: 'property_utilities',
    question: 'Are all utilities (water, electricity) turned on at the property?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'property_hoa',
    category: 'property',
    skipWhen: (ctx) => ctx.propertyType !== 'rental' && ctx.occupancy !== 'vacant',
    onAnswer: (_ctx, value) => ({ utilities: v(value) }),
  },

  property_hoa: {
    id: 'property_hoa',
    question: 'Is the property in an HOA with color restrictions?',
    subtext: 'HOA approval may be needed for exterior color changes.',
    inputType: 'select',
    options: [
      { label: 'Yes - HOA Restrictions', value: 'yes' },
      { label: 'No HOA', value: 'no' },
    ],
    nextNodeId: 'specialty_check',
    category: 'property',
    skipWhen: (ctx) =>
      ctx.projectType === 'interior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ hoa: v(value) }),
  },
};
