import { getRegionalMultiplier } from './out/rules.mjs';
import { ZIPS } from './scenarios.mjs';
console.log(ZIPS.map(([z,l])=>{const r=getRegionalMultiplier(z);return `${z} ${l.padEnd(18)} x${r.multiplier.toFixed(2)} ${r.market}`}).join('\n'));
console.log('FALLBACK:',ZIPS.filter(([z])=>getRegionalMultiplier(z).market==='National Average').map(z=>z[0]+' '+z[1]).join(', '));
