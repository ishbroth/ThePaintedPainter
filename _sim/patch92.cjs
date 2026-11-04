const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/types.ts', [
  ["  zipCode: string;\n  state: string;", "  zipCode: string;\n  /** The city that ZIP belongs to (looked up when the ZIP is given), repeated back to the customer. */\n  zipCity?: string;\n  state: string;"],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  // Photo-request triggers — a bare keyword match", `  // A ZIP code that was just given (or changed): look up its city and say it back ("ZIP 91941, La Mesa").
  if (ctxNext.zipCode && (ctxNext.zipCode !== state.ctx.zipCode || !ctxNext.zipCity)) {
    const city = await lookupZipCity(ctxNext.zipCode);
    ctxNext.zipCity = city;
    if (city && ctxNext.zipCode !== state.ctx.zipCode) {
      const zip = ctxNext.zipCode;
      const at = acknowledgements.findIndex((a) => a.includes(zip));
      if (at >= 0) acknowledgements[at] = \`\${acknowledgements[at]}, \${city}\`;
      else acknowledgements.push(\`ZIP \${zip}, \${city}\`);
    }
  } else if (!ctxNext.zipCode) {
    ctxNext.zipCity = '';
  }

  // Photo-request triggers — a bare keyword match`],
  ["import { reviewLocally,", "import { lookupZipCity } from '../zipLookup';\nimport { reviewLocally,"],
]);
console.log('ok');
