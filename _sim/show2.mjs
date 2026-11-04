import fs from 'node:fs';
const R = JSON.parse(fs.readFileSync(process.argv[2]));
for (const n of process.argv.slice(3).map(Number)) {
  const r = R.find(x => x.n === n);
  console.log(`\n=== #${r.n} ${r.archName} | ${r.style} | ${r.zip} ${r.market} x${r.mult} | when: ${r.when} | fix:${r.fix} | total $${r.total} (marketEq ${r.marketEq}, bench ${r.bench}) ${r.flag}`);
  console.log('ctx', JSON.stringify(r.ctx)); console.log('lines', r.lineItems.join(' | ')); console.log('mult', r.multipliers.join(' ')); console.log('misses', r.misses);
  r.log.forEach(l => console.log(l.role === 'user' ? '  U: ' + l.text : '  B: ' + l.text.slice(0, 260).replace(/\n/g, ' ') + (l.topic ? `  <${l.topic}>` : '')));
}
