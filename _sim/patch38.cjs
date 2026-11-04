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

// ---- types + defaults: the ceiling can change color differently from the walls
patch('src/lib/types.ts', [
  ["  interiorColorChange: string; // same, different, dramatic\n", "  interiorColorChange: string; // same, different, dramatic\n  /** The ceiling's own color change when it differs from the walls (\"walls same color, ceiling dark to light\"). */\n  ceilingColorChange: string; // '' (follows the walls), same, different, dramatic\n"],
]);
patch('src/lib/chatEstimator/defaultContext.ts', [
  ["    interiorColorChange: '',\n", "    interiorColorChange: '', ceilingColorChange: '',\n"],
]);

// ---- engine: price the ceiling's color change
patch('src/lib/estimateEngine.ts', [
  ["        description: 'Ceilings',\n        amount: ceilingSqFt * ceilingRate * regionalMult * volEff,\n        key: 'ceilings',\n      });",
   "        description: 'Ceilings',\n        amount: ceilingSqFt * ceilingRate * regionalMult * volEff,\n        key: 'ceilings',\n      });\n      // A ceiling going to a new color (or dark to light) needs an extra coat even when the walls stay the same color.\n      if (ctx.ceilingColorChange === 'different' || ctx.ceilingColorChange === 'dramatic') {\n        lineItems.push({\n          category: 'Interior',\n          description: ctx.ceilingColorChange === 'dramatic' ? 'Ceiling Color Change (dark to light, extra coats)' : 'Ceiling Color Change (extra coat)',\n          amount: ceilingSqFt * ceilingRate * (ctx.ceilingColorChange === 'dramatic' ? 0.5 : 0.3) * regionalMult * volEff,\n        });\n      }"],
]);

// ---- topics: only an explicit decision counts, and a partial answer ("no trim") asks about the rest
patch('src/lib/chatEstimator/topics.ts', [
  ["      c.surfacesAddressed ||\n      c.interiorWalls === 'no' ||\n      c.interiorCeilings === 'no' ||\n      c.interiorTrim === 'no' ||\n      c.interiorDoors === 'none' ||\n      c.additionalDetails.toLowerCase().includes('walls only') ||",
   "      c.surfacesAddressed ||\n      c.interiorWalls === 'no' ||\n      c.additionalDetails.toLowerCase().includes('walls only') ||"],
  ["    ask: (c) => {\n      const singular = c.selectedRooms.length === 1;\n      const hasKitchen = c.selectedRooms.includes('kitchen');",
   "    ask: (c) => {\n      // Part of the answer is known (\"no trim\"): ask about the rest instead of assuming walls only.\n      if (c.interiorTrim === 'no' && c.interiorCeilings !== 'no' && c.interiorDoors !== 'none') {\n        return \"No trim, got it. What about the ceilings and the doors — are those getting painted, or staying as they are?\";\n      }\n      if (c.interiorCeilings === 'no' && c.interiorTrim !== 'no') {\n        return \"No ceilings, got it. And the trim and doors — painted too, or staying as they are?\";\n      }\n      const singular = c.selectedRooms.length === 1;\n      const hasKitchen = c.selectedRooms.includes('kitchen');"],
]);

// ---- rules extractor: partial negations stay partial
patch('src/lib/chatEstimator/extractors.ts', [
  ["  if ((lastBotTopicId === 'surfaces' || onlySurfaceWords) && !surf.everything) {\n    const low = text.toLowerCase();",
   "  let listParsed = false;\n  if ((lastBotTopicId === 'surfaces' || onlySurfaceWords) && !surf.everything) {\n    const low = text.toLowerCase();\n    // earlier the customer already ruled something out (\"no trim\"): this reply only adds to that, it doesn't restate the whole scope\n    const partialMode = lastBotTopicId === 'surfaces' && !prev.surfacesAddressed && (prev.interiorTrim === 'no' || prev.interiorCeilings === 'no' || prev.interiorDoors === 'none');\n    if (partialMode) {\n      const pw = /\\bceilings?\\b/.test(low), pd = /\\bdoors?\\b/.test(low), ptr = /\\b(trim|baseboards?|casings?)\\b/.test(low);\n      const refusal = /^\\s*(?:no|nope|nah|neither|none|skip (?:them|those|it)|leave (?:them|it|those)|as[\\s-]is|not needed|just the walls|walls only)\\b/.test(low);\n      if (refusal) {\n        surf.ceilings = 'no'; surf.doors = 'no'; surf.trim = 'no';\n      } else {\n        if (pw) surf.ceilings = 'yes';\n        if (pd) surf.doors = 'yes';\n        if (ptr) surf.trim = 'yes';\n        if (/\\b(both|all|everything|yes|yeah|yep|sure)\\b/.test(low) && !pw && !pd) { surf.ceilings = 'yes'; surf.doors = 'yes'; }\n        if (/\\bno\\s+(?:the\\s+)?ceilings?\\b|\\bwithout\\s+(?:the\\s+)?ceilings?\\b/.test(low)) surf.ceilings = 'no';\n        if (/\\bno\\s+(?:the\\s+)?doors?\\b|\\bwithout\\s+(?:the\\s+)?doors?\\b/.test(low)) surf.doors = 'no';\n      }\n      listParsed = true;\n    } else {"],
  ["    } else if (w || c || tr || d) {\n      surf.walls = w ? 'yes' : 'no';\n      surf.ceilings = c ? 'yes' : 'no';\n      surf.trim = tr ? 'yes' : 'no';\n      surf.doors = d ? 'yes' : 'no';\n    }\n  }",
   "    } else if (w || c || tr || d) {\n      surf.walls = w ? 'yes' : 'no';\n      surf.ceilings = c ? 'yes' : 'no';\n      surf.trim = tr ? 'yes' : 'no';\n      surf.doors = d ? 'yes' : 'no';\n      listParsed = true;\n    }\n    }\n  }"],
  ["  if (\n    surf.walls !== undefined || surf.ceilings !== undefined || surf.trim !== undefined ||\n    surf.doors !== undefined || surf.everything\n  ) {\n    patch.surfacesAddressed = true;\n  } else if (!prev.surfacesAddressed) {",
   "  const decidedWalls = surf.walls !== undefined || surf.everything;\n  const partialOnly = !listParsed && !decidedWalls && (surf.ceilings !== undefined || surf.trim !== undefined || surf.doors !== undefined);\n  if (listParsed || decidedWalls || (surf.ceilings !== undefined && surf.trim !== undefined)) {\n    patch.surfacesAddressed = true;\n  } else if (partialOnly) {\n    // \"no trim\" alone doesn't say what happens to the ceilings and doors, so the surfaces question stays open\n  } else if (!prev.surfacesAddressed) {"],
]);
console.log('ok');
