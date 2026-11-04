import fs from 'node:fs';
const mode = process.argv[2] || 'rules';
const R = JSON.parse(fs.readFileSync(`_sim/results/${mode}.json`));
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
console.log('scenarios', R.length, 'completed', R.filter(r=>r.completed).length, 'avg turns', avg(R.map(r=>r.turns)).toFixed(1), 'max', Math.max(...R.map(r=>r.turns)));
console.log('with loops (topic re-asked)', R.filter(r=>r.loops).length, ' with "circling back"', R.filter(r=>r.genericFallbacks).length, ' with any miss', R.filter(r=>r.misses.length).length);
const missCount = {};
R.forEach(r => r.misses.forEach(m => { const k = m.replace(/=.*$/, '').replace(/expected.*/, ''); missCount[k] = (missCount[k]||0)+1; }));
console.log('\nMISS TYPES', Object.entries(missCount).sort((a,b)=>b[1]-a[1]));
// pricing vs bench (regional-scaled: bench*mult, estimator targets ~10% below market)
console.log('\nPRICING (total vs regional-scaled benchmark)');
const rows = R.map(r => { const lo = r.bench[0]*r.mult*0.9, hi = r.bench[1]*r.mult; return { ...r, lo, hi, flag: r.total==null?'NONE': r.total < lo*0.8 ? 'LOW' : r.total > hi*1.15 ? 'HIGH' : 'ok' }; });
const byFlag = {}; rows.forEach(r => byFlag[r.flag]=(byFlag[r.flag]||0)+1); console.log(byFlag);
const byArch = {};
rows.forEach(r => { (byArch[r.arch] ||= []).push(r); });
for (const [a, rs] of Object.entries(byArch)) {
  console.log(a.padEnd(13), rs.map(r => `$${r.total}[${r.flag}]@${r.mult}`).join('  '), ' bench', rs[0].bench.join('-'));
}
fs.writeFileSync(`_sim/results/${mode}-rows.json`, JSON.stringify(rows.map(({log,...x})=>x)));
