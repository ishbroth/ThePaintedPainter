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

const SANITIZER = String.raw`  // Surfaces: a surface can only be switched OFF by a message that names it (or limits the scope: "only", "just", "walls only"),
  // and the whole scope only counts as answered when the customer actually covered it. "No trim" says nothing about the ceilings.
  {
    const low = trimmed.toLowerCase();
    const named = {
      walls: /\bwalls?\b/.test(low),
      ceilings: /\bceilings?\b/.test(low),
      trim: /\b(trim|baseboards?|casings?|molding|moulding)\b/.test(low),
      doors: /\bdoors?\b/.test(low),
    };
    const limiter = hasScopeLimiter(trimmed) || /\b(everything|all of it|the works|full package|whole (?:thing|room|house|place))\b/.test(low);
    const answeringSurfaces = state.lastBotTopic?.id === 'surfaces';
    const flips: Array<[keyof EstimatorContext, string, keyof typeof named]> = [
      ['interiorWalls', 'no', 'walls'], ['interiorCeilings', 'no', 'ceilings'], ['interiorTrim', 'no', 'trim'], ['interiorDoors', 'none', 'doors'],
    ];
    for (const [field, off, word] of flips) {
      if (ctxWithExplicit[field] === off && state.ctx[field] !== off && !named[word] && !limiter && !answeringSurfaces) {
        (ctxWithExplicit as unknown as Record<string, unknown>)[field] = state.ctx[field];
      }
    }
    if (!state.ctx.surfacesAddressed && ctxWithExplicit.surfacesAddressed && !answeringSurfaces && !limiter && !(named.walls && named.ceilings)) {
      ctxWithExplicit.surfacesAddressed = false;
    }
    // Mentioning the ceilings as something to paint puts them in scope, whatever else was assumed.
    const negatesCeiling = /\b(?:no|not|without|skip|except|excluding|leave|don'?t (?:paint|do|need))\s+(?:the\s+|any\s+|our\s+)?(?:\w+\s+)?ceilings?\b/.test(low);
    if (named.ceilings && !negatesCeiling && ctxWithExplicit.interiorCeilings === 'no' && !/\bremov|scrape|popcorn\b/.test(low)) {
      ctxWithExplicit.interiorCeilings = 'yes';
    }
  }
`;

patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  const surfaceWords = /(wall|ceiling|trim|baseboard|door|everything|whole|entire|full|all of it|the works|window|cabinet|stair|rail|molding|moulding)/i;\n  if (!state.ctx.surfacesAddressed && ctxWithExplicit.surfacesAddressed && !surfaceWords.test(trimmed) && state.lastBotTopic?.id !== 'surfaces') {\n    ctxWithExplicit.surfacesAddressed = false;\n    ctxWithExplicit.interiorWalls = state.ctx.interiorWalls;\n    ctxWithExplicit.interiorCeilings = state.ctx.interiorCeilings;\n    ctxWithExplicit.interiorTrim = state.ctx.interiorTrim;\n    ctxWithExplicit.interiorDoors = state.ctx.interiorDoors;\n  }\n", SANITIZER],
  ["import { isDenial,", "import { hasScopeLimiter } from './scopeWords';\nimport { isDenial,"],
]);

// ceiling color change read from the wording ("walls same color, ceiling dark to light")
patch('src/lib/chatEstimator/derivation.ts', [
  ["  // Porch work: the ceiling is an overhang, the floor is deck-type surface",
   String.raw`  // The ceiling can change color differently from the walls ("walls same color, ceiling dark to light")
  if (ctx.ceilingColorChange === '' && /\bceilings?\b/.test(t)) {
    const cm = t.match(/\bceilings?\b[^.;\n]{0,45}?(dark(?:er)?\s+to\s+(?:light|white)|light(?:er)?\s+to\s+dark|dramatic|black\s+to\s+white|navy\s+to\s+white)/);
    const cd = !cm && t.match(/\bceilings?\b[^.;\n]{0,40}?(different\s+colou?r|new\s+colou?r|a\s+new\s+shade|going\s+(?:to\s+)?(?:a\s+)?(?:white|black|blue|grey|gray))/);
    const cs = !cm && !cd && t.match(/\bceilings?\b[^.;\n]{0,30}?(same\s+colou?r|staying|keep)/);
    if (cm || cd || cs) {
      const wallsSame = /\bwalls?\b[^.;\n]{0,30}?(same\s+colou?r|staying|keep|no\s+change)/.test(t);
      out.push({
        patch: {
          ceilingColorChange: cm ? 'dramatic' : cd ? 'different' : 'same',
          interiorCeilings: 'yes',
          ...(wallsSame && ctx.interiorColorChange !== 'same' ? { interiorColorChange: 'same' } : {}),
        },
        reason: 'Ceiling color change read separately from the walls',
      });
    }
  }

  // Porch work: the ceiling is an overhang, the floor is deck-type surface`],
]);
console.log('ok');
