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

patch('src/lib/types.ts', [
  ["  // Contact\n  contactName: string;", "  // \"Work with again\": a painter the customer used before, shown first in the results with their own price.\n  preferredPainterId: string;\n  preferredPainterName: string;\n  /** The ZIP came from the customer's previous job, not from this chat: a different ZIP typed later replaces it. */\n  zipFromHistory: boolean;\n\n  // Contact\n  contactName: string;"],
]);
patch('src/lib/chatEstimator/defaultContext.ts', [
  ["    contactName: '', contactPhone: '',", "    preferredPainterId: '', preferredPainterName: '', zipFromHistory: false,\n    contactName: '', contactPhone: '',"],
]);
patch('src/lib/chatEstimator/responseSummary.ts', [
  ["  'zipCode', // shown separately, at the top of the email", "  'zipCode', // shown separately, at the top of the email\n  'preferredPainterId',\n  'preferredPainterName',\n  'zipFromHistory',"],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["export function makeInitialState(): ChatState {",
   `/**
 * "Work with again": a fresh conversation for a painter the customer has used before. Their ZIP from that job is known from
 * the start (so the location question is skipped and the right group of painters is searched), and the chosen painter is
 * remembered so they come first in the results, priced for that painter.
 */
export function makeWorkWithAgainState(painter: { id: string; companyName: string; zip: string }): ChatState {
  const state = makeInitialState();
  const ctx: EstimatorContext = {
    ...state.ctx,
    zipCode: /^\\d{5}$/.test(painter.zip) ? painter.zip : '',
    state: /^\\d{5}$/.test(painter.zip) ? getStateFromZip(painter.zip) : '',
    zipFromHistory: /^\\d{5}$/.test(painter.zip),
    preferredPainterId: painter.id,
    preferredPainterName: painter.companyName,
  };
  const where = ctx.zipCode ? \` I'll use ZIP \${ctx.zipCode} from your last job with them (tell me if this one is somewhere else).\` : '';
  return {
    ...state,
    ctx,
    history: [
      {
        role: 'bot',
        text: \`Welcome back! You're working with \${painter.companyName} again.\${where} What do you need painted?\`,
        timestamp: Date.now(),
      },
    ],
  };
}

export function makeInitialState(): ChatState {`],
  ["  // Corrections (\"actually the zip is 98101\"",
   "  // A ZIP carried over from the customer's last job gives way to a different one typed now (a different property).\n  if (state.ctx.zipFromHistory) {\n    const typedZip = extractZip(trimmed);\n    if (typedZip && typedZip !== state.ctx.zipCode) {\n      ctxWithExplicit.zipCode = typedZip;\n      const st = getStateFromZip(typedZip);\n      if (st) ctxWithExplicit.state = st;\n      acknowledgements.push(`ZIP ${typedZip}`);\n    }\n    ctxWithExplicit.zipFromHistory = false;\n  }\n\n  // Corrections (\"actually the zip is 98101\""],
]);
console.log('ok');
