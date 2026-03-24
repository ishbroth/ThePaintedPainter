import type { ConversationNode, EstimatorContext } from '../types';
import { getStateFromZip, isHighCostArea, getStateComplianceNotes, isValidZip } from '../zipCodeData';

export const startNodes: Record<string, ConversationNode> = {
  welcome: {
    id: 'welcome',
    question: 'Welcome to The Painted Painter Estimator',
    subtext: "Answer a few questions and we'll build you a detailed painting estimate. Takes about 3-5 minutes.",
    inputType: 'select',
    options: [{ label: "Let's Get Started", value: 'start' }],
    nextNodeId: 'zip_code',
    category: 'start',
  },

  zip_code: {
    id: 'zip_code',
    question: 'What is the ZIP code for the property?',
    subtext: 'This helps us adjust pricing for your area.',
    inputType: 'zip',
    placeholder: '92101',
    nextNodeId: 'year_built',
    category: 'start',
    validate: (value) => {
      const v = Array.isArray(value) ? value[0] : value;
      if (!isValidZip(v)) return 'Please enter a valid 5-digit ZIP code';
      if (!getStateFromZip(v)) return 'We could not identify a state for that ZIP code';
      return null;
    },
    onAnswer: (_ctx, value) => {
      const zip = Array.isArray(value) ? value[0] : value;
      const state = getStateFromZip(zip);
      return {
        zipCode: zip,
        state,
        isHighCostArea: isHighCostArea(zip),
        stateComplianceNotes: getStateComplianceNotes(state),
      };
    },
  },

  year_built: {
    id: 'year_built',
    question: 'What year was the property built?',
    subtext: 'Helps us identify potential lead paint or special prep needs.',
    inputType: 'number',
    placeholder: '1985',
    nextNodeId: 'property_type',
    category: 'start',
    validate: (value) => {
      const v = Array.isArray(value) ? value[0] : value;
      const year = parseInt(v, 10);
      if (isNaN(year) || year < 1800 || year > new Date().getFullYear()) {
        return 'Please enter a valid year (1800-present)';
      }
      return null;
    },
    onAnswer: (ctx, value) => {
      const year = parseInt(Array.isArray(value) ? value[0] : value, 10);
      const updates: Partial<EstimatorContext> = { yearBuilt: year };
      if (year < 1978) {
        updates.specialtyReferrals = [
          ...ctx.specialtyReferrals,
          {
            type: 'lead_paint',
            reason: `Home built in ${year} (pre-1978) may contain lead paint. EPA RRP certified contractor required.`,
            severity: 'warning',
          },
        ];
      }
      return updates;
    },
  },

  property_type: {
    id: 'property_type',
    question: 'What type of property is this?',
    inputType: 'select',
    options: [
      { label: 'Single Family Home', value: 'residential' },
      { label: 'Condo / Townhouse', value: 'condo' },
      { label: 'Multi-Unit / Apartment', value: 'multi_unit' },
      { label: 'Commercial', value: 'commercial' },
      { label: 'Rental Property', value: 'rental' },
    ],
    nextNodeId: 'project_type',
    category: 'start',
    onAnswer: (_ctx, value) => ({
      propertyType: Array.isArray(value) ? value[0] : value,
    }),
  },

  project_type: {
    id: 'project_type',
    question: 'What type of painting project is this?',
    inputType: 'select',
    options: [
      { label: 'Interior Only', value: 'interior' },
      { label: 'Exterior Only', value: 'exterior' },
      { label: 'Both Interior & Exterior', value: 'both' },
    ],
    nextNodeId: 'project_condition',
    category: 'start',
    onAnswer: (_ctx, value) => ({
      projectType: Array.isArray(value) ? value[0] : value,
    }),
  },

  project_condition: {
    id: 'project_condition',
    question: 'What best describes this project?',
    subtext: 'This helps us estimate prep work and materials.',
    inputType: 'select',
    options: [
      { label: 'Repaint — previously painted surfaces', value: 'repaint' },
      { label: 'New Construction — fresh drywall/surfaces', value: 'new_construction' },
      { label: 'Renovation — mix of old and new surfaces', value: 'renovation' },
    ],
    nextNodeId: 'stained_wood',
    category: 'start',
    onAnswer: (_ctx, value) => ({
      projectCondition: Array.isArray(value) ? value[0] : value,
    }),
  },

  stained_wood: {
    id: 'stained_wood',
    question: 'Are there currently stained wood surfaces (trim, doors, cabinets) that need to be painted over?',
    subtext: 'Stained wood requires extra prep (deglossing & priming) before painting.',
    inputType: 'select',
    options: [
      { label: 'Yes — stained wood to paint over', value: 'yes' },
      { label: 'No — all surfaces are already painted or new', value: 'no' },
    ],
    nextNodeId: 'bedroom_count',
    category: 'start',
    skipWhen: (ctx) => ctx.projectCondition === 'new_construction',
    onAnswer: (_ctx, value) => ({
      hasStainedWood: Array.isArray(value) ? value[0] : value,
    }),
  },

  bedroom_count: {
    id: 'bedroom_count',
    question: 'How many bedrooms does the property have?',
    subtext: 'Helps us estimate room count and layout.',
    inputType: 'select',
    options: [
      { label: '1 Bedroom', value: '1' },
      { label: '2 Bedrooms', value: '2' },
      { label: '3 Bedrooms', value: '3' },
      { label: '4 Bedrooms', value: '4' },
      { label: '5+ Bedrooms', value: '5' },
    ],
    nextNodeId: 'interior_scope',
    category: 'start',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({
      bedroomCount: parseInt(Array.isArray(value) ? value[0] : value, 10),
    }),
  },
};
