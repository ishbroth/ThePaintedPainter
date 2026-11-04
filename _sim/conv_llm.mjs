import { makeInitialState, handleUserMessage } from './out/llm.mjs';
let s = makeInitialState();
for (const m of process.argv.slice(2)) { const r = await handleUserMessage(s, m); s = r.state; console.log('U:', m); console.log('B:', s.history.at(-1).text.slice(0, 600), '\n   <'+s.lastBotTopic?.id+'>\n'); if (r.done) { console.log('DONE', r.done.estimate.total, r.done.estimate.lineItems.map(l=>l.description+':'+Math.round(l.amount)).join(' | ')); break; } }
