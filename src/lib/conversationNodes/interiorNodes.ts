import type { ConversationNode } from '../types';

const v = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

export const interiorNodes: Record<string, ConversationNode> = {
  interior_scope: {
    id: 'interior_scope',
    question: 'What is the scope of the interior painting?',
    inputType: 'select',
    options: [
      { label: 'Whole House', value: 'whole_house' },
      { label: 'Specific Rooms', value: 'specific_rooms' },
    ],
    nextNodeId: 'interior_rooms',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorScope: v(value) }),
  },

  interior_rooms: {
    id: 'interior_rooms',
    question: 'Which rooms need painting?',
    subtext: 'Select all that apply.',
    inputType: 'multiselect',
    options: [
      { label: 'Living Room', value: 'living_room' },
      { label: 'Kitchen', value: 'kitchen' },
      { label: 'Master Bedroom', value: 'master_bedroom' },
      { label: 'Bedroom 2', value: 'bedroom_2' },
      { label: 'Bedroom 3', value: 'bedroom_3' },
      { label: 'Bedroom 4', value: 'bedroom_4' },
      { label: 'Master Bathroom', value: 'bathroom_master' },
      { label: 'Bathroom 2', value: 'bathroom_2' },
      { label: 'Bathroom 3', value: 'bathroom_3' },
      { label: 'Dining Room', value: 'dining_room' },
      { label: 'Office / Study', value: 'office' },
      { label: 'Laundry Room', value: 'laundry' },
      { label: 'Hallway', value: 'hallway' },
      { label: 'Entryway / Foyer', value: 'entryway' },
      { label: 'Garage', value: 'garage' },
      { label: 'Bonus Room', value: 'bonus_room' },
    ],
    nextNodeId: 'interior_walls',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.interiorScope === 'whole_house',
    onAnswer: (_ctx, value) => ({
      selectedRooms: Array.isArray(value) ? value : [value],
    }),
  },

  interior_walls: {
    id: 'interior_walls',
    question: 'Will we be painting the walls?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_accent_walls',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorWalls: v(value) }),
  },

  interior_accent_walls: {
    id: 'interior_accent_walls',
    question: 'Will there be any accent walls (different color)?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_ceilings',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorWalls === 'no' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ accentWalls: v(value) }),
  },

  interior_ceilings: {
    id: 'interior_ceilings',
    question: 'Will we be painting the ceilings?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_ceiling_type',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorCeilings: v(value) }),
  },

  interior_ceiling_type: {
    id: 'interior_ceiling_type',
    question: 'What type of ceilings does the property have?',
    inputType: 'select',
    options: [
      { label: 'Flat / Smooth', value: 'flat' },
      { label: 'Popcorn / Textured', value: 'popcorn' },
      { label: 'Vaulted / Cathedral', value: 'vaulted' },
      { label: 'Mixed Types', value: 'mixed' },
    ],
    nextNodeId: 'interior_trim',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.interiorCeilings === 'no',
    onAnswer: (_ctx, value) => ({ ceilingType: v(value) }),
  },

  interior_trim: {
    id: 'interior_trim',
    question: 'Will we be painting the trim and baseboards?',
    inputType: 'select',
    options: [
      { label: 'Yes - Trim & Baseboards', value: 'yes' },
      { label: 'Baseboards Only', value: 'baseboards_only' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_crown_molding',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => {
      const val = v(value);
      return {
        interiorTrim: val === 'yes' || val === 'baseboards_only' ? 'yes' : 'no',
        baseboards: val === 'yes' || val === 'baseboards_only' ? 'yes' : 'no',
      };
    },
  },

  interior_crown_molding: {
    id: 'interior_crown_molding',
    question: 'Is there crown molding to be painted?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_wainscoting',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorTrim === 'no' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ crownMolding: v(value) }),
  },

  interior_wainscoting: {
    id: 'interior_wainscoting',
    question: 'Is there wainscoting or paneling to be painted?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_doors',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ wainscoting: v(value) }),
  },

  interior_doors: {
    id: 'interior_doors',
    question: 'How many interior doors need painting?',
    inputType: 'select',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Just a Few (1-5)', value: 'some' },
      { label: 'All Doors', value: 'all' },
    ],
    nextNodeId: 'interior_door_count',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorDoors: v(value) }),
  },

  interior_door_count: {
    id: 'interior_door_count',
    question: 'Approximately how many doors?',
    inputType: 'number',
    placeholder: '8',
    nextNodeId: 'interior_door_types',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.interiorDoors === 'none',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 100) return 'Please enter a number between 1 and 100';
      return null;
    },
    onAnswer: (_ctx, value) => ({ doorCount: parseInt(v(value), 10) }),
  },

  interior_door_types: {
    id: 'interior_door_types',
    question: 'What types of doors?',
    subtext: 'Select all that apply.',
    inputType: 'multiselect',
    options: [
      { label: 'Standard Doors', value: 'standard' },
      { label: 'French Doors', value: 'french' },
      { label: 'Closet Doors', value: 'closet' },
      { label: 'Pocket Doors', value: 'pocket' },
    ],
    nextNodeId: 'interior_door_frames',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorDoors === 'none' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({
      doorTypes: Array.isArray(value) ? value : [value],
    }),
  },

  interior_door_frames: {
    id: 'interior_door_frames',
    question: 'Should we also paint the door frames/casings?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_windows',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.interiorDoors === 'none',
    onAnswer: (_ctx, value) => ({ doorFrames: v(value) }),
  },

  interior_windows: {
    id: 'interior_windows',
    question: 'Do any interior window frames/sills need painting?',
    inputType: 'select',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Some', value: 'some' },
      { label: 'All Windows', value: 'all' },
    ],
    nextNodeId: 'interior_window_count',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorWindows: v(value) }),
  },

  interior_window_count: {
    id: 'interior_window_count',
    question: 'Approximately how many windows?',
    inputType: 'number',
    placeholder: '10',
    nextNodeId: 'interior_window_types',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.interiorWindows === 'none',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 200) return 'Please enter a number between 1 and 200';
      return null;
    },
    onAnswer: (_ctx, value) => ({ windowCount: parseInt(v(value), 10) }),
  },

  interior_window_types: {
    id: 'interior_window_types',
    question: 'What types of windows?',
    subtext: 'Select all that apply.',
    inputType: 'multiselect',
    options: [
      { label: 'Standard / Single Pane', value: 'single' },
      { label: 'Double-Hung', value: 'double_hung' },
      { label: 'French Pane / Mullion', value: 'french_pane' },
      { label: 'Bay Window', value: 'bay' },
    ],
    nextNodeId: 'interior_cabinets',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorWindows === 'none' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({
      windowTypes: Array.isArray(value) ? value : [value],
    }),
  },

  interior_cabinets: {
    id: 'interior_cabinets',
    question: 'Are there any cabinets to be painted?',
    inputType: 'select',
    options: [
      { label: 'No Cabinets', value: 'none' },
      { label: 'Yes', value: 'yes' },
    ],
    nextNodeId: 'interior_cabinet_locations',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ cabinets: v(value) }),
  },

  interior_cabinet_locations: {
    id: 'interior_cabinet_locations',
    question: 'Which cabinets need painting?',
    subtext: 'Select all that apply.',
    inputType: 'multiselect',
    options: [
      { label: 'Kitchen Cabinets', value: 'kitchen' },
      { label: 'Bathroom Cabinets', value: 'bathroom' },
      { label: 'Laundry Cabinets', value: 'laundry' },
    ],
    nextNodeId: 'interior_closets',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.cabinets === 'none',
    onAnswer: (_ctx, value) => ({
      cabinetLocations: Array.isArray(value) ? value : [value],
    }),
  },

  interior_closets: {
    id: 'interior_closets',
    question: 'Do any closet interiors need painting?',
    inputType: 'select',
    options: [
      { label: 'No Closets', value: 'none' },
      { label: 'Standard Closets', value: 'standard' },
      { label: 'Walk-in Closets', value: 'walkin' },
      { label: 'Both Types', value: 'both' },
    ],
    nextNodeId: 'interior_closet_count',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ closets: v(value) }),
  },

  interior_closet_count: {
    id: 'interior_closet_count',
    question: 'How many closets?',
    inputType: 'number',
    placeholder: '3',
    nextNodeId: 'interior_stairways',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.closets === 'none' ||
      ctx.responseStyle === 'terse',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 30) return 'Please enter a number between 1 and 30';
      return null;
    },
    onAnswer: (_ctx, value) => ({ closetCount: parseInt(v(value), 10) }),
  },

  interior_stairways: {
    id: 'interior_stairways',
    question: 'Are there any stairways to be painted?',
    inputType: 'select',
    options: [
      { label: 'No Stairways', value: 'none' },
      { label: 'Yes', value: 'yes' },
    ],
    nextNodeId: 'interior_stairway_count',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ stairways: v(value) }),
  },

  interior_stairway_count: {
    id: 'interior_stairway_count',
    question: 'How many stairways?',
    inputType: 'number',
    placeholder: '1',
    nextNodeId: 'interior_stairway_details',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.stairways === 'none',
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 10) return 'Please enter a number between 1 and 10';
      return null;
    },
    onAnswer: (_ctx, value) => ({ stairwayCount: parseInt(v(value), 10) }),
  },

  interior_stairway_details: {
    id: 'interior_stairway_details',
    question: 'What parts of the stairway need painting?',
    inputType: 'select',
    options: [
      { label: 'Stairway Walls Only', value: 'walls_only' },
      { label: 'Walls & Railings', value: 'walls_and_railings' },
      { label: 'Everything (Walls, Railings, Spindles, Treads)', value: 'full' },
    ],
    nextNodeId: 'interior_shutters',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.stairways === 'none',
    onAnswer: (_ctx, value) => ({ stairwayDetails: v(value) }),
  },

  interior_shutters: {
    id: 'interior_shutters',
    question: 'Are there interior shutters or plantation blinds to paint?',
    inputType: 'select',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    nextNodeId: 'interior_color_change',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ interiorShutters: v(value) }),
  },

  interior_color_change: {
    id: 'interior_color_change',
    question: 'How different will the new paint colors be from the current ones?',
    subtext: 'Dramatic changes (e.g., dark to light) require more coats.',
    inputType: 'select',
    options: [
      { label: 'Same or Similar Colors', value: 'same' },
      { label: 'Different Colors', value: 'different' },
      { label: 'Dramatic Change (Dark to Light or Vice Versa)', value: 'dramatic' },
    ],
    nextNodeId: 'exterior_scope',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorColorChange: v(value) }),
  },
};
