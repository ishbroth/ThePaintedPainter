const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/types.ts', [
  ["  excludedSurfaces?: string[];", "  excludedSurfaces?: string[];\n  /** Surfaces the customer said yes to when the estimator suggested them (they stay in even though the transcript also says \"just walls\"). */\n  addedSurfaces?: string[];"],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  // record yes answers
  ["      if (yes && !no) {\n        target[asked.field] = asked.on;\n        if (asked.field === 'interiorTrim') ctxWithExplicit.trimScopeAddressed = true;\n      } else if (no) {",
   "      if (yes && !no) {\n        target[asked.field] = asked.on;\n        added.add(asked.key);\n        if (asked.field === 'interiorTrim') ctxWithExplicit.trimScopeAddressed = true;\n      } else if (no) {"],
  ["        if (o.word.test(low) && !ruledOut.has(o.key)) {\n          (ctxWithExplicit as unknown as Record<string, unknown>)[o.field] = o.on;\n", "        if (o.word.test(low) && !ruledOut.has(o.key)) {\n          (ctxWithExplicit as unknown as Record<string, unknown>)[o.field] = o.on;\n          added.add(o.key);\n"],
  ["    const ruledOut = new Set(state.ctx.excludedSurfaces ?? []);\n", "    const ruledOut = new Set(state.ctx.excludedSurfaces ?? []);\n    const added = new Set(state.ctx.addedSurfaces ?? []);\n"],
  ["    if (ruledOut.size > 0) ctxWithExplicit.excludedSurfaces = [...ruledOut];\n", "    if (ruledOut.size > 0) ctxWithExplicit.excludedSurfaces = [...ruledOut];\n    for (const key of ruledOut) added.delete(key);\n    if (added.size > 0) ctxWithExplicit.addedSurfaces = [...added];\n"],
  // re-apply after the transcript is re-read
  ["  // Photo-request triggers — a bare keyword match", `  // Surfaces added at the estimator's suggestion stay in, even though the transcript also says "just walls".
  for (const key of ctxNext.addedSurfaces ?? []) {
    if (key === 'ceilings') ctxNext.interiorCeilings = 'yes';
    else if (key === 'trim') {
      ctxNext.interiorTrim = 'yes';
      ctxNext.trimScopeAddressed = true;
    } else if (key === 'doors') ctxNext.interiorDoors = 'some';
  }

  // Photo-request triggers — a bare keyword match`],
]);
console.log('ok');
