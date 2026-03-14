import type { ConversationNode } from '../types';

const v = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

export const contactNodes: Record<string, ConversationNode> = {
  contact_name: {
    id: 'contact_name',
    question: "Almost done! What's your name?",
    inputType: 'text',
    placeholder: 'Your full name',
    nextNodeId: 'contact_phone',
    category: 'contact',
    validate: (value) => {
      const val = v(value).trim();
      if (val.length < 2) return 'Please enter your name';
      return null;
    },
    onAnswer: (_ctx, value) => ({ contactName: v(value).trim() }),
  },

  contact_phone: {
    id: 'contact_phone',
    question: 'What is the best phone number to reach you?',
    inputType: 'tel',
    placeholder: '(619) 555-1234',
    nextNodeId: 'contact_email',
    category: 'contact',
    validate: (value) => {
      const val = v(value).replace(/\D/g, '');
      if (val.length < 10) return 'Please enter a valid phone number';
      return null;
    },
    onAnswer: (_ctx, value) => ({ contactPhone: v(value).trim() }),
  },

  contact_email: {
    id: 'contact_email',
    question: "What's your email address?",
    subtext: "We'll send your estimate details here.",
    inputType: 'email',
    placeholder: 'your@email.com',
    nextNodeId: 'contact_notes',
    category: 'contact',
    validate: (value) => {
      const val = v(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email address';
      return null;
    },
    onAnswer: (_ctx, value) => ({ contactEmail: v(value).trim() }),
  },

  contact_notes: {
    id: 'contact_notes',
    question: 'Any additional details or special requests?',
    subtext: 'Optional - anything else we should know about your project.',
    inputType: 'text',
    placeholder: 'e.g., "Need paint color consultation" or "Budget is flexible"',
    nextNodeId: 'result',
    category: 'contact',
    skipWhen: (ctx) => ctx.responseStyle === 'terse',
    onAnswer: (_ctx, value) => ({ contactNotes: v(value).trim() }),
  },

  result: {
    id: 'result',
    question: '',
    inputType: 'select',
    options: [],
    nextNodeId: null,
    category: 'contact',
  },
};
