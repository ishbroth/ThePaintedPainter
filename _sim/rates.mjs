import { calculateEstimate, makeInitialContext } from './out/rules.mjs';
const mk=(p)=>({...makeInitialContext(),zipCode:'00000',...p});
for (const sq of [650,900,1500,2400]) { const e=calculateEstimate(mk({projectType:'interior',interiorScope:'whole_house',squareFeet:sq,propertyType:'residential'})); console.log(sq, e.total, e.lineItems.map(l=>l.description.slice(0,22)+':'+Math.round(l.amount)).join(' | ')); }
