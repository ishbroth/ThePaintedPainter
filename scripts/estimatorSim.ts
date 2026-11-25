// Plays many simulated customers (a persona that answers what it is asked, with side questions, tangents, vague answers and volunteered
// details mixed in) through the real estimator engine, and flags the ways the conversation goes wrong. No network.
//
//   npm run sim:estimator            (100 conversations)     npm run sim:estimator -- 300 7     (count, seed)
import { handleUserMessage, makeInitialState } from '../src/lib/chatEstimator/chatEngine.ts';
import { setLLMReaderForTests } from '../src/lib/chatEstimator/llmClient.ts';
import { setSelfReviewEnabled } from '../src/lib/chatEstimator/selfReview.ts';
import fs from 'node:fs';

setSelfReviewEnabled(false);
setLLMReaderForTests(null);

let seedState = Number(process.argv[3] ?? 1) || 1;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const chance = (p: number) => rnd() < p;

interface Persona {
  kind: string; opener: string; scope: string; sqft: number; beds: number; baths: number; stories: string; rooms: string; surfaces: string;
  ceilings: boolean; trim: boolean; doors: boolean; closets: boolean; cabinets: boolean; condition: string; owner: string; color: string; zip: string; when: string;
  siding: string; business: boolean; apartment: boolean; roomOnly: boolean; yes: number;
}

function makePersona(): Persona {
  const kind = pick(['whole_interior', 'whole_interior', 'rooms', 'single_room', 'exterior', 'exterior', 'both', 'moveout', 'office', 'cabinets', 'apartment']);
  const beds = pick([1, 2, 3, 3, 4, 4, 5]);
  const baths = Math.min(beds, pick([1, 2, 2, 3]));
  const sqft = pick([650, 900, 1200, 1500, 1800, 2000, 2400, 2800, 3500]);
  const zip = pick(['92101', '90210', '94103', '60614', '10001', '30301', '78701', '98101', '85001', '92008']);
  const p: Persona = {
    kind, opener: '', scope: 'inside', sqft, beds, baths, stories: pick(['one story', 'two stories', 'one level', '2 stories']),
    rooms: pick(['living room and kitchen', 'the bedrooms and hallway', 'kitchen, dining room and the main bathroom', 'all of it']),
    surfaces: pick(['just the walls', 'walls and ceilings', 'walls, ceilings and trim', 'everything', 'walls and baseboards']),
    ceilings: chance(0.4), trim: chance(0.5), doors: chance(0.3), closets: chance(0.3), cabinets: chance(0.15),
    condition: pick(['its in good shape', 'some nail holes and a few scuffs', 'a couple cracks and some peeling', 'pretty rough, lots of holes']),
    owner: pick(['we own it, its our home', 'its our house, we live here', 'im renting', 'its a rental property i own']),
    color: pick(['same color', 'going to a new color, light gray', 'changing it, white to beige', 'not sure yet']), zip,
    when: pick(['next month', 'as soon as possible', 'in about two weeks', 'no rush, sometime this spring']),
    siding: pick(['stucco', 'wood siding', 'vinyl siding', 'brick', 'stucco']), business: false, apartment: false, roomOnly: false, yes: 0.5,
  };
  switch (kind) {
    case 'whole_interior': p.opener = pick([`I want the whole inside of my house painted, ${beds} bed ${baths} bath`, `need the interior of our house repainted, about ${sqft} sq ft`, `painting the inside of my ${beds} bedroom house`]); break;
    case 'rooms': p.opener = pick(['I need my living room and kitchen painted', 'looking to paint a couple of rooms', 'need the hallway and two bedrooms done']); p.rooms = 'living room and kitchen'; break;
    case 'single_room': p.opener = pick(['I need to repaint my bedroom', "need my daughter's room painted", 'can you paint one room for me?']); p.roomOnly = true; break;
    case 'exterior': p.scope = 'outside'; p.opener = pick(['I want to get the outside of my house painted', 'exterior paint job for a two story house', 'need my house exterior repainted']); break;
    case 'both': p.scope = 'both'; p.opener = pick(['I want to paint the inside and outside of my house', 'need the whole house done, inside and out']); break;
    case 'moveout': p.opener = pick(["I'm moving out of my apartment and need it painted to get my deposit back", 'need to touch up my rental before I move out']); p.apartment = true; p.owner = 'im the tenant, its a rental'; p.surfaces = 'just touch up the walls'; break;
    case 'office': p.business = true; p.opener = pick(['I own a small office and want the interior painted', 'we need our shop repainted', 'painting a retail store, about 2500 sq ft']); p.owner = 'we lease the space'; p.surfaces = 'just the walls'; break;
    case 'cabinets': p.opener = pick(['I want my kitchen cabinets painted', 'looking to refinish our cabinets']); p.cabinets = true; break;
    case 'apartment': p.apartment = true; p.opener = pick(['need my condo painted inside', 'painting my apartment, 2 bedrooms']); p.sqft = pick([650, 900, 1100]); break;
  }
  p.yes = pick([0.3, 0.5, 0.7]);
  return p;
}

const SIDE_QUESTIONS: { text: string; answered: RegExp; tag: string }[] = [
  { text: 'how much does something like this usually cost?', answered: /\$|ballpark|typically|range|usually|around|price/i, tag: 'cost' },
  { text: 'do you provide the paint or do I buy it?', answered: /paint.*(included|provide|supply|painter)|painters? (bring|supply|provide|buy)|included/i, tag: 'paint supply' },
  { text: 'how long would it take?', answered: /\bdays?\b|\bweeks?\b|\bhours?\b|a day|couple of days/i, tag: 'duration' },
  { text: 'are your painters licensed and insured?', answered: /licensed|insured|insurance/i, tag: 'license' },
  { text: 'do I need to move the furniture?', answered: /furniture/i, tag: 'furniture' },
  { text: 'is there a warranty on the work?', answered: /warrant|guarantee/i, tag: 'warranty' },
];
const WEATHER = ['the weather has been so nice lately', 'how is your day going?', 'my dog keeps barking at the painters from last time'];

function answer(bot: string, p: Persona): string {
  const b = bot.toLowerCase();
  const yn = () => (chance(p.yes) ? pick(['yes', 'yes please', 'yeah']) : pick(['no', 'nope', 'no thanks']));
  if (/\binside\b/.test(b) && /\boutside\b/.test(b) && /\?/.test(b)) return p.scope === 'both' ? 'both' : p.scope;
  if (/zip/.test(b)) return p.zip;
  if (/photo|picture/.test(b)) return pick(['no', 'not right now']);
  if (/anything else|anything more|else i should know|run it|ready/.test(b)) return pick(['no thats it', 'nope', 'no, thats all']);
  if (/how many (stories|floors)|one level|two stories|one-story|1-story|single story|stories is/.test(b)) return p.stories;
  if (/live here|rental|renting|own it|owner/.test(b)) return p.owner;
  if (/which surfaces|what gets painted|walls, ceilings|surfaces are we/.test(b)) return p.surfaces;
  if (/sound right|assuming|something different/.test(b)) return pick(['yes sounds right', 'yeah', 'that sounds right']);
  if (/which rooms|what rooms|which room/.test(b)) return p.rooms;
  if (/bathrooms?/.test(b) && /how many/.test(b)) return String(p.baths);
  if (/bedrooms?/.test(b) && /how many/.test(b)) return String(p.beds);
  if (/how big|rough size|dimensions|small, medium|how large/.test(b)) return p.roomOnly ? 'about 12 by 14' : `about ${p.sqft} square feet`;
  if (/square feet|sq ft|size of the (place|house|home)/.test(b)) return `about ${p.sqft} square feet`;
  if (/ceilings standard height|standard ceiling|ceiling height/.test(b)) return pick(['standard', 'standard 8 feet', 'about 9 feet']);
  if (/ceilings/.test(b) && /\?/.test(b) && !/height/.test(b)) return p.ceilings ? 'yes' : 'no';
  if (/baseboards/.test(b) && /\?/.test(b) && !/already|finish|painted before/.test(b)) return p.trim ? 'yes' : 'no';
  if (/doors/.test(b) && /(want|like|include|add|and the doors|also)/.test(b) && !/how many|finish|painted before/.test(b)) return p.doors ? 'yes' : 'no';
  if (/closets/.test(b) && !/how many|shelves/.test(b)) return p.closets ? 'yes' : 'no';
  if (/cabinets/.test(b) && /(want|include|part of)/.test(b)) return p.cabinets ? 'yes' : 'no';
  if (/already painted|painted before|bare wood|stained|primed|finished with/.test(b)) return pick(['they are painted already', 'painted white', 'painted']);
  if (/how many/.test(b)) return pick(['about 8', '3', '10', 'two', 'around 12']);
  if (/shape|condition|how are the walls|prep|holes|cracks|peeling|repairs/.test(b)) return p.condition;
  if (/color/.test(b)) return p.color;
  if (/brand|grade|premium|mid-grade|finish in mind|sheen|painter choose|painter pick/.test(b)) return pick(['painters choice', 'up to the painter', 'standard is fine', 'whatever you recommend']);
  if (/timeline|when would|start|how soon|living there|anyone be|after hours|occupied|move out/.test(b)) return `${p.when}${p.business ? ', after hours is better' : ', nobody is home during the day'}`;
  if (/siding|stucco|what is the house made|exterior material/.test(b)) return p.siding;
  if (/gutters/.test(b)) return pick(['yes the gutters too', 'no leave the gutters']);
  if (/windows/.test(b) && /what|kind|made of/.test(b)) return pick(['vinyl', 'wood', 'aluminum']);
  if (/front door|garage/.test(b) && /\?/.test(b)) return yn();
  if (/ or /.test(b) && /\?/.test(b)) return pick(['the first one', 'standard', 'not sure', 'the second']);
  if (/\?/.test(b)) return yn();
  return 'ok';
}

interface Flag { sev: 'high' | 'med' | 'low'; code: string; detail: string }
const results: { persona: Persona; log: string[]; flags: Flag[]; turns: number; done: boolean }[] = [];

const PAINT_Q = /paint brand|brand you prefer|brand in mind|mid-grade|premium|finish in mind|particular finish|painter free to choose|should the painter/i;
const N = Number(process.argv[2] ?? 100) || 100;
for (let n = 0; n < N; n++) {
  const p = makePersona();
  let s = makeInitialState();
  const log: string[] = [`## #${n + 1} ${p.kind} - ${p.opener}`];
  const flags: Flag[] = [];
  const asked: string[] = [];
  let user = p.opener;
  let done = false;
  let turns = 0;
  const pendingSide: { tag: string; answered: RegExp }[] = [];
  const botMsgs: string[] = [];
  for (; turns < 70; turns++) {
    let sent = user;
    if (turns > 0 && chance(0.12)) { const q = pick(SIDE_QUESTIONS); sent = q.text; pendingSide.push({ tag: q.tag, answered: q.answered }); }
    else if (turns > 0 && chance(0.06)) sent = pick(WEATHER);
    else if (turns > 0 && chance(0.07)) sent = pick(['not sure', "i don't know", 'hmm whatever you think']);
    const before = s.history.length;
    const r = await handleUserMessage(s, sent);
    s = r.state;
    const reply = s.history.slice(before + 1).map((m) => m.text).join(' || ');
    log.push(`ME : ${sent}`, `BOT: ${reply}`);
    botMsgs.push(reply);
    const side = pendingSide.shift();
    if (side && !side.answered.test(reply)) flags.push({ sev: 'high', code: 'ignored-customer-question:' + side.tag, detail: `${sent} => ${reply.slice(0, 140)}` });
    if (/\b1 (rooms|doors|windows|closets|bedrooms|bathrooms)\b/i.test(reply)) flags.push({ sev: 'med', code: 'plural-bug', detail: reply.slice(0, 140) });
    if (/didn.t catch/i.test(reply)) flags.push({ sev: 'med', code: 'didnt-catch', detail: `${sent} => ${reply.slice(0, 140)}` });
    const parts = reply.split(' || ');
    if (parts.filter((x) => /\?\s*$/.test(x.trim())).length > 1 || (parts[parts.length - 1].match(/\?/g) ?? []).length > 1) flags.push({ sev: 'med', code: 'two-questions', detail: reply.slice(0, 160) });
    const last = parts[parts.length - 1];
    if (asked.includes(last) && last.endsWith('?')) flags.push({ sev: 'low', code: 'repeat-question', detail: last.slice(0, 120) });
    asked.push(last);
    if (/no worries — just tell me what you do know/i.test(reply)) flags.push({ sev: 'low', code: 'canned-unsure', detail: `${sent} => ${reply.slice(0, 120)}` });
    if (/\d{4}-\d{2}-\d{2}/.test(reply)) flags.push({ sev: 'low', code: 'iso-date', detail: reply.slice(0, 120) });
    if (r.done) { done = true; break; }
    user = answer(last, p);
  }
  if (!done) flags.push({ sev: 'high', code: 'never-finished', detail: `${turns} turns` });
  const firstPaint = botMsgs.findIndex((m) => PAINT_Q.test(m));
  const firstScope = botMsgs.findIndex((m) => /square feet|how big|size|which surfaces|rooms|stories/i.test(m));
  if (firstPaint >= 0 && (firstScope < 0 || firstPaint < firstScope) && p.kind !== 'cabinets') flags.push({ sev: 'high', code: 'paint-before-scope', detail: `paint question at bot message ${firstPaint + 1}, size/scope at ${firstScope + 1}` });
  let paintRun = 0;
  let maxPaintRun = 0;
  for (const m of botMsgs) { if (PAINT_Q.test(m.split(' || ').slice(-1)[0])) { paintRun++; maxPaintRun = Math.max(maxPaintRun, paintRun); } else paintRun = 0; }
  if (maxPaintRun >= 2) flags.push({ sev: 'med', code: 'paint-questions-in-a-row', detail: `${maxPaintRun} in a row` });
  if ((p.apartment || p.roomOnly) && botMsgs.some((m) => /one level|two stories|how many stories/i.test(m))) flags.push({ sev: 'low', code: 'stories-for-apartment-or-room', detail: p.kind });
  if (p.business && botMsgs.some((m) => /do you live here|your home, or a rental|living here/i.test(m))) flags.push({ sev: 'med', code: 'home-question-for-business', detail: p.kind });
  if (p.kind === 'moveout' && botMsgs.some((m) => /fresh ceilings|finishing touch|frame the new wall/i.test(m))) flags.push({ sev: 'low', code: 'upsell-to-tenant', detail: p.kind });
  if (botMsgs.some((m) => /estimate the size from the bedroom/i.test(m)) && log.some((l) => /\d{3,4} (sq|square)/i.test(l))) flags.push({ sev: 'med', code: 'ignored-given-sqft', detail: '' });
  results.push({ persona: p, log, flags, turns: turns + 1, done });
}

const byCode = new Map<string, { n: number; sev: string; ex: string[] }>();
for (const r of results) for (const f of r.flags) {
  const e = byCode.get(f.code) ?? { n: 0, sev: f.sev, ex: [] };
  e.n++;
  if (e.ex.length < 3) e.ex.push(f.detail);
  byCode.set(f.code, e);
}
const rows = [...byCode.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`${results.length} conversations, ${results.filter((r) => r.done).length} finished, avg ${(results.reduce((t, r) => t + r.turns, 0) / results.length).toFixed(1)} turns`);
for (const [code, e] of rows) console.log(`\n[${e.sev}] ${code}: ${e.n}\n   e.g. ${e.ex.map((x) => x.replace(/\n/g, ' ')).join('\n        ')}`);
fs.mkdirSync('_sim', { recursive: true });
fs.writeFileSync('_sim/sim_transcripts.txt', results.map((r) => r.log.join('\n') + '\nFLAGS: ' + r.flags.map((f) => f.code).join(', ')).join('\n\n'));
