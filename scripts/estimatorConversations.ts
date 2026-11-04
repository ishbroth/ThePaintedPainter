// Runs scripted conversations through the real estimator engine and checks what it asks and decides. No network: the AI reader is replaced
// by the plain rules engine, or by readings recorded from the live site (the ones that went wrong), to prove the guards catch them.
//
//   npm run check:estimator

import { handleUserMessage, makeInitialState, type ChatState } from '../src/lib/chatEstimator/chatEngine.ts';
import { setLLMReaderForTests } from '../src/lib/chatEstimator/llmClient.ts';
import type { Intent } from '../src/lib/chatEstimator/intents.ts';
import type { EstimatorContext } from '../src/lib/types.ts';
import { calculateEstimate } from '../src/lib/estimateEngine.ts';
import { parseArea, parseCount, parseDimensionPair, parseFenceAnswer, parseLinearFeet } from '../src/lib/chatEstimator/details.ts';
import { botRepeats, collectFriction, detectFriction } from '../src/lib/chatEstimator/selfCheck.ts';
import { buildReport, scrub, setSelfReviewEnabled } from '../src/lib/chatEstimator/selfReview.ts';
import { defaultAssumptions } from '../src/lib/chatEstimator/defaultAssumptions.ts';
import { fieldsForKey } from '../src/lib/priceEditing.ts';

setSelfReviewEnabled(false); // no network from the checks

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

// ---------------------------------------------------------------------------------------------------------------------------------
// 5. The wrap-up: "anything else?" is its own question, then photos, then the number; the answer counts
// ---------------------------------------------------------------------------------------------------------------------------------
{
  /** Plays a whole interior job up to (not including) the "anything else?" answer. */
  const toWrapUp = async () => {
    let r = await play(['interior of my 600 sq ft one bedroom apartment', 'just the walls, no ceilings, trim or doors']);
    const answers: [RegExp, string][] = [
      [/home|rental/i, 'I own it'], [/brand|painter choose/i, 'painter choice'], [/zip/i, '91941'], [/timeline|when|living there|anyone/i, 'next month, nobody lives there'],
      [/color|changing/i, 'a different color'],
    ];
    for (let i = 0; i < 15 && !/anything else/i.test(r.last); i++) {
      const q = r.last.split('||').pop() ?? '';
      r = await play([answers.find(([re]) => re.test(q))?.[1] ?? 'no'], [], r.state);
    }
    return r;
  };
  const w = await toWrapUp();
  check('the wrap-up asks "anything else?" on its own, with no photo ask in the same message', /anything else/i.test(w.last) && !/photo/i.test(w.last), w.last);
  check('"no ceilings, trim or doors" is a whole list: baseboards are not suggested back', !/baseboards/i.test(w.turns.join(' ')), w.turns.join(' | ').slice(0, 300));
  const photos = await play(['no'], [], w.state);
  check('after "no", the next message is the photo ask and says it has enough to price', /photo/i.test(photos.last) && /run it/i.test(photos.last) && !photos.state.finalEstimate, photos.last);
  const done = await play(['run it'], [], photos.state);
  check('"run it" then gives the price', !!done.state.finalEstimate || /guaranteed price/i.test(done.last), done.last);

  const total = (s: ChatState) => calculateEstimate(s.ctx).total;
  const base = total(photos.state);
  for (const reply of ['20 feet', 'the ceiling height is 12 ft', '10 foot ceilings', 'about 20 ft tall']) {
    const a = await play([reply], [], w.state);
    check(`"${reply}" at "anything else?" is read as a ceiling height and changes the price`, a.state.ctx.ceilingHeight !== 'standard' && total(a.state) > base, JSON.stringify({ h: a.state.ctx.ceilingHeight, t: total(a.state), base }));
  }
  const fence = await play(['the fence is 10 ft and there is a friendly dog'], [], w.state);
  check('a 10 ft fence is not mistaken for the ceiling height, and the note is kept for the painters', fence.state.ctx.ceilingHeight === 'standard' && /friendly dog/.test(fence.state.ctx.additionalDetails), JSON.stringify({ h: fence.state.ctx.ceilingHeight, d: fence.state.ctx.additionalDetails }));
}

// A whole inside (or a kitchen) with the trim in: the kitchen cabinets get asked about, once; "no" leaves them out for good.
{
  const walk = async (opening: string[]) => {
    let r = await play(opening);
    const seen: string[] = [r.last];
    for (let i = 0; i < 14 && !/cabinets/i.test(r.last); i++) {
      const q = r.last.split('||').pop() ?? '';
      const reply = /interior|inside|outside|exterior/i.test(q) ? 'inside' : /color|paint|brand|finish|grade/i.test(q) ? 'whatever you recommend' : /how big|square|size/i.test(q) ? '2400 sq ft' : /ceilings/i.test(q) ? 'yes' : /baseboard|trim/i.test(q) ? 'yes' : /door/i.test(q) ? 'yes' : /condition|shape|walls looking/i.test(q) ? 'good shape' : 'no';
      r = await play([reply], [], r.state);
      seen.push(r.last);
    }
    return { r, seen };
  };
  const whole = await walk(['I want the whole inside of my house painted, walls, trim and doors']);
  check('a whole inside with trim and doors: the kitchen cabinets are asked about', /cabinets/i.test(whole.r.last), whole.seen.join(' | ').slice(0, 500));
  const yes = await play(['yes'], [], whole.r.state);
  check('"yes" adds the kitchen cabinets', yes.state.ctx.cabinets !== 'none', JSON.stringify(yes.state.ctx.cabinets));
  const no = await play(['no'], [], whole.r.state);
  check('"no" leaves the cabinets out and they are not asked again', no.state.ctx.cabinets === 'none' && !/cabinets/i.test(no.last), no.last);
  const kitchen = await walk(['I want my kitchen painted, the walls and trim']);
  check('a kitchen with trim: the cabinets are asked about', /cabinets/i.test(kitchen.r.last), kitchen.seen.join(' | ').slice(0, 500));
}

// The current finish of cabinets, baseboards/trim and doors: asked, read, and priced (painted is the base; bare wood and stained wood cost more prep; pre-primed less).
{
  const priceOf = (st: ChatState) => calculateEstimate(st.ctx).total;
  const start = ['I want the whole inside of my house painted, walls, trim and doors', '2400 sq ft', 'walls, ceilings, trim and doors', 'yes'];
  const cab = await play([...start, 'yes']); // "...the trim: yes", then yes to the kitchen cabinets
  check('kitchen cabinets: asked whether they are painted, bare, stained or pre-primed', /cabinets/i.test(cab.last) && /bare/i.test(cab.last), cab.last.slice(0, 300));
  const finishes: Record<string, number> = {};
  for (const [name, reply] of [['painted', 'they are painted white'], ['bare', 'bare wood'], ['stained', 'stained oak'], ['primed', 'pre-primed']] as const) {
    const a2 = await play([reply], [], cab.state);
    finishes[name] = priceOf(a2.state);
    check(`cabinets "${reply}" is read (${a2.state.ctx.cabinetFinish})`, a2.state.ctx.cabinetFinish === { painted: 'painted', bare: 'bare_wood', stained: 'stained', primed: 'primed' }[name], JSON.stringify(a2.state.ctx.cabinetFinish));
  }
  check('cabinets: bare wood and stained wood cost more than painted, pre-primed costs less', finishes.bare > finishes.painted && finishes.stained > finishes.bare && finishes.primed < finishes.painted, JSON.stringify(finishes));
  const said = await play(['I want the kitchen cabinets painted, they are stained oak']);
  check('stained oak cabinets said up front are read', said.state.ctx.cabinetFinish === 'stained', JSON.stringify(said.state.ctx.cabinetFinish));

  const trim = await play([...start, 'no']); // no to the kitchen cabinets: the trim and doors question comes next
  check('trim and doors: asked whether they are painted, bare, stained or pre-primed', /doors/i.test(trim.last) && /bare/i.test(trim.last), trim.last.slice(0, 300));
  const mixed = await play(['stained oak doors, painted baseboards'], [], trim.state);
  check('"stained oak doors, painted baseboards" is read per item', mixed.state.ctx.doorFinish === 'stained' && mixed.state.ctx.trimFinish === 'painted', JSON.stringify([mixed.state.ctx.trimFinish, mixed.state.ctx.doorFinish]));
  const allPainted = await play(['all painted white'], [], trim.state);
  const bareAll = await play(['all bare wood'], [], trim.state);
  check('trim and doors: bare wood costs more to prep than painted', priceOf(bareAll.state) > priceOf(allPainted.state), String([priceOf(bareAll.state), priceOf(allPainted.state)]));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// How many, how long, how big: counts and sizes behind doors, windows, chairs, fences, decks and overhangs, and the small trim details
// ---------------------------------------------------------------------------------------------------------------------------------
{
  // "20 x 20", "20 by 20", "20x20 ft" are a length and a width: 400 square feet
  for (const t of ['20 x 20', '20 by 20', '20x20 ft', "20' x 20'", '20 X 20 feet', 'about 20 by 20 feet']) check(`"${t}" is 400 sq ft`, parseArea(t, true) === 400, String(parseArea(t, true)));
  check('"12.5 by 16" is 200 sq ft', parseArea('12.5 by 16', true) === 200, String(parseArea('12.5 by 16', true)));
  check('"350 sq ft" is read', parseArea('about 350 sq ft', true) === 350);
  check('a bare "300" answers an area question', parseArea('300', true) === 300);
  check('a bare number is not an area unless an area was asked for', parseArea('300', false) === null);
  check('a dimension pair is not a count', parseCount('3 x 6') === null);
  check('"a dozen", "two", "about 12" are counts', parseCount('a dozen') === 12 && parseCount('two') === 2 && parseCount('about 12') === 12);
  check('"150 feet" and "150 linear feet" and "150 lf" are lengths', parseLinearFeet('150 feet') === 150 && parseLinearFeet('150 linear feet') === 150 && parseLinearFeet('150 lf') === 150);
  const f1 = parseFenceAnswer('about 150 feet, 6 feet tall');
  const f2 = parseFenceAnswer('80 ft of 4 foot picket fence');
  const f3 = parseFenceAnswer('150 x 6');
  const f4 = parseFenceAnswer('six foot tall, 200 feet long');
  check('fence "150 feet, 6 feet tall" is length 150, height 6', f1.feet === 150 && f1.height === 6, JSON.stringify(f1));
  check('fence "80 ft of 4 foot picket fence" is length 80, height 4', f2.feet === 80 && f2.height === 4, JSON.stringify(f2));
  check('fence "150 x 6" is length 150, height 6', f3.feet === 150 && f3.height === 6, JSON.stringify(f3));
  check('fence "six foot tall, 200 feet long" is length 200, height 6', f4.feet === 200 && f4.height === 6, JSON.stringify(f4));
  check('a dimension pair is found in "a 20x20 deck"', parseDimensionPair('a 20x20 deck')?.area === 400);

  const priceOf = (st: ChatState) => calculateEstimate(st.ctx).total;
  const lineOf = (st: ChatState, re: RegExp) => calculateEstimate(st.ctx).lineItems.find((l) => re.test(l.description));
  /** Keeps answering `answer` until the bot asks something matching `re` (or gives up). */
  const until = async (from: ChatState, re: RegExp, answer = 'no') => {
    let state = from;
    for (let i = 0; i < 25 && !re.test(state.history[state.history.length - 1].text); i++) state = (await play([answer], [], state)).state;
    return { state, asked: state.history[state.history.length - 1].text, reached: re.test(state.history[state.history.length - 1].text) };
  };

  // 1. doors: yes to the doors being included -> how many?
  const start = await play(['I want the whole inside of my house painted, walls, trim and doors', '2400 sq ft', 'walls, ceilings, trim and doors', 'yes']);
  const doorQ = await until(start.state, /how many doors|doors are we talking about|roughly how many doors/i);
  check('interior doors included: the bot asks how many doors', doorQ.reached, doorQ.asked);
  const few = await play(['6 doors'], [], doorQ.state);
  const many = await play(['about 20'], [], doorQ.state);
  check('door count "6 doors" is read', few.state.ctx.doorCount === 6, JSON.stringify(few.state.ctx.doorCount));
  check('door count "about 20" is read', many.state.ctx.doorCount === 20, JSON.stringify(many.state.ctx.doorCount));
  check('more doors cost more', priceOf(many.state) > priceOf(few.state), String([priceOf(few.state), priceOf(many.state)]));
  check('the door count is not asked twice', !/how many doors|doors are we talking about|roughly how many doors/i.test(few.last), few.last);
  check('the price line shows the door count', /\(6\)/.test(lineOf(few.state, /Interior Doors/)?.description ?? ''), JSON.stringify(lineOf(few.state, /Interior Doors/)));
  check('the doors can be edited in the breakdown', fieldsForKey('doors').some((f) => f.field === 'doorCount'));
  const noCount = await play(['whatever'], [], doorQ.state);
  check('an uncounted door list is shown as an estimate in the assumptions', defaultAssumptions(doorQ.state.ctx).some((a) => /doors estimated/i.test(a.label)) && !!noCount.state);

  // 2. windows
  const win = await play(['I want my bedroom walls and the window frames painted']);
  check('window frames in a bedroom are inside work, not an outside job', win.state.ctx.projectType === 'interior' && win.state.ctx.interiorWindows !== 'none', JSON.stringify([win.state.ctx.projectType, win.state.ctx.interiorWindows]));
  const winQ = await until(win.state, /how many windows/i);
  check('window frames included: the bot asks how many windows', winQ.reached, winQ.asked);
  const winA = await play(['8 windows'], [], winQ.state);
  check('window count is read and shown on the price line', winA.state.ctx.windowCount === 8 && /\(8\)/.test(lineOf(winA.state, /Window Frames/)?.description ?? ''), JSON.stringify(lineOf(winA.state, /Window/)));

  // 3. chairs
  const chairs = await play(['I want to paint my dining chairs']);
  check('only chairs: no ceilings or baseboards are suggested', !/ceilings|baseboards/i.test(chairs.last), chairs.last);
  const chairQ = await until(chairs.state, /how many chairs/i);
  check('chairs mentioned: the bot asks how many', chairQ.reached, chairQ.asked);
  const six = await play(['6'], [], chairQ.state);
  const two = await play(['2'], [], chairQ.state);
  check('chair count "6" is read', six.state.ctx.chairCount === 6, JSON.stringify(six.state.ctx.chairCount));
  check('six chairs cost more than two', priceOf(six.state) > priceOf(two.state), String([priceOf(two.state), priceOf(six.state)]));
  check('the chair count can be edited in the breakdown', fieldsForKey('furniture').some((f) => f.field === 'chairCount'));

  // 4. fence: length and height
  const fence = await play(['I want my fence painted']);
  check('a fence: the bot asks how long and how tall', /linear feet/i.test(fence.last) && /tall|high/i.test(fence.last), fence.last);
  const tall = await play(['100 feet, 8 feet tall'], [], fence.state);
  const short = await play(['100 feet, 4 feet tall'], [], fence.state);
  check('fence length and height are read', tall.state.ctx.fenceLinearFeet === 100 && tall.state.ctx.fenceHeightFt === 8, JSON.stringify([tall.state.ctx.fenceLinearFeet, tall.state.ctx.fenceHeightFt]));
  check('a taller fence costs more', priceOf(tall.state) > priceOf(short.state), String([priceOf(short.state), priceOf(tall.state)]));
  check('the fence line shows the height', /8 ft tall/.test(lineOf(tall.state, /Fence/)?.description ?? ''), JSON.stringify(lineOf(tall.state, /Fence/)));
  const lengthOnly = await play(['150'], [], fence.state);
  check('only the length given: the height is asked next', lengthOnly.state.ctx.fenceLinearFeet === 150 && /how tall/i.test(lengthOnly.last), lengthOnly.last);
  check('the fence height can be edited in the breakdown', fieldsForKey('fence').some((f) => f.field === 'fenceHeightFt'));

  // exterior job: a fence, a deck or a patio cover is offered
  const house = await play(['I want the outside of my house painted']);
  const extras = await until(house.state, /fence, a deck|a fence, a deck|fence, deck|a deck or a patio/i, 'yes');
  check('an outside job: the bot asks about a fence, deck or patio cover', extras.reached, extras.asked);
  const bareYes = await play(['yes'], [], extras.state);
  check('a bare yes: the bot asks which one', /which one/i.test(bareYes.last), bareYes.last);
  const which = await play(['the fence and a deck'], [], bareYes.state);
  check('"the fence and a deck" adds both', which.state.ctx.fence === 'yes' && which.state.ctx.deck === 'yes', JSON.stringify([which.state.ctx.fence, which.state.ctx.deck]));

  // 5. decks and overhangs: square feet, "20 x 20" included
  const deck = await play(['I want my deck stained']);
  check('a deck: the bot asks the size', /square feet|length and width/i.test(deck.last), deck.last);
  const deck400 = await play(['20 x 20'], [], deck.state);
  check('deck "20 x 20" is 400 sq ft', deck400.state.ctx.deckSqft === 400, JSON.stringify(deck400.state.ctx.deckSqft));
  check('...and priced from it', /\(400 sq ft\)/.test(lineOf(deck400.state, /Deck/)?.description ?? ''), JSON.stringify(lineOf(deck400.state, /Deck/)));
  for (const [text, area] of [['20 by 20', 400], ['20x20 ft', 400], ['500 sq ft', 500], ['300', 300]] as const) {
    const d = await play([text], [], deck.state);
    check(`deck "${text}" is ${area} sq ft`, d.state.ctx.deckSqft === area, JSON.stringify(d.state.ctx.deckSqft));
  }
  const said = await play(['I need a 16x24 deck stained']);
  check('a deck size said up front is used and not asked again', said.state.ctx.deckSqft === 384 && !/how many square feet is the deck/i.test(said.last), JSON.stringify([said.state.ctx.deckSqft, said.last]));
  const cover = await play(['I want the patio cover painted']);
  check('an overhang or patio cover: the bot asks the size', /square feet|length and width|length times width/i.test(cover.last), cover.last);
  const cover240 = await play(['12 by 20'], [], cover.state);
  check('overhang "12 by 20" is 240 sq ft', cover240.state.ctx.overhangSqft === 240, JSON.stringify(cover240.state.ctx.overhangSqft));

  // 6. oddball items, alone: chair rail, crown moulding, closet shelves, wainscoting
  const rail = await play(['just the new chair rail that was installed painted, nothing else']);
  check('only a chair rail: no walls, ceilings or doors, and the bot asks how many rooms', rail.state.ctx.interiorWalls === 'no' && rail.state.ctx.chairRail === 'yes' && /how many rooms/i.test(rail.last), JSON.stringify([rail.state.ctx.interiorWalls, rail.state.ctx.chairRail, rail.last]));
  check('...and does not suggest ceilings or baseboards', !/ceilings|baseboards\?/i.test(rail.last), rail.last);
  const railRooms = await play(['3'], [], rail.state);
  check('chair rail: then the approximate linear feet', railRooms.state.ctx.detailRoomCount === 3 && /linear feet/i.test(railRooms.last), railRooms.last);
  const railFeet = await play(['90 feet'], [], railRooms.state);
  const railLine = lineOf(railFeet.state, /Chair Rail/);
  check('chair rail is priced by the foot on its own line', !!railLine && /90 lin ft/.test(railLine.description), JSON.stringify(railLine));
  check('...and a small job is held up to the minimum service charge', !!lineOf(railFeet.state, /Minimum service charge/), calculateEstimate(railFeet.state.ctx).lineItems.map((l) => l.description).join('; '));
  const railUnsure = await play(['not sure'], [], railRooms.state);
  const railMoreRooms = await play(['not sure'], [], (await play(['10'], [], rail.state)).state);
  check('chair rail with no footage is estimated from the rooms (more rooms, more rail)', priceOf(railMoreRooms.state) > priceOf(railUnsure.state), String([priceOf(railUnsure.state), priceOf(railMoreRooms.state)]));
  check('the estimate is listed in the assumptions', defaultAssumptions(railUnsure.state.ctx).some((a) => /chair rail length estimated/i.test(a.label)));
  check('chair rail footage can be edited in the breakdown', fieldsForKey('chair_rail').some((f) => f.field === 'chairRailLinearFeet'));

  const crown = await play(['only crown moulding painted, nothing else']);
  check('only crown moulding: priced as crown and the bot asks about the rooms or feet', crown.state.ctx.crownMolding === 'yes' && crown.state.ctx.interiorWalls === 'no' && /rooms|linear feet/i.test(crown.last), JSON.stringify([crown.state.ctx.crownMolding, crown.last]));
  const crownFeet = await play(['2 rooms', '120 feet'], [], crown.state);
  check('crown moulding footage is read and priced', crownFeet.state.ctx.crownLinearFeet === 120 && /120 lin ft/.test(lineOf(crownFeet.state, /Crown/)?.description ?? ''), JSON.stringify(lineOf(crownFeet.state, /Crown/)));
  check('crown moulding footage can be edited in the breakdown', fieldsForKey('crown').some((f) => f.field === 'crownLinearFeet'));

  const shelves = await play(['just the closet shelves painted, nothing else']);
  check('only closet shelves: the bot asks how many closets', /how many closets/i.test(shelves.last), shelves.last);
  const shelves3 = await play(['3'], [], shelves.state);
  check('closet count is read and priced', shelves3.state.ctx.closetCount === 3 && /Closets \(3\)/.test(lineOf(shelves3.state, /Closets/)?.description ?? ''), JSON.stringify(lineOf(shelves3.state, /Closets/)));

  const wains = await play(['just wainscoting in the dining room, nothing else']);
  const wainsQ = await until(wains.state, /square feet of wainscoting/i, 'medium');
  check('only wainscoting: no walls, and the bot asks how many square feet', wains.state.ctx.wainscoting === 'yes' && wains.state.ctx.interiorWalls === 'no' && wainsQ.reached, wainsQ.asked);
  const wains2 = await play(['30 x 3'], [], wainsQ.state);
  check('wainscoting "30 x 3" is 90 sq ft', wains2.state.ctx.wainscotSqft === 90, JSON.stringify(wains2.state.ctx.wainscotSqft));

  // a crown moulding or chair rail inside a bigger job still gets its length asked
  const bigger = await play(['I want my whole house painted inside, walls, ceilings, trim and crown molding', '2000 sq ft']);
  const crownAsk = await until(bigger.state, /linear feet of crown/i);
  check('crown moulding in a bigger job: its length is asked', crownAsk.reached, crownAsk.asked);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The self-trainer: noticing a conversation going badly, correcting course live, and what gets sent for review afterwards
// ---------------------------------------------------------------------------------------------------------------------------------
{
  for (const t of ['I already said that', 'like I said, 14 doors', 'As I said before, it is a rental', 'you already asked me that', 'stop asking', 'I just told you', 'again?', 'I already told you the zip code']) {
    check(`friction: "${t}" is a repeat complaint`, detectFriction(t) === 'repeat_complaint', String(detectFriction(t)));
  }
  for (const t of ["no that's not what I meant", "that's not what I asked", "that's not what I said", 'you misunderstood me', "that doesn't answer my question", "I didn't ask that"]) {
    check(`friction: "${t}" is a misunderstanding`, detectFriction(t) === 'misunderstood', String(detectFriction(t)));
  }
  for (const t of ['6 doors', 'yes', 'about 2000 sq ft', 'the whole house, walls and trim', "that's all", 'I said yes to the cabinets']) {
    check(`friction: "${t}" is a normal message`, detectFriction(t) === null, String(detectFriction(t)));
  }
  const repeated = botRepeats([
    { role: 'bot', text: 'Hi! How many doors are we talking about, approximately?' },
    { role: 'user', text: 'eight' },
    { role: 'bot', text: 'Got it. How many doors are we talking about, approximately?' },
  ]);
  check('the same question asked twice is a bot_repeat', repeated.length === 1 && repeated[0].kind === 'bot_repeat', JSON.stringify(repeated));

  // live: the customer already gave the answer, and the notes have it
  const known = await play(['I want the whole inside of my house painted, walls, trim and doors', '2400 sq ft', 'walls, ceilings, trim and doors', 'yes', 'no', 'all painted']);
  check('setup: the bot asks how many doors', /doors/i.test(known.last) && /how many|approximately/i.test(known.last), known.last);
  const noticed = await play(['like I said, 14 doors'], [], known.state);
  check('"like I said, 14 doors": the bot owns up, uses the answer and does not ask it again', noticed.state.ctx.doorCount === 14 && /you'?re right|sorry/i.test(noticed.last) && !/how many doors/i.test(noticed.last), noticed.last);
  check('...and what it understood is read back', /14 doors/.test(noticed.last), noticed.last);
  check('...and the friction is on record', (noticed.state.friction ?? []).some((e) => e.kind === 'repeat_complaint'), JSON.stringify(noticed.state.friction));

  // live: the bot is asking something the notes already hold
  const asked = await play(['I already told you that'], [], { ...known.state, ctx: { ...known.state.ctx, doorCount: 9 } });
  check('"I already told you": when the notes already hold it, the bot apologises and moves on without asking again', /sorry|right/i.test(asked.last) && !/how many doors/i.test(asked.last), asked.last);

  // live: not what I meant
  const confused = await play(["no that's not what I meant"], [], known.state);
  check('"that\'s not what I meant": a brief apology, what it has so far, and no pushing on with a default', /sorry/i.test(confused.last) && /what i have so far|here's what/i.test(confused.last), confused.last);
  check('...and it is logged as a misunderstanding', (confused.state.friction ?? []).some((e) => e.kind === 'misunderstood'), JSON.stringify(confused.state.friction));

  // after the quote: what would be sent for the self-review
  const transcript = [
    { role: 'bot' as const, text: 'How many doors are we talking about?' },
    { role: 'user' as const, text: 'call me at (619) 724-2702 or me@example.com, 14 doors' },
    { role: 'bot' as const, text: 'How many doors are we talking about?' },
    { role: 'user' as const, text: 'I already said that' },
  ];
  const report = buildReport(transcript, []);
  const sent = JSON.stringify(report);
  check('the review report has no phone numbers or emails', !/724-2702|example\.com/.test(sent) && /\[phone\]/.test(sent) && /\[email\]/.test(sent), sent);
  check('the review report lists the friction (a complaint and a repeated question)', report.signals.some((s) => s.kind === 'repeat_complaint') && report.signals.some((s) => s.kind === 'bot_repeat'), JSON.stringify(report.signals));
  check('a normal conversation reports no friction', collectFriction([{ role: 'bot', text: 'How big is it?' }, { role: 'user', text: '2000 sq ft' }]).length === 0);
  check('scrub keeps the rest of the text', scrub('14 doors please') === '14 doors please');
}

setLLMReaderForTests(undefined);
console.log(failures ? `\n${failures} FAILED` : '\nall conversation checks passed');
process.exit(failures ? 1 : 0);
