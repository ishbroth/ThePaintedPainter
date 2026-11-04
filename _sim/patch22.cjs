const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  // Surface scope limiters\n  const surf = extractSurfaceScope(text);";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, "  // Surface scope limiters. Skipped when the reply is answering a different question: \"just regular trim\" to the trim\n  // question means baseboards, not \"paint only the trim\".\n  const scopeBlockedBy = ['trim_scope', 'condition', 'property_ownership', 'color_change', 'location', 'timeline_and_access', 'commercial_access', 'siding', 'stories', 'house_size', 'room_size', 'reno_context', 'popcorn_extent'];\n  const surf = lastBotTopicId && scopeBlockedBy.includes(lastBotTopicId) ? ({} as ReturnType<typeof extractSurfaceScope>) : extractSurfaceScope(text);");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
