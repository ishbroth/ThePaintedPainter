import { getRate, getRateDetails, RATE_KEYS } from './out/rules.mjs';
for (const [k,v] of Object.entries(RATE_KEYS)) { const r=getRate(v,'market'); if(!r) continue; console.log(k.padEnd(34), String(r.value).padStart(8), r.unit.padEnd(9), 'n='+r.count, getRateDetails(v).map(e=>e.value+(e.marketBasis===false?'*':'')).join(', ')); }
