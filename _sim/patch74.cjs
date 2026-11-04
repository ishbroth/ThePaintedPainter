const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/pages/QuoteResults.tsx', [
  ["          resumeState={{ ctx, estimate, assumptions, transcript: state.transcript, loyaltyDiscountPercent: state.loyaltyDiscountPercent }}", "          conversation={state.userMessages ?? state.transcript.split('\\n').filter(Boolean)}\n          resumeState={{ ctx, estimate, assumptions, transcript: state.transcript, userMessages: state.userMessages, loyaltyDiscountPercent: state.loyaltyDiscountPercent }}"],
  ["          qa: buildResponseSummary(ctx),", "          qa: buildResponseSummary(ctx),\n          conversation,"],
]);
{
  const f = 'src/pages/QuoteResults.tsx';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  const a = t.indexOf('const ClaimPriceModal = ({');
  const props = t.indexOf('  resumeState,\n', a);
  if (a < 0 || props < 0) throw new Error('props');
  t = t.slice(0, props) + '  conversation,\n  resumeState,\n' + t.slice(props + '  resumeState,\n'.length);
  const typ = t.indexOf('  resumeState: unknown;\n', a);
  if (typ < 0) throw new Error('type');
  t = t.slice(0, typ) + '  conversation: string[];\n  resumeState: unknown;\n' + t.slice(typ + '  resumeState: unknown;\n'.length);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
console.log('ok');
