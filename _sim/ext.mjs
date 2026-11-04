import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState(); let doneCtx = null;
const msgs = ["i need the exterior of my house painted","stucco and wood","2500 sq ft","2","yes","yes","yes two","no","no","french pane","about 14","some peeling","a few rotted boards and cracks","different color","91941","this month","a fence, shutters and the overhangs","run it"];
for (const m of msgs) { const r = await handleUserMessage(s, m); s = r.state; console.log('>', m, '\n  ', r.done ? 'DONE' : s.history[s.history.length-1].text.replace(/\n/g,' ').slice(0,200)); if (r.done) { doneCtx = r.done.ctx; break; } }
const c = doneCtx || s.ctx;
console.log('fence',c.fence,'shutters',c.exteriorShutters,"overhangs",c.overhangs);console.log(JSON.stringify({sq:c.squareFeet,stories:c.stories,trim:c.exteriorTrim,door:c.entryDoor,garage:c.garageDoor,gutters:c.gutters,eaves:c.soffitsEaves,win:c.exteriorWindows,cond:c.exteriorCondition,prep:c.prepWork,color:c.exteriorColorChange,ans:c.extAnswered}));
