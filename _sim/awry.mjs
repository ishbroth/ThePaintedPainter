import { makeInitialState, handleUserMessage } from './out/rules.mjs';
const msgs = ["i dont need anything painted","i need nothing","ok fine","its a rental but it doesn't exist","i just said it was a rental but it doesn't really exist","11111","right now bitch","neither","it doesnt even exist","stop asking","bitch i said it doesnt exist","your mom will be there","just your mom and a mattress","furnished, occupied","i said right NOW bitch cause your moms there","run it","run it","run it"];
let s = makeInitialState(); let n = 0;
for (const m of msgs) { const r = await handleUserMessage(s, m); s = r.state; n++; if (r.done) { console.log('PRICED at message', n, r.done.estimate.total); break; } if (s.history.length === 1 && n > 1) { console.log('RESTARTED after message', n, '->', s.history[0].text); break; } }
// a normal conversation must still price
let t = makeInitialState();
for (const m of ["my master bedroom","500 sq ft","walls and ceiling","ready to go","i own it","same color","90210","asap, occupied","run it"]) { const r = await handleUserMessage(t, m); t = r.state; if (r.done) { console.log('normal convo priced', r.done.estimate.total); break; } }
