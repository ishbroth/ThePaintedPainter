import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState();
for (const m of ['2 bedroom apartment 900 sq ft interior walls ceilings and trim','baseboards and door casings, no built-ins']) { s = (await handleUserMessage(s, m)).state; }
const c = s.ctx; console.log({doorFrames:c.doorFrames, baseboards:c.baseboards, interiorTrim:c.interiorTrim, trimScopeAddressed:c.trimScopeAddressed, fixture:c.fixtureRemoval});
console.log(s.history.at(-1).text.slice(0,120));
