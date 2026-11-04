const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["          transcript: state.transcript,\n        };", "          transcript: state.transcript,\n          loyaltyDiscountPercent: state.finalEstimate!.loyaltyDiscountPercent ?? 0,\n        };"],
]);
console.log('ok');
