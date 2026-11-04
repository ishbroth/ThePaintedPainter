import { makeInitialState, handleUserMessage, buildPriceEditor, baseFromResult } from './out/rules.mjs';
let s = makeInitialState(); let done = null;
for (const m of ['3 bedroom rental house 1200 sq ft inside and out, 31406','walls only for inside','aluminum siding','2','renting it out to tenants','walls same color','next few months, occupied','run it','run it','run it']) { const r = await handleUserMessage(s, m); s = r.state; if (r.done) { done = r.done; break; } }
console.log('lines', done.estimate.lineItems.map(l=>`${l.key||'-'}:${l.description}:${Math.round(l.amount)}`).join(' | '));
const base = baseFromResult(done);
const v0 = buildPriceEditor(base, [], []);
console.log('total', v0.current.estimate.total);
for (const r of v0.rows) console.log(' row', r.key, r.amount, 'change', r.change, 'also:', r.alsoAffects.join(', '), 'fields:', r.fields.map(f=>f.field).join(','));
const v1 = buildPriceEditor(base, [], ['ext_body']);
console.log('remove ext_body ->', v1.current.estimate.total, v1.current.estimate.lineItems.map(l=>l.description).join(' | '));
const v2 = buildPriceEditor(base, [], [], { sidingType: 'wood', stories: 1 });
console.log('wood 1-story ->', v2.current.estimate.total);
