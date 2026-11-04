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
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  // \"renting\" could mean a tenant or a landlord, and the price differs.\n  if (state.lastBotTopic?.id === 'property_ownership' && isAmbiguousRenting(trimmed)) {\n    return asBot({}, 'Just so I price it right: do you rent this place from someone (you are the tenant), or are you renting it out to tenants (you own it)?');\n  }\n\n", ""],
  ["import { isDenial, denialIsAboutScope, isAmbiguousRenting, topicLabel,", "import { isDenial, denialIsAboutScope, topicLabel,"],
]);
patch('src/lib/chatEstimator/clarify.ts', [
  ["/** \"renting\" alone could be a tenant or a landlord. */\nexport function isAmbiguousRenting(text: string): boolean {\n  return /^\s*(?:i'?m\s+|we'?re\s+|we\s+|i\s+)?rent(?:ing)?(?:\s+(?:it|here|this|this\s+place|the\s+place))?\s*[.!]?\s*$/i.test(text);\n}\n\n", ""],
]);
patch('src/lib/chatEstimator/extractors.ts', [
  ["  if (lastBotTopicId === 'property_ownership' && !prev.propertyType && !patch.propertyType) {\n    const low = text.toLowerCase();",
   "  if (lastBotTopicId === 'property_ownership' && !prev.propertyType && !patch.propertyType) {\n    const low = text.toLowerCase();\n    // \"renting\" / \"rental\" with no more detail: a customer who lives there would say so, so this is a landlord's rental unit\n    if (/\b(rent|renting|rental|rented|landlord|tenants?)\b/.test(low) && !/\b(live|living)\b/.test(low)) {\n      patch.propertyType = 'rental';\n      acks.push('rental property');\n    }"],
]);
console.log('ok');
