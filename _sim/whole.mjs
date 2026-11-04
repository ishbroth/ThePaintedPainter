import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState();
for (const m of ["i have a one bedroom apartment","900 sq ft","the whole room","same color","91941","couple weeks, vacant"]) { const r = await handleUserMessage(s, m); s = r.state; console.log('>', m, '\n  ', r.done ? 'DONE' : s.history[s.history.length-1].text.slice(0,200)); if (r.done) break; }
