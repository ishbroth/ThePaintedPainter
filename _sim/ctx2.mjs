import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState();
for (const m of ['crown molding and baseboard painting','whole house, trim only','baseboards and crown','good, minor nail holes','i own it','different, light','33139']) { s = (await handleUserMessage(s, m)).state; console.log('>', m, '| topic now:', s.lastBotTopic?.id, '| cc=', JSON.stringify(s.ctx.interiorColorChange), 'walls', s.ctx.interiorWalls); }
