const fs = require('fs');
const f = 'supabase/functions/chat-estimator-extract/index.ts';
let t = fs.readFileSync(f, 'utf8');
const anchor = "- conditionAddressed and renoStageAddressed exist ONLY";
if (!t.includes(anchor)) throw new Error('nf');
const add = "- Naming ONE surface to exclude is NOT \"walls only\": \"no trim\" / \"without trim\" sets interiorTrim to \"no\" and nothing else (leave ceilings and doors unset, and do NOT set surfacesAddressed) so the customer is asked about the rest. Likewise \"no ceilings\" only excludes ceilings. Only an explicit limiter (\"walls only\", \"just the walls\") excludes everything else.\n- If the customer mentions the CEILINGS as something to paint (\"ceiling dark to light\", \"and the ceilings\"), set interiorCeilings to \"yes\". A ceiling can change color differently from the walls (\"walls same color, ceiling dark to light\"): set interiorColorChange from the WALLS only.\n- Never set surfacesAddressed, a surface to excluded, or exteriorColorChange from a message that doesn't actually say it. If the reply doesn't fit the last question, return nothing for it instead of guessing.\n";
t = t.replace(anchor, add + anchor);
fs.writeFileSync(f, t);
