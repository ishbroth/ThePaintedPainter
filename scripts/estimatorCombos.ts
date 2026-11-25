// Mixed-job conversations: 2 to 4 different things in one request ("a door, a chair and the soffit on one side of my house", "my living room
// and the stair railings, which just need a refresher"), each said the way a customer says it, with the treatment (new color, same color,
// one-coat refresher, touch-up) mixed in. Plays them through the real engine with a customer who answers what is asked, then checks that
// every named thing is priced, nothing that wasn't named is, the questions asked make sense for the job, and the treatment is reflected.
//
//   npm run sim:combos            (200 conversations)     npm run sim:combos -- 400 5      (count, seed)
import { handleUserMessage, makeInitialState } from '../src/lib/chatEstimator/chatEngine.ts';
import { setLLMReaderForTests } from '../src/lib/chatEstimator/llmClient.ts';
import { setSelfReviewEnabled } from '../src/lib/chatEstimator/selfReview.ts';
import fs from 'node:fs';

setSelfReviewEnabled(false);
setLLMReaderForTests(null);

let seedState = Number(process.argv[3] ?? 1) || 1;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

type Tier = 'full' | 'one_coat' | 'touch_up' | 'plain';
interface Atom {
  id: string;
  group: 'room' | 'item' | 'exterior' | 'stairs' | 'door';
  /** how a customer says it, per treatment */
  say: Partial<Record<Tier, string[]>>;
  /** price line keys or description patterns that must exist in the final price */
  expect: { key?: string; desc?: RegExp };
  treatable: Tier[];
}

const ATOMS: Atom[] = [
  { id: 'living_room', group: 'room', expect: { key: 'walls' }, treatable: ['full', 'one_coat', 'touch_up'], say: {
    full: ['my living room going to a new color', 'the living room, we are changing the color'], one_coat: ['my living room in the same color', 'the living room, keeping the same color'],
    touch_up: ['some touch ups in the living room', 'a little touch up in the living room'], plain: ['my living room'] } },
  { id: 'bedroom', group: 'room', expect: { key: 'walls' }, treatable: ['full', 'one_coat', 'touch_up'], say: {
    full: ['one bedroom repainted a different color', 'the bedroom, going gray'], one_coat: ['one bedroom, same color as now', 'the bedroom in the same color'],
    touch_up: ['touch up the scuffs in one bedroom', 'some touch ups in the bedroom'], plain: ['one bedroom'] } },
  { id: 'hallway', group: 'room', expect: { key: 'walls' }, treatable: ['one_coat', 'touch_up'], say: {
    one_coat: ['the hallway, same color', 'the hallway just needs a refresh in the same color'], touch_up: ['touch ups in the hallway', 'a few touch ups in the hallway'], plain: ['the hallway'] } },
  { id: 'stair_rail', group: 'stairs', expect: { key: 'stairs' }, treatable: ['one_coat', 'touch_up'], say: {
    one_coat: ['the stair railings, which only need a refresher', 'the stair railings just need a quick refresh'], touch_up: ['a touch up on the stair railings'], plain: ['the stair railings'] } },
  { id: 'interior_door', group: 'door', expect: { key: 'doors' }, treatable: [], say: { plain: ['one interior door', 'a door', 'a couple of interior doors'] } },
  { id: 'chair', group: 'item', expect: { key: 'furniture' }, treatable: [], say: { plain: ['a chair', 'one wooden chair', 'a dining chair'] } },
  { id: 'dresser', group: 'item', expect: { key: 'furniture' }, treatable: [], say: { plain: ['a dresser', 'an old dresser'] } },
  { id: 'soffit', group: 'exterior', expect: { desc: /soffit|fascia|eave|trim/i }, treatable: ['one_coat'], say: {
    plain: ['the soffit on just one side of my house', 'the soffits on one side of the house'], one_coat: ['the soffit on one side of the house, which only needs a refresher'] } },
  { id: 'front_door', group: 'exterior', expect: { key: 'entry_door' }, treatable: [], say: { plain: ['the front door', 'my front door'] } },
  { id: 'garage_door', group: 'exterior', expect: { key: 'garage_door' }, treatable: [], say: { plain: ['the garage door', 'a single garage door'] } },
  { id: 'fence', group: 'exterior', expect: { key: 'fence' }, treatable: [], say: { plain: ['a section of fence, about 40 feet', 'about 30 feet of fence'] } },
  { id: 'ext_trim', group: 'exterior', expect: { key: 'ext_trim' }, treatable: ['one_coat'], say: { plain: ['the exterior trim'], one_coat: ['the exterior trim, which just needs a refresher'] } },
];

interface Scenario { atoms: { atom: Atom; tier: Tier }[]; opener: string }

function makeScenario(): Scenario {
  const n = pick([2, 2, 3, 3, 4]);
  const chosen: { atom: Atom; tier: Tier }[] = [];
  const pool = [...ATOMS];
  while (chosen.length < n && pool.length) {
    const atom = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    // a touch-up-only job is a different conversation: at most one touch-up, and only next to real work
    const tiers: Tier[] = ['plain', ...atom.treatable];
    chosen.push({ atom, tier: pick(tiers) });
  }
  // at least one thing is real work (not a touch-up)
  if (chosen.every((c) => c.tier === 'touch_up')) chosen[0].tier = 'plain';
  const phrases = chosen.map((c) => pick(c.atom.say[c.tier] ?? c.atom.say.plain ?? ['it']));
  const joined = phrases.length === 2 ? phrases.join(' and ') : `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
  const opener = pick([`I need ${joined} painted`, `I'd like a quote for ${joined}`, `looking to get ${joined} done`, `can you paint ${joined}?`]);
  return { atoms: chosen, opener };
}

const hasGroup = (s: Scenario, g: Atom['group']) => s.atoms.some((a) => a.atom.group === g);

function answer(bot: string, s: Scenario): string {
  const b = bot.toLowerCase();
  const yn = () => pick(['yes', 'no']);
  if (/\binside\b/.test(b) && /\boutside\b/.test(b) && /\?/.test(b)) return hasGroup(s, 'exterior') && (hasGroup(s, 'room') || hasGroup(s, 'door') || hasGroup(s, 'stairs')) ? 'both' : hasGroup(s, 'exterior') ? 'outside' : 'inside';
  if (/zip/.test(b)) return '92101';
  if (/photo|picture/.test(b)) return 'no';
  if (/anything else|else i should know|run it|ready/.test(b)) return 'no thats it';
  if (/live here|rental|own it|owner/.test(b)) return 'its our home';
  if (/how many/.test(b)) return pick(['1', 'just one', '2']);
  if (/fence/.test(b) && /how (long|many feet)|feet/.test(b) && !/tall/.test(b)) return '40 feet';
  if (/tall|height/.test(b) && !/ceiling/.test(b)) return 'about 6 feet';
  if (/how (big|large)|dimensions|rough size|size/.test(b)) return 'about 12 by 14';
  if (/square feet|sq ft|how long|feet/.test(b)) return pick(['about 1800 square feet', '40 feet']);
  if (/same color|matching|new color|color/.test(b)) return 'same color';
  if (/brand|preference on the paint|paint in mind|finish/.test(b)) return 'painters choice';
  if (/timeline|when would|start|anyone be|occupied/.test(b)) return 'next month, nobody is home during the day';
  if (/painted now|already painted|stained|bare|finished with|current finish|what.*on (it|them) now/.test(b)) return 'painted';
  if (/wood|metal|steel|iron|vinyl|stucco|material|made of|veneer|laminate/.test(b)) return hasGroup(s, 'exterior') && /siding|house|walls themselves|outside/.test(b) ? 'stucco' : 'solid wood';
  if (/ or /.test(b) && /\?/.test(b)) return pick(['the first one', 'standard', 'wood']);
  if (/\?/.test(b)) return yn();
  return 'ok';
}

interface Flag { sev: 'high' | 'med' | 'low'; code: string; detail: string }
const N = Number(process.argv[2] ?? 200) || 200;
const results: { scenario: Scenario; log: string[]; flags: Flag[]; done: boolean; total: number }[] = [];

const WHOLE_HOUSE_Q = /how big is the (?:place|house)|square feet is|which surfaces|assuming a living room|sound right, or is something different|ceilings standard height|is it a one-story|one level, or two|how many bedrooms|how many bathrooms|baseboards, trim and doors already painted/i;

for (let i = 0; i < N; i++) {
  const sc = makeScenario();
  let st = makeInitialState();
  const log = [`## #${i + 1} ${sc.atoms.map((a) => a.atom.id + (a.tier === 'plain' ? '' : ':' + a.tier)).join(' + ')}  --  ${sc.opener}`];
  const flags: Flag[] = [];
  let user = sc.opener;
  let done = false;
  let total = 0;
  let lines: { key?: string; description: string; amount: number }[] = [];
  const botMsgs: string[] = [];
  for (let t = 0; t < 60; t++) {
    const before = st.history.length;
    const r = await handleUserMessage(st, user);
    st = r.state;
    const reply = st.history.slice(before + 1).map((m) => m.text).join(' || ');
    log.push(`ME : ${user}`, `BOT: ${reply}`);
    botMsgs.push(reply);
    if (r.done) { done = true; total = r.done.estimate.total; lines = r.done.estimate.lineItems; break; }
    user = answer(reply.split(' || ').slice(-1)[0], sc);
  }
  if (!done) flags.push({ sev: 'high', code: 'never-finished', detail: '' });
  if (done) {
    for (const { atom } of sc.atoms) {
      const ok = lines.some((l) => (atom.expect.key && l.key === atom.expect.key) || (atom.expect.desc && atom.expect.desc.test(l.description)));
      if (!ok) flags.push({ sev: 'high', code: 'missing-from-price:' + atom.id, detail: lines.map((l) => `${l.key ?? '-'}:${l.description.slice(0, 30)}`).join(' | ').slice(0, 220) });
    }
    if (!hasGroup(sc, 'room') && lines.some((l) => l.key === 'walls')) flags.push({ sev: 'high', code: 'phantom-walls', detail: lines.find((l) => l.key === 'walls')!.description });
    if (!hasGroup(sc, 'item') && lines.some((l) => l.key === 'furniture')) flags.push({ sev: 'high', code: 'phantom-furniture', detail: '' });
    if (!hasGroup(sc, 'exterior') && lines.some((l) => l.key === 'ext_body' || l.key === 'ext_trim')) flags.push({ sev: 'high', code: 'phantom-exterior', detail: lines.filter((l) => l.key?.startsWith('ext_')).map((l) => l.description).join(', ') });
    if (total < 60 || total > 25000) flags.push({ sev: 'med', code: 'implausible-total', detail: String(Math.round(total)) });
    // treatment shown in the price
    for (const { atom, tier } of sc.atoms) {
      if (tier === 'one_coat' || tier === 'touch_up') {
        const marker = tier === 'one_coat' ? /one[- ]coat|same color|refresh/i : /touch[- ]?up/i;
        const target = lines.filter((l) => (atom.expect.key && l.key === atom.expect.key) || (atom.expect.desc && atom.expect.desc.test(l.description)));
        if (target.length && !target.some((l) => marker.test(l.description))) flags.push({ sev: 'high', code: 'treatment-not-priced:' + atom.id + ':' + tier, detail: target.map((l) => l.description).join(' | ').slice(0, 160) });
      }
    }
  }
  const asked = botMsgs.join(' || ');
  if (!hasGroup(sc, 'room') && !hasGroup(sc, 'door') && !hasGroup(sc, 'stairs') && WHOLE_HOUSE_Q.test(asked)) flags.push({ sev: 'med', code: 'whole-house-question-for-small-job', detail: (WHOLE_HOUSE_Q.exec(asked) ?? [''])[0] });
  const questions = botMsgs.filter((m) => /\?/.test(m)).length;
  if (questions > 26) flags.push({ sev: 'med', code: 'too-many-questions', detail: `${questions}` });
  const roomAtoms = sc.atoms.filter((x) => x.atom.group === 'room');
  if (roomAtoms.length > 0 && roomAtoms.every((x) => x.tier !== 'plain') && botMsgs.some((m) => /same color, or|matching the existing color|color going back|existing color, or going|keeping the current color/i.test(m))) flags.push({ sev: 'low', code: 'blanket-color-question-after-every-room-was-treated', detail: '' });
  results.push({ scenario: sc, log, flags, done, total });
}

const byCode = new Map<string, { n: number; sev: string; ex: string[] }>();
for (const r of results) for (const f of r.flags) {
  const key = f.code;
  const e = byCode.get(key) ?? { n: 0, sev: f.sev, ex: [] };
  e.n++;
  if (e.ex.length < 2) e.ex.push(f.detail);
  byCode.set(key, e);
}
console.log(`${results.length} mixed-job conversations, ${results.filter((r) => r.done).length} finished`);
for (const [code, e] of [...byCode.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`\n[${e.sev}] ${code}: ${e.n}\n   e.g. ${e.ex.join('\n        ')}`);
fs.mkdirSync('_sim', { recursive: true });
fs.writeFileSync('_sim/combo_transcripts.txt', results.map((r) => r.log.join('\n') + `\nTOTAL: ${Math.round(r.total)}  FLAGS: ${r.flags.map((f) => f.code).join(', ')}`).join('\n\n'));
