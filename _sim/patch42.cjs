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
patch('src/lib/chatEstimator/extractors.ts', [
  ["    const negated = (word: string) => new RegExp('\\\\b' + NEG + word + '\\\\b').test(low);",
   "    const negated = (word: string) =>\n      new RegExp('\\\\b' + NEG + word + '\\\\b').test(low) ||\n      new RegExp('\\\\b(?:leave|skip|keep|ignore)\\\\s+(?:the\\\\s+|our\\\\s+)?' + word + '\\\\b').test(low) ||\n      new RegExp('\\\\b' + word + '\\\\s+(?:can\\\\s+)?(?:stay|stays|remain|as[\\\\s-]is|untouched|skipped|are\\\\s+fine|is\\\\s+fine|not\\\\s+included)\\\\b').test(low);"],
  ["        if (pw) surf.ceilings = 'yes';\n        if (pd) surf.doors = 'yes';\n        if (ptr) surf.trim = 'yes';",
   "        if (pw && !negatedPartial('ceilings?')) surf.ceilings = 'yes';\n        if (pd && !negatedPartial('doors?')) surf.doors = 'yes';\n        if (ptr && !negatedPartial('(?:trim|baseboards?|casings?)')) surf.trim = 'yes';\n        if (pw && negatedPartial('ceilings?')) surf.ceilings = 'no';\n        if (pd && negatedPartial('doors?')) surf.doors = 'no';"],
  ["    if (partialMode) {\n      const pw =",
   "    const negatedPartial = (word: string) =>\n      new RegExp('\\\\b(?:no|not|without|skip|except|leave|keep)\\\\s+(?:the\\\\s+|any\\\\s+|our\\\\s+)?' + word + '\\\\b').test(low) ||\n      new RegExp('\\\\b' + word + '\\\\s+(?:can\\\\s+)?(?:stay|stays|remain|as[\\\\s-]is|untouched|skipped|are\\\\s+fine|is\\\\s+fine|not\\\\s+included)\\\\b').test(low);\n    if (partialMode) {\n      const pw ="],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  // A reply that matched nothing and doesn't answer the question: ask what they meant",
   "  // A partial scope answer (\"no trim\") leaves the ceilings and doors open: ask about those now, once, instead of assuming.\n  if (\n    s.lastBotTopic?.id === 'surfaces' &&\n    !s.lastBotTopic.alreadyAnswered(ctxNext) &&\n    !(s.clarifiedIds ?? []).includes('surfaces') &&\n    (ctxNext.interiorTrim === 'no' || ctxNext.interiorCeilings === 'no' || ctxNext.interiorDoors === 'none')\n  ) {\n    s = {\n      ...s,\n      clarifiedIds: [...(s.clarifiedIds ?? []), 'surfaces'],\n      history: [...s.history, botMessage(s.lastBotTopic.ask(ctxNext))],\n    };\n    return { state: s, done: null };\n  }\n\n  // A reply that matched nothing and doesn't answer the question: ask what they meant"],
]);
console.log('ok');
