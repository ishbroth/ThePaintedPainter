import { makeInitialState, handleUserMessage } from './out/rules.mjs';
async function run(grade, brand) {
  let s = makeInitialState(); const log = [];
  for (const m of ["my master bedroom, about 14x16","walls and ceiling","good shape","same color",brand,grade,"eggshell","91941","this month, vacant","i own it","run it","run it"]) { const r = await handleUserMessage(s, m); s = r.state; log.push(m + ' => ' + (r.done ? 'DONE' : s.history[s.history.length-1].text.slice(0,90))); if (r.done) { console.log(log.slice(3,9).join('\n')); console.log('TOTAL', Math.round(r.done.estimate.total), r.done.estimate.multipliers?.map(x=>x.label).join(', ') || '', '| brand', r.done.ctx.paintBrand, 'grade', r.done.ctx.paintGrade, 'finish', r.done.ctx.paintFinish); return; } }
  console.log(log.join('\n'));
}
await run('standard mid-grade is fine', 'painter\'s choice');
await run('premium please', 'Benjamin Moore');
