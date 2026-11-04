import { handleUserMessage, makeInitialState } from '../src/lib/chatEstimator/chatEngine.ts';
import { setLLMReaderForTests } from '../src/lib/chatEstimator/llmClient.ts';
import { calculateEstimate } from '../src/lib/estimateEngine.ts';
import { highestPriceAssumption } from '../src/lib/chatEstimator/dismissive.ts';
setLLMReaderForTests(null);
let st = makeInitialState(); let done: any = null;
for (const l of ['i need a house with trim painted', 'the outside', '1500 sq ft', '91941', 'our home', 'painters choice', 'standard', 'painters choice', 'stucco', '1 story', 'yes the trim', 'no', 'no', 'no', 'no', 'no', 'good shape', 'no repairs', 'same color', 'asap', 'run it', 'run it', 'run it']) { const r = await handleUserMessage(st, l); st = r.state; if (r.done) { done = r.done; break; } }
const base = done.estimate.total as number;
console.log('sensible total', base, '| ctx stories', done.ctx.stories, 'siding', done.ctx.sidingType, 'windows', done.ctx.exteriorWindowCount, 'cond', done.ctx.exteriorCondition);
const ids = ['project_type','house_size','siding','stories','ext_trim','ext_doors','ext_garage','ext_gutters','ext_windows','ext_window_count','ext_condition','ext_repairs','ext_color','property_ownership','timeline_and_access'];
for (const id of ids) {
  const a = highestPriceAssumption(id, done.ctx);
  if (!a) continue;
  const ctx = { ...done.ctx, ...a.patch };
  const total = calculateEstimate(ctx, done.transcript ?? '').total;
  console.log(id.padEnd(22), total, (total - base >= 0 ? '+' : '') + Math.round(total - base));
}
