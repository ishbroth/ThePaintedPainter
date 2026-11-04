import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState(); let n=0;
for (const m of ["one french pane window needs repainting","92109","looks fine","i own it","same color","asap, occupied","run it","run it"]) { n++; const r = await handleUserMessage(s, m); s = r.state; console.log(n, r.done ? 'DONE '+r.done.estimate.total : 'bot: '+s.history[s.history.length-1].text.slice(0,90)); if (r.done) break; }
