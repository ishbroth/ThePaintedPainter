import { makeInitialState, handleUserMessage } from './out/rules.mjs';
async function run(msgs) {
  let s = makeInitialState();
  for (const m of msgs) { const r = await handleUserMessage(s, m); s = r.state; console.log('>', m, '\n  ', r.done ? 'DONE' : s.history[s.history.length-1].text.slice(0,170)); if (r.done) break; }
  console.log('  surfaces:', ['interiorWalls','interiorCeilings','interiorTrim','interiorDoors'].map(k=>k+'='+s.ctx[k]).join(' '), 'excluded', JSON.stringify(s.ctx.excludedSurfaces));
}
console.log('--- walls, yes, no, yes');
await run(["my master bedroom, about 14x16","just the walls","yes","no","sure"]);
console.log('--- explicit no ceilings');
await run(["my master bedroom, about 14x16","walls and trim, no ceilings"]);
console.log('--- yes with extra');
await run(["my master bedroom, about 14x16","just walls","yes and the baseboards too"]);
