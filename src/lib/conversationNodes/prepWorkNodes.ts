import type { ConversationNode } from '../types';

const v = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

export const prepWorkNodes: Record<string, ConversationNode> = {
  prep_overview: {
    id: 'prep_overview',
    question: 'Does the project need any of the following prep work?',
    subtext: 'Select all that apply, or skip if none.',
    inputType: 'multiselect',
    options: [
      { label: 'Caulking', value: 'caulking' },
      { label: 'Painting Over Stain', value: 'stain_cover' },
      { label: 'Drywall Repair', value: 'drywall_repair' },
      { label: 'Wood Rot Repair', value: 'wood_rot' },
      { label: 'Wallpaper Removal', value: 'wallpaper_removal' },
      { label: 'Popcorn Ceiling Removal', value: 'popcorn_removal' },
      { label: 'Power Washing', value: 'power_washing' },
      { label: 'Lead Paint Testing', value: 'lead_test' },
      { label: 'None / Skip', value: 'none' },
    ],
    nextNodeId: 'prep_caulking',
    category: 'prep',
    onAnswer: (_ctx, value) => {
      const selected = Array.isArray(value) ? value : [value];
      if (selected.includes('none')) return { prepWork: [] };
      return { prepWork: selected };
    },
  },

  prep_caulking: {
    id: 'prep_caulking',
    question: 'How extensive is the caulking work?',
    inputType: 'select',
    options: [
      { label: 'Minor - A few spots', value: 'minor' },
      { label: 'Moderate - Multiple areas', value: 'moderate' },
      { label: 'Extensive - Most windows/trim', value: 'extensive' },
    ],
    nextNodeId: 'prep_drywall',
    category: 'prep',
    skipWhen: (ctx) => !ctx.prepWork.includes('caulking'),
    onAnswer: (_ctx, value) => ({ caulkingExtent: v(value) }),
  },

  prep_drywall: {
    id: 'prep_drywall',
    question: 'How much drywall repair is needed?',
    inputType: 'select',
    options: [
      { label: 'Minor - Small holes/nail pops', value: 'minor' },
      { label: 'Moderate - Several patches', value: 'moderate' },
      { label: 'Major - Large areas of damage', value: 'major' },
    ],
    nextNodeId: 'prep_wood_rot',
    category: 'prep',
    skipWhen: (ctx) => !ctx.prepWork.includes('drywall_repair'),
    onAnswer: (ctx, value) => {
      const val = v(value);
      const updates: Partial<typeof ctx> = { drywallRepairExtent: val };
      if (val === 'major') {
        updates.specialtyReferrals = [
          ...ctx.specialtyReferrals,
          {
            type: 'major_carpentry',
            reason: 'Major drywall repair may require a dedicated drywall contractor.',
            severity: 'info',
          },
        ];
      }
      return updates;
    },
  },

  prep_wood_rot: {
    id: 'prep_wood_rot',
    question: 'How much wood rot repair is needed?',
    inputType: 'select',
    options: [
      { label: 'Minor - Small spots', value: 'minor' },
      { label: 'Moderate - Several areas', value: 'moderate' },
      { label: 'Major - Structural concerns', value: 'major' },
    ],
    nextNodeId: 'prep_wallpaper_rooms',
    category: 'prep',
    skipWhen: (ctx) => !ctx.prepWork.includes('wood_rot'),
    onAnswer: (ctx, value) => {
      const val = v(value);
      const updates: Partial<typeof ctx> = { woodRotExtent: val };
      if (val === 'major') {
        updates.specialtyReferrals = [
          ...ctx.specialtyReferrals,
          {
            type: 'major_carpentry',
            reason: 'Major wood rot may require a carpentry specialist before painting.',
            severity: 'warning',
          },
        ];
      }
      return updates;
    },
  },

  prep_wallpaper_rooms: {
    id: 'prep_wallpaper_rooms',
    question: 'How many rooms have wallpaper to remove?',
    inputType: 'number',
    placeholder: '2',
    nextNodeId: 'prep_popcorn_rooms',
    category: 'prep',
    skipWhen: (ctx) => !ctx.prepWork.includes('wallpaper_removal'),
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 30) return 'Please enter a number between 1 and 30';
      return null;
    },
    onAnswer: (_ctx, value) => ({ wallpaperRooms: parseInt(v(value), 10) }),
  },

  prep_popcorn_rooms: {
    id: 'prep_popcorn_rooms',
    question: 'How many rooms have popcorn ceiling to remove?',
    inputType: 'number',
    placeholder: '3',
    nextNodeId: 'property_sqft',
    category: 'prep',
    skipWhen: (ctx) => !ctx.prepWork.includes('popcorn_removal'),
    validate: (value) => {
      const n = parseInt(v(value), 10);
      if (isNaN(n) || n < 1 || n > 30) return 'Please enter a number between 1 and 30';
      return null;
    },
    onAnswer: (_ctx, value) => ({ popcornCeilingRooms: parseInt(v(value), 10) }),
  },
};
