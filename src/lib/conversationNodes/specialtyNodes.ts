import type { ConversationNode } from '../types';

export const specialtyNodes: Record<string, ConversationNode> = {
  specialty_check: {
    id: 'specialty_check',
    question: '',
    inputType: 'select',
    options: [],
    nextNodeId: 'contact_name',
    category: 'specialty',
    // This is a virtual node - the conversation engine checks for referrals
    // and either shows the specialty_warning node or skips to contact
    skipWhen: (ctx) => ctx.specialtyReferrals.length === 0,
  },

  specialty_warning: {
    id: 'specialty_warning',
    question: 'Important: Specialty Work Detected',
    subtext: 'Based on your answers, this project may require specialist contractors. We can coordinate referrals.',
    inputType: 'select',
    options: [
      { label: 'Understood, Continue', value: 'continue' },
    ],
    nextNodeId: 'contact_name',
    category: 'specialty',
    skipWhen: (ctx) => ctx.specialtyReferrals.length === 0,
  },
};
