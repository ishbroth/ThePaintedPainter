const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
const a = "    const typedZip = extractZip(trimmed);\n    if (typedZip && typedZip !== state.ctx.zipCode) {\n      ctxWithExplicit.zipCode = typedZip;\n      const st = getStateFromZip(typedZip);\n      if (st) ctxWithExplicit.state = st;\n      acknowledgements.push(`ZIP ${typedZip}`);\n    }\n    ctxWithExplicit.zipFromHistory = false;\n";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "    // only when it reads as a ZIP (\"zip 90210\", \"it's in 90210\", or just the number), not a square-footage figure\n    const typedZip = /\b(zip|postal|located|it'?s in|property is in|moving|different)\b|^\s*\d{5}\s*$/i.test(trimmed) ? extractZip(trimmed) : null;\n    if (typedZip) {\n      if (typedZip !== state.ctx.zipCode) {\n        ctxWithExplicit.zipCode = typedZip;\n        const st = getStateFromZip(typedZip);\n        if (st) ctxWithExplicit.state = st;\n        acknowledgements.push(`ZIP ${typedZip}`);\n      }\n      ctxWithExplicit.zipFromHistory = false;\n    }\n");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
