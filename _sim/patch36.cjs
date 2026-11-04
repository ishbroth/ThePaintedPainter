const fs = require('fs');
const f = 'src/pages/QuoteResults.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(from, to) {
  if (!t.includes(from)) throw new Error('nf: ' + from.slice(0, 80));
  t = t.replace(from, () => to);
}
rep("  const [edits, setEdits] = useState<{ rooms: string[]; items: string[] }>({\n    rooms: state?.ctx.excludedRooms ?? [],\n    items: state?.ctx.excludedItems ?? [],\n  });",
    "  const [edits, setEdits] = useState<{ rooms: string[]; items: string[]; fields: Partial<EstimatorContext> }>({\n    rooms: state?.ctx.excludedRooms ?? [],\n    items: state?.ctx.excludedItems ?? [],\n    fields: {},\n  });");
rep("buildPriceEditor(editBase, edits.rooms, edits.items) : null), [editBase, edits]);", "buildPriceEditor(editBase, edits.rooms, edits.items, edits.fields) : null), [editBase, edits]);");
rep("  const edited = edits.rooms.length > 0 || edits.items.length > 0;", "  const edited = edits.rooms.length > 0 || edits.items.length > 0 || Object.keys(edits.fields).length > 0;");
rep("          onReset={() => setEdits({ rooms: [], items: [] })}", "          onSetField={(field, value) => { setEdits((e) => ({ ...e, fields: { ...e.fields, [field]: value } as Partial<EstimatorContext> })); }}\n          onReset={() => setEdits({ rooms: [], items: [], fields: {} })}");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
