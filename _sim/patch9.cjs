const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  matchedSituations: MatchedSituation[];\n  summary: string;\n}", "  matchedSituations: MatchedSituation[];\n  summary: string;\n  /** Kept so the price can be recalculated when the customer takes items or rooms off it. */\n  transcript?: string;\n  loyaltyDiscountPercent?: number;\n}"],
  ["    matchedSituations: matched,\n    summary: pieces.join('\n\n'),\n  };\n}", "    matchedSituations: matched,\n    summary: pieces.join('\n\n'),\n    transcript,\n    loyaltyDiscountPercent,\n  };\n}\n\n/**\n * Recalculate the price with rooms and main items taken off (or added back), using the same assumptions,\n * situations, surcharges and discounts as the original price, so the customer never has to redo the chat.\n */\nexport function repriceWithEdits(\n  base: { ctx: EstimatorContext; transcript: string; loyaltyDiscountPercent?: number },\n  excludedRooms: string[],\n  excludedItems: string[],\n): ChatResult {\n  return finalize({ ...base.ctx, excludedRooms, excludedItems }, base.transcript, base.loyaltyDiscountPercent ?? 0);\n}"],
]);
console.log('ok');
