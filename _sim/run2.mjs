import fs from 'node:fs';
import { buildScenarios2, openerText, benchFor } from './scenarios2.mjs';
import { answerFor } from './scenarios.mjs';

const mode = process.argv[2] || 'rules';
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const outFile = process.argv[4] || `_sim/results/b2_${mode}.json`;
const { makeInitialState, handleUserMessage, getRegionalMultiplier } = await import(`./out/${mode}.mjs`);

const scenarios = buildScenarios2().filter((s) => (only ? only.includes(s.n) : true));
const RUN_IT = /run it|price it out|anything else I should know/i;
const results = [];
let rng = 777;
const rand = () => ((rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296);
const calls = [];
async function throttle() {
  if (mode !== 'llm') return;
  for (;;) {
    const now = Date.now();
    while (calls.length && now - calls[0] > 610000) calls.shift();
    if (calls.length < 34) { calls.push(now); return; }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

for (const sc of scenarios) {
  let s = makeInitialState();
  const arch = sc.arch;
  const slots = { zip: sc.zip, when: sc.when, occ: sc.occ };
  const log = [];
  const openText = openerText(arch, sc.style, sc.zip, sc.when);
  let user = openText, done = null, turns = 0;
  const asked = {}, firstAnswer = {}, firstReg = {};
  const loopEvents = [];
  let pendingTopic = null, lastReg = null, loops = 0, genericFallbacks = 0, correctionSent = false, revealed = false;
  const reveals = sc.style.name === 'vague-then-detailed' || sc.style.name === 'mixed-detail';
  const fair = sc.style.open === 'all' || sc.style.open === 'ramble' || reveals;
  while (turns < 32) {
    turns++;
    log.push({ role: 'user', text: user });
    if (pendingTopic && !(pendingTopic in firstAnswer)) { firstAnswer[pendingTopic] = user; firstReg[pendingTopic] = lastReg; }
    let r;
    try { await throttle(); r = await handleUserMessage(s, user); } catch (e) { log.push({ role: 'ERROR', text: String(e.stack || e).slice(0, 300) }); break; }
    s = r.state;
    const bot = s.history.at(-1).text;
    log.push({ role: 'bot', text: bot, topic: s.lastBotTopic?.id || null });
    if (r.done) { done = r.done; break; }
    const wrapUp = RUN_IT.test(bot);
    const tid = s.lastBotTopic?.id || null;
    if (tid && !wrapUp) {
      asked[tid] = (asked[tid] || 0) + 1;
      if (asked[tid] === 2) { loops++; loopEvents.push({ topic: tid, userSaid: firstAnswer[tid] ?? null, reg: firstReg[tid] ?? null }); }
    }
    if (/circling back/i.test(bot)) genericFallbacks++;
    if (RUN_IT.test(bot)) {
      if (reveals && !revealed) {
        revealed = true;
        user = 'Oh, and to be complete: ' + openerText(arch, { open: 'all' }, sc.zip, sc.when);
        pendingTopic = null;
        continue;
      }
      if (sc.fix && !correctionSent) {
        correctionSent = true;
        if (sc.fix.type === 'zip') user = `Oh wait, one correction: the zip code is actually ${sc.zip2}.`;
        else if (sc.fix.type === 'sqft' && arch.sqft) user = `Actually it's closer to ${Math.round((arch.sqft * 1.3) / 50) * 50} square feet.`;
        else if (sc.fix.type === 'timing') user = 'Actually, change my timing to December 7 through December 11.';
        else { user = 'run it'; correctionSent = true; }
        pendingTopic = null;
        continue;
      }
      user = 'run it'; pendingTopic = null; continue;
    }
    const reg = sc.style.reg === 'mix' ? Math.floor(rand() * 3) : sc.style.reg;
    lastReg = reg; pendingTopic = tid;
    user = tid ? answerFor(arch, tid, reg, slots) : 'run it';
  }

  const c = (done?.ctx) || s.ctx;
  const misses = [];
  for (const f of arch.check) misses.push(...f(c));
  const e = sc.when.exp;
  if (e.startDate && c.startDate !== e.startDate && !(sc.fix?.type === 'timing')) misses.push(`startDate=${c.startDate || '(none)'} expected ${e.startDate}`);
  if (e.endDate && c.endDate !== e.endDate && !(sc.fix?.type === 'timing')) misses.push(`endDate=${c.endDate || '(none)'} expected ${e.endDate}`);
  if (e.datesFlexible && !c.datesFlexible) misses.push('datesFlexible not logged');
  if (e.timeline && c.timeline !== e.timeline && !(sc.fix?.type === 'timing')) misses.push(`timeline=${c.timeline || '(none)'} expected ${e.timeline}`);
  if (e.anyTiming && !(c.timeline || c.startDate || c.datesFlexible)) misses.push('timing not logged');
  if (correctionSent && sc.fix) {
    if (sc.fix.type === 'zip' && c.zipCode !== sc.zip2) misses.push(`CORRECTION IGNORED: zip stayed ${c.zipCode} (customer corrected to ${sc.zip2})`);
    if (sc.fix.type === 'sqft' && arch.sqft && c.squareFeet === arch.sqft) misses.push(`CORRECTION IGNORED: square feet stayed ${c.squareFeet} (customer corrected to ~${Math.round((arch.sqft * 1.3) / 50) * 50})`);
    if (sc.fix.type === 'timing' && c.startDate !== '2026-12-07') misses.push(`CORRECTION IGNORED: start date is ${c.startDate || '(none)'} (customer corrected to 2026-12-07)`);
  }

  // the zip the estimator should have used
  const effectiveZip = sc.fix?.type === 'zip' && correctionSent ? sc.zip2 : sc.zip;
  const m = getRegionalMultiplier(c.zipCode || effectiveZip);
  const [lo, typ, hi] = benchFor(arch, m.multiplier);
  const est = done?.estimate;
  const marketEq = est ? est.total / 0.9 : null; // the engine prices 10% under market
  const flag = !est ? 'NONE' : !fair ? 'unfair'  : marketEq < lo * 0.8 ? 'LOW' : marketEq > hi * 1.2 ? 'HIGH' : 'ok';
  results.push({
    fair, n: sc.n, arch: arch.id, archName: arch.name, style: sc.style.name, zip: sc.zip, zipLabel: sc.zipLabel, market: m.market, mult: m.multiplier,
    when: sc.when.text, fix: sc.fix?.type ?? null, turns, loops, loopEvents, genericFallbacks, completed: !!done,
    total: est?.total ?? null, marketEq: marketEq ? Math.round(marketEq) : null, bench: [Math.round(lo), Math.round(typ), Math.round(hi)], flag,
    ratioToTyp: marketEq ? Math.round((marketEq / typ) * 100) / 100 : null,
    misses, log,
    lineItems: est ? est.lineItems.map((l) => `${l.description}:${Math.round(l.amount)}`) : [],
    multipliers: est ? est.multipliers.map((x) => `${x.label}x${x.factor}`) : [],
    ctx: { projectType: c.projectType, squareFeet: c.squareFeet, scope: c.interiorScope, rooms: c.selectedRooms, timeline: c.timeline, startDate: c.startDate, endDate: c.endDate, datesFlexible: c.datesFlexible, propertyType: c.propertyType, occupancy: c.occupancy, exteriorBody: c.exteriorBody, stories: c.stories, zip: c.zipCode },
  });
  process.stdout.write(`${sc.n}${done ? '' : '!'} `);
}
fs.mkdirSync('_sim/results', { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
console.log(`\nwrote ${results.length} results (${results.filter((r) => r.completed).length} completed)`);
