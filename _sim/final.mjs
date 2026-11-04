import { makeInitialState, handleUserMessage } from './out/rules.mjs';
const pre = ['3 bedroom house inside 1500 sq ft, walls ceilings trim doors','i own it','good shape','same color','90210','asap, occupied'];
async function toWrap() { let s = makeInitialState(); for (const m of pre) { s = (await handleUserMessage(s, m)).state; } return s; }
const base = await toWrap(); console.log('wrapup asked:', base.wrapupAsked, '| last bot:', base.history.at(-1).text.slice(0, 70));
for (const reply of ['run it','price it','ready','ready to go','yes','go ahead','looks good','nope','no that is all','done','high ceilings','high ceilings in the living room','my ceilings are 12 feet','vaulted living room, run it','how much?']) {
  const r = await handleUserMessage(await toWrap(), reply);
  console.log(reply.padEnd(30), r.done ? '$'+r.done.estimate.total+' (ceilingHeight '+r.done.ctx.ceilingHeight+')' : 'NOT PRICED -> ' + r.state.history.at(-1).text.slice(0, 80));
}
for (const reply of ['run it','high ceilings in the living room']) { const r = await handleUserMessage(await toWrap(), reply); console.log(reply, r.done.ctx.tallCeilingShare, r.done.ctx.interiorScope, r.done.estimate.lineItems.map(l=>l.description.slice(0,16)+':'+Math.round(l.amount)).join(' | '), r.done.estimate.multipliers.map(m=>m.label+'x'+m.factor).join(' ')); }
{ const r = await handleUserMessage(await toWrap(), 'high ceilings in the living room'); const c=r.done.ctx; console.log(JSON.stringify({ct:c.ceilingType,cc:c.ceilingColorChange,ch:c.ceilingHeight,ex:c.excludedRooms, rooms:c.selectedRooms, sq:c.squareFeet, ceil:c.interiorCeilings})); const b = await toWrap(); console.log(JSON.stringify({ct:b.ctx.ceilingType, sq:b.ctx.squareFeet})); }
