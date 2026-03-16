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
    nextNodeId: 'interior_wall_texture',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior',
    onAnswer: (_ctx, value) => ({ interiorWalls: v(value) }),
  },

  // Smart follow-up: wall texture affects paint consumption and labor
  interior_wall_texture: {
    id: 'interior_wall_texture',
    question: 'What is the wall texture?',
    subtext: 'Textured surfaces use more paint and take longer to coat evenly.',
    inputType: 'select',
    options: [
      { label: 'Smooth / Flat', value: 'smooth' },
      { label: 'Light Texture (orange peel, eggshell)', value: 'textured' },
      { label: 'Heavy Texture (knockdown, skip trowel, Santa Fe)', value: 'heavy_texture' },
    ],
    nextNodeId: 'interior_accent_walls',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorWalls === 'no' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ wallTexture: v(value) }),
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
    nextNodeId: 'interior_trim_condition',
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

  // Smart follow-up: trim condition drives caulking/nail hole/sanding prep costs
  interior_trim_condition: {
    id: 'interior_trim_condition',
    question: 'What is the condition of the trim?',
    subtext: 'New trim needs caulking and nail holes filled before painting. Existing trim may need sanding or deglossing.',
    inputType: 'select',
    options: [
      { label: 'New / Unfinished (needs caulk, fill, prime)', value: 'new' },
      { label: 'Existing - Good Condition (light scuff sand)', value: 'existing_good' },
      { label: 'Existing - Fair/Rough (needs sanding, possible repairs)', value: 'existing_fair' },
      { label: 'Mix of New and Existing', value: 'mixed' },
    ],
    nextNodeId: 'interior_crown_molding',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorTrim === 'no' ||
      ctx.projectCondition === 'new_construction', // Auto-infer new trim
    onAnswer: (_ctx, value) => ({ trimCondition: v(value) }),
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
    nextNodeId: 'interior_door_material',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorDoors === 'none' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({
      doorTypes: Array.isArray(value) ? value : [value],
    }),
  },

  // Smart follow-up: door material affects prep and application
  interior_door_material: {
    id: 'interior_door_material',
    question: 'What material are the doors?',
    subtext: 'Metal and fiberglass doors prep differently than wood.',
    inputType: 'select',
    options: [
      { label: 'Wood (solid or hollow-core)', value: 'wood' },
      { label: 'Metal / Steel', value: 'metal' },
      { label: 'Fiberglass', value: 'fiberglass' },
      { label: 'Mix of Materials', value: 'mixed' },
    ],
    nextNodeId: 'interior_door_frames',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.interiorDoors === 'none' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ doorMaterial: v(value) }),
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
    nextNodeId: 'interior_cabinet_scope',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.cabinets === 'none',
    onAnswer: (_ctx, value) => ({
      cabinetLocations: Array.isArray(value) ? value : [value],
    }),
  },

  // Smart follow-up: cabinet painting scope
  interior_cabinet_scope: {
    id: 'interior_cabinet_scope',
    question: 'How much of the cabinets need painting?',
    subtext: 'Painting inside cabinets adds significant time — typically 40-60% more than fronts only.',
    inputType: 'select',
    options: [
      { label: 'Fronts & Visible Frame Only (standard)', value: 'fronts_only' },
      { label: 'Inside of Cabinets Too (full)', value: 'inside_too' },
    ],
    nextNodeId: 'interior_closets',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.cabinets === 'none',
    onAnswer: (_ctx, value) => ({ cabinetScope: v(value) }),
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
    nextNodeId: 'interior_closet_shelving',
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

  // Smart follow-up: closet shelving affects masking and painting scope
  interior_closet_shelving: {
    id: 'interior_closet_shelving',
    question: 'Do the closets have built-in shelving that needs painting?',
    subtext: 'Wire shelving just needs masking. Built-in wood shelving adds painting scope.',
    inputType: 'select',
    options: [
      { label: 'No Shelving / Wire Only', value: 'none' },
      { label: 'Basic Shelving (1-2 shelves)', value: 'wire' },
      { label: 'Built-in Wood Shelving', value: 'built_in' },
      { label: 'Extensive Custom Closet System', value: 'extensive' },
    ],
    nextNodeId: 'interior_stairways',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.closets === 'none',
    onAnswer: (_ctx, value) => ({ closetShelving: v(value) }),
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
      { label: 'Walls & Railings/Banisters', value: 'walls_and_railings' },
      { label: 'Everything (Walls, Railings, Spindles, Risers)', value: 'full' },
    ],
    nextNodeId: 'interior_railing_material',
    category: 'interior',
    skipWhen: (ctx) => ctx.projectType === 'exterior' || ctx.stairways === 'none',
    onAnswer: (_ctx, value) => ({ stairwayDetails: v(value) }),
  },

  // Smart follow-up: railing material matters for prep and pricing
  interior_railing_material: {
    id: 'interior_railing_material',
    question: 'What material are the stair railings/banisters?',
    subtext: 'Wood and metal prep very differently. Wrought iron detailing is labor-intensive.',
    inputType: 'select',
    options: [
      { label: 'Wood', value: 'wood' },
      { label: 'Metal / Wrought Iron', value: 'wrought_iron' },
      { label: 'Metal (simple/modern)', value: 'metal' },
    ],
    nextNodeId: 'interior_specialty',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.stairways === 'none' ||
      ctx.stairwayDetails === 'walls_only', // Only ask if painting railings
    onAnswer: (_ctx, value) => ({ interiorRailingMaterial: v(value) }),
  },

  // ===== Specialty Services =====

  interior_specialty: {
    id: 'interior_specialty',
    question: 'Does this project include any specialty painting?',
    subtext: 'Select all that apply, or skip if none.',
    inputType: 'multiselect',
    options: [
      { label: 'Fireplace / Mantel', value: 'fireplace' },
      { label: 'Exposed Beams', value: 'beams' },
      { label: 'Built-in Shelving / Bookcases', value: 'built_ins' },
      { label: 'Epoxy Garage Floor', value: 'epoxy' },
      { label: 'Furniture Painting', value: 'furniture' },
      { label: 'Brick or Stone (interior)', value: 'brick' },
      { label: 'None / Skip', value: 'none' },
    ],
    nextNodeId: 'interior_fireplace_type',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => {
      const selected = Array.isArray(value) ? value : [value];
      if (selected.includes('none')) return { specialtyServices: [] };
      return { specialtyServices: selected };
    },
  },

  interior_fireplace_type: {
    id: 'interior_fireplace_type',
    question: 'What type of fireplace work?',
    inputType: 'select',
    options: [
      { label: 'Paint Brick Surround', value: 'brick_paint' },
      { label: 'Whitewash / Limewash Brick', value: 'brick_whitewash' },
      { label: 'Paint Stone Surround', value: 'stone' },
      { label: 'Mantel Only', value: 'mantel_only' },
      { label: 'Full Fireplace (surround + mantel + hearth)', value: 'full' },
    ],
    nextNodeId: 'interior_beam_length',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('fireplace'),
    onAnswer: (_ctx, value) => ({ fireplaceType: v(value) }),
  },

  interior_beam_length: {
    id: 'interior_beam_length',
    question: 'Approximately how many total linear feet of exposed beams?',
    subtext: 'Estimate total length of all beams combined.',
    inputType: 'number',
    placeholder: '40',
    nextNodeId: 'interior_beam_location',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('beams'),
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 500) return 'Please enter a number between 1 and 500';
      return null;
    },
    onAnswer: (_ctx, value) => ({ beamLinearFeet: parseInt(v(value), 10) }),
  },

  interior_beam_location: {
    id: 'interior_beam_location',
    question: 'Where are the exposed beams?',
    inputType: 'select',
    options: [
      { label: 'Standard Height (accessible)', value: 'standard' },
      { label: 'Vaulted / High Ceiling (needs scaffolding)', value: 'vaulted' },
    ],
    nextNodeId: 'interior_builtin_count',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('beams'),
    onAnswer: (_ctx, value) => ({ beamLocation: v(value) }),
  },

  interior_builtin_count: {
    id: 'interior_builtin_count',
    question: 'How many built-in units need painting?',
    subtext: 'Bookcases, shelving, entertainment centers, etc.',
    inputType: 'number',
    placeholder: '2',
    nextNodeId: 'interior_epoxy_type',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('built_ins'),
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 20) return 'Please enter a number between 1 and 20';
      return null;
    },
    onAnswer: (_ctx, value) => ({ builtInCount: parseInt(v(value), 10) }),
  },

  interior_epoxy_type: {
    id: 'interior_epoxy_type',
    question: 'What type of epoxy floor coating?',
    inputType: 'select',
    options: [
      { label: 'Basic Solid Color', value: 'basic' },
      { label: 'Full System (flake + clear topcoat)', value: 'full_system' },
    ],
    nextNodeId: 'interior_furniture',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('epoxy'),
    onAnswer: (ctx, value) => ({
      epoxyType: v(value),
      epoxyGarageSqft: Math.round((ctx.squareFeet || 1500) * 0.15),
    }),
  },

  interior_furniture: {
    id: 'interior_furniture',
    question: 'What furniture pieces need painting?',
    subtext: 'Select all that apply.',
    inputType: 'multiselect',
    options: [
      { label: 'Dresser', value: 'dresser' },
      { label: 'Dining Table', value: 'table_dining' },
      { label: 'End/Side Table', value: 'table_end' },
      { label: 'Chairs', value: 'chair' },
      { label: 'Bookcase', value: 'bookcase' },
      { label: 'Desk', value: 'desk' },
      { label: 'Nightstand', value: 'nightstand' },
      { label: 'Cabinet/Hutch', value: 'cabinet' },
    ],
    nextNodeId: 'interior_brick_treatment',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('furniture'),
    onAnswer: (_ctx, value) => ({
      furnitureItems: Array.isArray(value) ? value : [value],
    }),
  },

  interior_brick_treatment: {
    id: 'interior_brick_treatment',
    question: 'How should the brick/stone be treated?',
    inputType: 'select',
    options: [
      { label: 'Paint (solid color)', value: 'paint' },
      { label: 'Whitewash / German Smear / Limewash', value: 'whitewash' },
    ],
    nextNodeId: 'interior_brick_sqft',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('brick'),
    onAnswer: (_ctx, value) => ({ brickTreatment: v(value) }),
  },

  interior_brick_sqft: {
    id: 'interior_brick_sqft',
    question: 'Approximately how many square feet of brick/stone?',
    subtext: 'A typical accent wall is about 80-120 sqft.',
    inputType: 'number',
    placeholder: '100',
    nextNodeId: 'interior_shutters',
    category: 'interior',
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      !ctx.specialtyServices.includes('brick'),
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 10 || n > 2000) return 'Please enter a number between 10 and 2000';
      return null;
    },
    onAnswer: (_ctx, value) => ({ brickSqft: parseInt(v(value), 10) }),
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
    skipWhen: (ctx) =>
      ctx.projectType === 'exterior' ||
      ctx.projectCondition === 'new_construction',
    onAnswer: (_ctx, value) => ({ interiorColorChange: v(value) }),
  },
};
