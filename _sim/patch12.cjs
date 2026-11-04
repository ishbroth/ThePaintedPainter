const fs = require('fs');
const f = 'src/pages/QuoteResults.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf('      {breakdownOpen && (');
const b = t.indexOf('      {/* Real painter list */}');
if (a < 0 || b < 0) throw new Error('markers');
const repl = `      {breakdownOpen && view && (
        <PriceBreakdown
          view={view}
          assumptions={assumptions}
          canEdit={!!editBase}
          edited={edited}
          disabled={expired}
          onToggleItem={(key) => { hapticMedium(); setEdits((e) => ({ ...e, items: e.items.includes(key) ? e.items.filter((k) => k !== key) : [...e.items, key] })); }}
          onToggleRoom={(key) => { hapticMedium(); setEdits((e) => ({ ...e, rooms: e.rooms.includes(key) ? e.rooms.filter((k) => k !== key) : [...e.rooms, key] })); }}
          onReset={() => setEdits({ rooms: [], items: [] })}
        />
      )}

`;
t = t.slice(0, a) + repl + t.slice(b);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
