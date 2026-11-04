import { makeInitialState, handleUserMessage, buildPriceEditor, baseFromResult } from './out/rules.mjs';
async function run(msgs) { let s = makeInitialState(); let done=null; for (const m of msgs) { const r = await handleUserMessage(s, m); s = r.state; if (r.done) { done=r.done; break; } } return done; }
const done = await run(['4 bedroom house 2400 sq ft interior walls ceilings trim and doors, kitchen cabinets too, zip 80202, same color, I own it and live here, ASAP, occupied','run it','run it','run it','run it','run it','run it','run it','run it']);
if (!done) { console.log('no result'); process.exit(); }
const base = baseFromResult(done);
const v0 = buildPriceEditor(base, [], []);
console.log('original', v0.current.estimate.total, 'vol', v0.current.estimate.volumeEfficiency);
console.log('rows', v0.rows.map(r=>`${r.key}:${r.amount} (${r.change})`).join(' | '));
console.log('rooms', v0.rooms.map(r=>`${r.label}(${r.change})`).join(' | '));
const k = v0.rooms.find(r=>/Bedroom/.test(r.label)); 
const v1 = buildPriceEditor(base, [k.key], []);
console.log('minus', k.label, '->', v1.current.estimate.total, 'change', v1.current.estimate.total - v0.current.estimate.total);
const v2 = buildPriceEditor(base, [k.key], ['cabinets:kitchen']);
console.log('also minus kitchen cabinets ->', v2.current.estimate.total);
const v3 = buildPriceEditor(base, [], ['ceilings','trim','doors']);
console.log('walls only via edits ->', v3.current.estimate.total, v3.current.estimate.lineItems.map(l=>l.description.slice(0,30)+':'+Math.round(l.amount)).join(' | '));
const v4 = buildPriceEditor(base, [], ['walls','ceilings','doors']);
console.log('trim only via edits ->', v4.current.estimate.total, v4.current.estimate.lineItems.map(l=>l.description.slice(0,30)+':'+Math.round(l.amount)).join(' | '));
