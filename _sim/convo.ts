// Runs a conversation through the real estimator engine (local rules only: the AI reader is unreachable here, so the engine falls back).
import { handleUserMessage, makeInitialState } from '../src/lib/chatEstimator/chatEngine.ts';
const lines = process.argv.slice(2);
let state = makeInitialState();
console.log('BOT:', state.history[0].text);
for (const line of lines) {
  console.log('YOU:', line);
  const r = await handleUserMessage(state, line);
  state = r.state;
  const last = state.history[state.history.length - 1];
  console.log('BOT:', last.text);
  if (r.done) { console.log('[estimate ready]', JSON.stringify((r.done as { total?: number }).total ?? ''), ); break; }
}
console.log('--- ctx:', JSON.stringify({ projectType: state.ctx.projectType, propertyType: state.ctx.propertyType, squareFeet: state.ctx.squareFeet, interiorTrim: state.ctx.interiorTrim, zip: state.ctx.zipCode, exteriorBody: state.ctx.exteriorBody }));
