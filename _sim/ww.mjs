import { makeWorkWithAgainState, handleUserMessage } from './out/rules.mjs';
let s = makeWorkWithAgainState({ id: 'abc', companyName: 'Sunrise Painting Company', zip: '92109' });
console.log('B:', s.history[0].text);
for (const m of ['3 bedroom house inside 1500 sq ft, walls only', 'i own it', 'same color', 'asap, occupied', 'run it']) { const r = await handleUserMessage(s, m); s = r.state; console.log('U:', m, '\nB:', s.history.at(-1).text.slice(0,140), '<'+s.lastBotTopic?.id+'>'); if (r.done) { console.log('DONE', r.done.estimate.total, 'zip', r.done.ctx.zipCode, 'pref', r.done.ctx.preferredPainterName); break; } }
