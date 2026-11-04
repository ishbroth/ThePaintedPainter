const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "  // Answers to the exterior questions (ext_*): yes adds the thing";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => `  // The "anything else?" at the end of an outside job (fences, overhangs, chimneys, decks, shutters): on an outside job these words
  // mean the outside ones, even without saying "exterior".
  if (state.wrapupAsked && (state.ctx.projectType === 'exterior' || state.ctx.projectType === 'both')) {
    const low = trimmed.toLowerCase();
    if (/\bshutters?\b/.test(low) && !/\b(?:no|without|skip|not)\s+(?:the\s+)?shutters?\b/.test(low)) {
      ctxWithExplicit.exteriorShutters = 'yes';
      if (state.ctx.projectType === 'exterior') ctxWithExplicit.interiorShutters = state.ctx.interiorShutters;
    }
    if (/\b(?:overhangs?|patio covers?|porch ceilings?|pergolas?)\b/.test(low) && !/\b(?:no|without|skip|not)\s+(?:the\s+)?overhangs?\b/.test(low)) ctxWithExplicit.overhangs = 'yes';
    if (/\bchimneys?\b/.test(low) && !/\b(?:no|without|skip|not)\s+(?:the\s+)?chimneys?\b/.test(low) && !ctxWithExplicit.additionalDetails.toLowerCase().includes('chimney')) {
      ctxWithExplicit.additionalDetails = \`\${ctxWithExplicit.additionalDetails ? ctxWithExplicit.additionalDetails + '; ' : ''}chimney to paint\`;
    }
  }

` + a);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
