const fs=require('fs');const f='src/lib/chatEstimator/chatEngine.ts';
let t=fs.readFileSync(f,'utf8');const crlf=t.includes('\r\n');t=t.split('\r\n').join('\n');
const a="  const describedSomething = !!(state.ctx.projectType";
if(!t.includes(a))throw new Error('nf');
t=t.replace(a,()=>"  const PAINTABLE_WORDS = /\b(windows?|doors?|railings?|rails?|fences?|gates?|shutters?|mailbox|walls?|ceilings?|cabinets?|trim|baseboards?|molding|deck|porch|garage|shed|siding|stairs?|stairway|closets?|room|bedroom|bathroom|kitchen|living room|dining|hallway|basement|furniture|chair|table|dresser|desk|bookcase|fireplace|mantel|pantry|house|apartment|condo)\b/i;\n  const describedSomething = userTurns.some((m) => PAINTABLE_WORDS.test(m.text)) || !!(state.ctx.projectType");
fs.writeFileSync(f,crlf?t.split('\n').join('\r\n'):t);
