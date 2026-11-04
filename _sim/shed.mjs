import { makeInitialState, handleUserMessage } from './out/rules.mjs';
async function run(title, msgs) {
  console.log('---', title);
  let s = makeInitialState();
  for (const m of msgs) { const r = await handleUserMessage(s, m); s = r.state; console.log('>', m, '\n  ', r.done ? 'DONE ' + r.done.estimate.total : s.history[s.history.length-1].text.replace(/\n/g,' ').slice(0,170)); if (r.done) break; }
}
await run("shed", ["ok now i need the exterior of my shed painted","wood","10x12","91941","this month","run it"]);
await run('fence', ["i need my backyard fence painted, about 120 feet","91941","next week","run it"]);
await run('whole house exterior (should still ask ownership)', ["i need the exterior of my house painted","stucco","2000 sq ft","2"]);
await run('interior (should ask ownership)', ["my master bedroom, about 14x16","walls only"]);
