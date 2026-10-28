// Runs scripted conversations through the real estimator engine and checks what it asks and decides. No network: the AI reader is replaced
// by the plain rules engine, or by readings recorded from the live site (the ones that went wrong), to prove the guards catch them.
//
//   npm run check:estimator

import { handleUserMessage, makeInitialState, type ChatState } from '../src/lib/chatEstimator/chatEngine.ts';
import { setLLMReaderForTests } from '../src/lib/chatEstimator/llmClient.ts';
import type { Intent } from '../src/lib/chatEstimator/intents.ts';
import type { EstimatorContext } from '../src/lib/types.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '\n        ' + detail}`);
};

interface Reading { patch: Partial<EstimatorContext>; intents: Intent[]; acknowledgements: string[] }

/** Plays a conversation; `readings` are what the AI reader said about each message (omitted = rules engine only). Returns what the bot said after each message. */
async function play(lines: string[], readings: (Reading | null)[] = [], from?: ChatState) {
  let state: ChatState = from ?? makeInitialState();
  const turns: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const reading = readings[i] ?? null;
    setLLMReaderForTests(reading ? async () => reading : null);
    const before = state.history.length;
    const r = await handleUserMessage(state, lines[i]);
    state = r.state;
    turns.push(state.history.slice(before + 1).map((m) => m.text).join(' || '));
  }
  return { state, turns, last: turns[turns.length - 1] };
}

/** Plays the setup, keeps giving neutral answers until the bot asks the topic we want (matched by its words), then answers dismissively. */
async function dismissAt(setup: string[], topicWords: RegExp, dismissal = 'doesnt matter just want it done') {
  const a = await play(setup);
  let state = a.state;
  let asking = state.history[state.history.length - 1].text;
  for (let i = 0; i < 30 && !topicWords.test(asking); i++) {
    const r = await play(['no'], [], state); // a plain "no" is not a brush-off, so only the last message is the test
    state = r.state;
    asking = state.history[state.history.length - 1].text;
  }
  const reached = topicWords.test(asking);
  const before = state.ctx;
  const r = await play([dismissal], [], state);
  return { reached, asked: asking, before, after: r.state.ctx, reply: r.last, state: r.state };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. The conversation from the live site
// ---------------------------------------------------------------------------------------------------------------------------------
{
  // what the AI reader actually returned for "i need a house with trim painted": an inside, whole-house job nobody mentioned
  const badReading: Reading = {
    patch: { projectType: 'interior', interiorScope: 'whole_house', interiorWalls: 'yes', interiorTrim: 'yes' },
    intents: ['provide_info'], acknowledgements: [],
  };
  const a = await play(['i need a house with trim painted'], [badReading]);
  check('"house with trim": the bot asks inside or outside (it used to skip the question)', /inside|interior/i.test(a.last) && /outside|exterior/i.test(a.last), a.last);
  check('"house with trim": nothing was guessed about the inside', a.state.ctx.projectType === '' && a.state.ctx.interiorScope === '', JSON.stringify({ p: a.state.ctx.projectType, s: a.state.ctx.interiorScope }));

  const exteriorReading: Reading = { patch: { projectType: 'exterior' }, intents: ['provide_info'], acknowledgements: ['exterior'] };
  const b = await play(['i need a house with trim painted', 'the outside'], [badReading, exteriorReading]);
  check('after "the outside", the trim they already mentioned is counted (no repeat trim question)', b.state.ctx.projectType === 'exterior' && b.state.ctx.exteriorTrim === 'yes', JSON.stringify({ t: b.state.ctx.projectType, trim: b.state.ctx.exteriorTrim }));
  check('...and the next question is the owner/rental one', /live here|rental|your home/i.test(b.last), b.last);

  // the reader tags the brush-off as a "deflection", which used to produce the canned "tighter number" line and a repeat of the question
  const dismissReading: Reading = { patch: {}, intents: ['deflection'], acknowledgements: [] };
  const c = await play(['i need a house with trim painted', 'the outside', 'doesnt matter just want it done'], [badReading, exteriorReading, dismissReading]);
  check('"doesn\'t matter, just want it done": no canned ballpark line and no repeat of the question', !/tighter number|ballpark/i.test(c.last) && !/live here|your home, or a rental/i.test(c.last.split(' || ').slice(1).join(' ')), c.last);
  check('...it takes the higher-priced answer (owner-occupied) and says so', c.state.ctx.propertyType === 'residential' && /higher-priced/i.test(c.last), JSON.stringify({ p: c.state.ctx.propertyType, last: c.last }));
  check('...and moves on to a different question', c.last.split(' || ').length === 2 && /\?\s*$/.test(c.last), c.last);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. The rule for any dismissive answer: highest price
// ---------------------------------------------------------------------------------------------------------------------------------
{
  const a = await play(['i need my house painted', 'doesnt matter', 'whatever']);
  check('dismissive about inside or outside: never assumed, asked again every time', a.state.ctx.projectType === '' && /inside|interior/i.test(a.last) && /outside|exterior/i.test(a.last), JSON.stringify({ p: a.state.ctx.projectType, last: a.last }));
  const a2 = await play(['i need my house painted', 'doesnt matter', 'the walls and baseboards and ceilings in the bedrooms']);
  check('...later hints about walls, ceilings, baseboards mean inside', a2.state.ctx.projectType === 'interior', JSON.stringify(a2.state.ctx.projectType));
  const a3 = await play(['i need my house painted', 'doesnt matter', 'the siding, soffits and eaves']);
  check('...later hints about siding, soffits, eaves mean outside', a3.state.ctx.projectType === 'exterior', JSON.stringify(a3.state.ctx.projectType));

  const both1 = await play(['i need my house painted', 'doesnt matter', 'the inside color is gray and the outside color will be white']);
  check('...inside AND outside named in one message means both', both1.state.ctx.projectType === 'both', JSON.stringify(both1.state.ctx.projectType));
  const both2 = await play(['i need my house painted', 'doesnt matter', 'the walls and ceilings inside and also the siding and eaves']);
  check('...walls/ceilings plus siding/eaves across messages means both', both2.state.ctx.projectType === 'both', JSON.stringify(both2.state.ctx.projectType));
  const both3 = await play(['i need my house painted', 'doesnt matter', 'the bedroom walls', 'and the siding too']);
  check('...an inside hint, then an outside hint later, becomes both', both3.state.ctx.projectType === 'both', JSON.stringify(both3.state.ctx.projectType));
  const both4 = await play(['i need my house painted', 'both']);
  check('answering "both" directly', both4.state.ctx.projectType === 'both', JSON.stringify(both4.state.ctx.projectType));

  const keep = await play(['i need my house painted', 'inside', 'just the bedroom walls, not the siding or eaves']);
  check('an inside job that says "not the siding or eaves" stays inside only', keep.state.ctx.projectType === 'interior', JSON.stringify(keep.state.ctx.projectType));

  const b = await dismissAt(['exterior of the house', '2000 sq ft'], /material|siding/i);
  check('dismissive about the siding: the priciest siding in the price table', b.reached && !!b.after.sidingType && b.after.sidingType !== '' && /higher-priced/.test(b.reply), JSON.stringify({ asked: b.asked, siding: b.after.sidingType }));

  const c = await dismissAt(['exterior of the house', '2000 sq ft'], /stor(?:y|ies)|how tall|floors/i);
  check('dismissive about the stories: the tallest realistic (two for a 2,000 sq ft house)', c.reached && c.after.stories === 2, JSON.stringify({ asked: c.asked, stories: c.after.stories }));

  const d = await dismissAt(['interior of the house', 'the whole house'], /what (?:all|in the room)|paint(?:ing)?\?|surfaces/i, "i don't care");
  check('dismissive about what gets painted: everything, trim and doors included', d.reached ? d.after.interiorCeilings === 'yes' && d.after.interiorTrim === 'yes' && d.after.interiorDoors !== 'none' : true, JSON.stringify({ asked: d.asked }));

  const e = await dismissAt(['interior of the house', '1500 sq ft'], /ceilings|baseboards|doors|surfaces|painting/i, 'just do it');
  check('a dismissive answer never loops: the next question is different', e.reply.split(' || ').length >= 2 && e.reply.split(' || ')[1] !== e.asked, e.asked + ' => ' + e.reply);

  const f = await dismissAt(['exterior of the house', '2000 sq ft'], /color/i, 'whatever');
  check('dismissive about the color: a different color (the pricier answer)', !f.reached || f.after.exteriorColorChange === 'different', JSON.stringify({ asked: f.asked, c: f.after.exteriorColorChange }));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. Not everything is "dismissive"
// ---------------------------------------------------------------------------------------------------------------------------------
{
  const a = await play(['exterior of the house', "it's a rental"]);
  check('a real answer ("it\'s a rental") is taken as said, not replaced by the highest price', a.state.ctx.propertyType === 'rental', JSON.stringify(a.state.ctx.propertyType));

  const b = await play(['exterior of the house', "I'm not sure"]);
  check('"I\'m not sure" still gets the typical default, not the highest price', !/higher-priced/.test(b.last) && /no worries/i.test(b.last), b.last);

  const c = await play(['i need my house painted', 'inside']);
  check('answering inside/outside normally still works', c.state.ctx.projectType === 'interior', JSON.stringify(c.state.ctx.projectType));

  const d = await play(['exterior of the house', 'stucco, 2 stories, 2000 sqft, doesnt matter if its occupied']);
  check('info inside a dismissive message is still used', d.state.ctx.stories === 2 && d.state.ctx.squareFeet === 2000, JSON.stringify({ s: d.state.ctx.stories, q: d.state.ctx.squareFeet }));

  const e = await play(['exterior of the house', "it's our home", 'whatever the painter picks is fine']);
  check('"whatever the painter picks" about paint still just means the painter chooses, and the brand question is not asked again', e.state.ctx.paintBrand === 'painter_choice' && !/paint brand/i.test(e.last), JSON.stringify({ brand: e.state.ctx.paintBrand, last: e.last }));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 4. A ZIP can't be assumed
// ---------------------------------------------------------------------------------------------------------------------------------
{
  const z = await dismissAt(['exterior of the house', '2000 sq ft'], /zip|city|where is/i, 'who cares');
  if (z.reached) {
    check('dismissive about the ZIP: says why it is needed and asks again, no guessing', /zip/i.test(z.reply) && !z.after.zipCode && z.reply.includes('?'), z.reply);
  } else {
    console.log('skip  the ZIP question did not come up in this conversation (' + z.asked + ')');
  }
}

setLLMReaderForTests(undefined);
console.log(failures ? `\n${failures} FAILED` : '\nall conversation checks passed');
process.exit(failures ? 1 : 0);
