import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState();
for (const m of process.argv.slice(2)) { s = (await handleUserMessage(s, m)).state; const c = s.ctx; console.log('>', m.slice(0,70), '\n  ', JSON.stringify({walls:c.interiorWalls, ceil:c.interiorCeilings, trim:c.interiorTrim, doors:c.interiorDoors, accent:c.accentWalls, ac:c.accentWallCount, cc:c.interiorColorChange, scope:c.colorChangeScope, colors:c.colorCount, rooms:c.selectedRooms, is:c.interiorScope, sq:c.squareFeet, sa:c.surfacesAddressed})); }
