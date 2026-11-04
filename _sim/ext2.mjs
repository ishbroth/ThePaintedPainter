import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState();
for (const m of ["i need the exterior of my house painted","stucco","2500 sq ft","2","yes","no","no","no","vinyl","some peeling","no repairs","same color","91941","this month","run it","run it"]) { const r = await handleUserMessage(s, m); s = r.state; if (r.done) { console.log('total', r.done.estimate.total); for (const l of r.done.estimate.lineItems) console.log(' -', l.description, Math.round(l.amount), l.key||''); break; } }
