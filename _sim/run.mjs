import fs from 'node:fs';
import { buildScenarios, answerFor } from './scenarios.mjs';

const mode = process.argv[2] || 'rules'; // rules | llm
const limit = Number(process.argv[3] || 0);
const only = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
const { makeInitialState, handleUserMessage, getRegionalMultiplier } = await import(`./out/${mode}.mjs`);

const scenarios = buildScenarios().filter((s) => (only ? only.includes(s.n) : true)).slice(0, limit || 9999);
const RUN_IT = /run it|price it out/i;
const results = [];
const calls = [];
// The live extractor allows 40 calls / 10 min per IP; stay under it so every call really reaches the AI.
async function throttle() { if (mode !== 'llm') return; for (;;) { const now = Date.now(); while (calls.length && now - calls[0] > 610000) calls.shift(); if (calls.length < 34) { calls.push(now); return; } await new Promise((r) => setTimeout(r, 5000)); } }
let rng = 12345;
const rand = () => ((rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296);

for (const sc of scenarios) {
  let s = makeInitialState();
  const arch = sc.arch;
  const slots = { zip: sc.zip, when: sc.when, occ: sc.occ };
  const log = [];
  const openText = arch.open[sc.style.open].replace('{zip}', sc.zip).replace('{when}', sc.when.text);
  let user = openText, done = null, turns = 0;
  const asked = {}; const firstAnswer = {}; const firstReg = {}; const loopEvents = []; const restated = []; let lastReg = null; let pendingTopic = null; let loops = 0, genericFallbacks = 0, ranIt = false;
  const stated = { property_ownership: /\b(i live|we live|live here|lived-in|my home|my condo|rental|landlord|tenant|own it|i own)\b/i.test(openText), color_change: /same (white |\w+ )?color|new color|going (from|to)|navy|white to|to a? ?(dark|deep|light)/i.test(openText), condition: /good shape|good condition|nail holes|cracks|stain|peeling|mildew|mold/i.test(openText), house_size: /\d[\d,]*\s*(sq|square)/i.test(openText), location: /\b\d{5}\b/.test(openText), occupancy: /vacant|empty|furnished|occupied|lived-in|we live|i live|closed/i.test(openText), timing: true };
  const t0 = Date.now();
  while (turns < 30) {
    turns++;
    log.push({ role: 'user', text: user });
    if (pendingTopic && !(pendingTopic in firstAnswer)) { firstAnswer[pendingTopic] = user; firstReg[pendingTopic] = lastReg; }
    let r;
    try { await throttle(); r = await handleUserMessage(s, user); } catch (e) { log.push({ role: 'ERROR', text: String(e.stack || e).slice(0, 300) }); break; }
    s = r.state;
    const bot = s.history.at(-1).text;
    log.push({ role: 'bot', text: bot, topic: s.lastBotTopic?.id || null });
    if (r.done) { done = r.done; break; }
    const tid = s.lastBotTopic?.id || null;
    if (tid && !(RUN_IT.test(bot) || /anything else I should know/i.test(bot))) { asked[tid] = (asked[tid] || 0) + 1; if (asked[tid] === 2) { loops++; loopEvents.push({ topic: tid, userSaid: firstAnswer[tid] ?? null, reg: firstReg[tid] ?? null }); } if (asked[tid] === 1 && stated[tid] && tid !== 'timeline_and_access') restated.push(tid); if (asked[tid] === 1 && tid === 'timeline_and_access' && stated.occupancy && stated.timing) restated.push('timeline_and_access(both already given)'); }
    if (/circling back/i.test(bot)) genericFallbacks++;
    if (RUN_IT.test(bot) || /anything else I should know/i.test(bot)) { user = 'run it'; ranIt = true; continue; }
    const reg = sc.style.reg === 'mix' ? Math.floor(rand() * 3) : sc.style.reg;
    lastReg = reg; pendingTopic = tid; user = tid ? answerFor(arch, tid, reg, slots) : 'run it';
  }
  const c = (done?.ctx) || s.ctx;
  const misses = [];
  for (const f of arch.check) misses.push(...f(c));
  const e = sc.when.exp;
  if (e.startDate && c.startDate !== e.startDate) misses.push(`startDate=${c.startDate || '(none)'} expected ${e.startDate}`);
  if (e.endDate && c.endDate !== e.endDate) misses.push(`endDate=${c.endDate || '(none)'} expected ${e.endDate}`);
  if (e.datesFlexible && !c.datesFlexible) misses.push('datesFlexible not logged');
  if (e.timeline && c.timeline !== e.timeline) misses.push(`timeline=${c.timeline || '(none)'} expected ${e.timeline}`);
  if (e.anyTiming && !(c.timeline || c.startDate || c.datesFlexible)) misses.push('timing not logged');
  const m = getRegionalMultiplier(sc.zip);
  const est = done?.estimate;
  results.push({
    n: sc.n, arch: arch.id, archName: arch.name, style: sc.style.name, zip: sc.zip, zipLabel: sc.zipLabel, market: m.market, mult: m.multiplier,
    when: sc.when.text, turns, loops, loopEvents, restated, genericFallbacks, completed: !!done, ranIt,
    total: est?.total ?? null, low: est?.lowRange ?? null, high: est?.highRange ?? null, confidence: est?.confidence ?? null,
    bench: arch.bench, misses, log,
    ctx: { projectType: c.projectType, squareFeet: c.squareFeet, rooms: c.selectedRooms, timeline: c.timeline, startDate: c.startDate, endDate: c.endDate, datesFlexible: c.datesFlexible, propertyType: c.propertyType, occupancy: c.occupancy, sidingType: c.sidingType, stories: c.stories },
    ms: Date.now() - t0,
  });
  process.stdout.write(`${sc.n}${done ? '' : '!'} `);
}
fs.mkdirSync('_sim/results', { recursive: true });
fs.writeFileSync(`_sim/results/${mode}${process.env.TAG||''}.json`, JSON.stringify(results, null, 1));
console.log(`\nwrote ${results.length} results (${results.filter((r) => r.completed).length} completed)`);
