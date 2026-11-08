import { registerPlugin } from '@capacitor/core';

// iOS only — there is no Android or web implementation, so a call on either platform rejects with Capacitor's own
// "not implemented" error, which callers already treat the same as "not available here".
export const LocalSpeech = registerPlugin('LocalSpeech');
