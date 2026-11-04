const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  const newTranscript = `${state.transcript}\n${trimmed}`.trim();\n  const derivations = derive(ctxWithExplicit, newTranscript);";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, `  // Timing safety net (LLM path and local fallback alike): dates, "my dates are flexible", "sometime in March" and
  // "no rush" are read with plain rules too, so a miss by the language model can't leave the question unanswered.
  const timing = extractTiming(trimmed);
  if (timing.flexible && !ctxWithExplicit.datesFlexible) ctxWithExplicit.datesFlexible = true;
  if (timing.startDate && !ctxWithExplicit.startDate) {
    ctxWithExplicit.startDate = timing.startDate;
    if (timing.endDate && !ctxWithExplicit.endDate) ctxWithExplicit.endDate = timing.endDate;
  } else if (timing.endDate && !ctxWithExplicit.endDate) {
    ctxWithExplicit.endDate = timing.endDate;
  }
  if (!ctxWithExplicit.timeline) {
    const urgency = extractTimeline(trimmed) ?? (ctxWithExplicit.startDate ? timelineFromStart(ctxWithExplicit.startDate) : null) ?? (ctxWithExplicit.datesFlexible ? 'no_rush' : null);
    if (urgency) ctxWithExplicit.timeline = urgency;
  }
  if (!ctxWithExplicit.propertyType) {
    const owner = extractPropertyType(trimmed);
    if (owner) ctxWithExplicit.propertyType = owner;
  }
  if (!ctxWithExplicit.occupancy) {
    const access = extractAccessSignals(trimmed);
    if (access.vacant) ctxWithExplicit.occupancy = 'vacant';
    else if (access.furnished || access.occupied) ctxWithExplicit.occupancy = 'furnished';
  }
  const newTranscript = \`\${state.transcript}\n\${trimmed}\`.trim();
  const derivations = derive(ctxWithExplicit, newTranscript);`);
t = t.replace("import { extractAll, extractPhotoTriggers } from './extractors';", "import { extractAll, extractPhotoTriggers, extractTimeline, extractPropertyType, extractAccessSignals } from './extractors';\nimport { extractTiming, timelineFromStart } from './dateParsing';");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
