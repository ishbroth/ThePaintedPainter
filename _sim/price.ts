import { handleUserMessage, makeInitialState } from '../src/lib/chatEstimator/chatEngine.ts';
import { setLLMReaderForTests } from '../src/lib/chatEstimator/llmClient.ts';
setLLMReaderForTests(null);
async function run(opening: string[], filler: string, max = 40) {
  let st = makeInitialState();
  let done: unknown = null;
  for (const l of [...opening]) { const r = await handleUserMessage(st, l); st = r.state; if (r.done) { done = r.done; break; } }
  for (let i = 0; i < max && !done; i++) { const r = await handleUserMessage(st, filler); st = r.state; if (r.done) done = r.done; }
  return { done: done as { estimate?: { total?: number }; total?: number } | null, st };
}
const opening = ['i need a house with trim painted', 'the outside', '1500 sq ft', '91941'];
const dismissive = await run(opening, 'doesnt matter just want it done');
const sensible = await run([...opening, 'our home', 'painters choice', 'standard', 'painters choice', 'stucco', '1 story', 'yes the trim', 'no', 'no', 'no', 'no', 'no', 'good shape', 'no repairs', 'same color', 'asap'], 'run it');
const total = (x: typeof dismissive) => (x.done as { estimate?: { total?: number } } | null)?.estimate?.total ?? (x.done as { total?: number } | null)?.total ?? JSON.stringify(Object.keys(x.done ?? {}));
console.log('dismissive all the way ->', total(dismissive), '| bot turns:', dismissive.st.history.length);
console.log('sensible answers       ->', total(sensible), '| bot turns:', sensible.st.history.length);
console.log('last bot (dismissive):', dismissive.st.history[dismissive.st.history.length - 1].text.slice(0, 160));
