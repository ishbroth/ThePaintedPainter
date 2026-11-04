const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf("  // The \"anything else?\" at the end of an outside job");
const b = t.indexOf("  // Answers to the exterior questions (ext_*)");
if (a < 0 || b < 0) throw new Error('nf');
const BS = String.fromCharCode(92);
const w = (s) => s.split('@').join(BS);
const block = w(`  // The "anything else?" at the end of an outside job (fences, overhangs, chimneys, decks, shutters): on an outside job these words
  // mean the outside ones, even without saying "exterior".
  if (state.wrapupAsked && (state.ctx.projectType === 'exterior' || state.ctx.projectType === 'both')) {
    const low = trimmed.toLowerCase();
    const negated = (word: string) => new RegExp('@b(?:no|without|skip|not)@s+(?:the@s+)?' + word + '@b').test(low);
    if (/@bshutters?@b/.test(low) && !negated('shutters?')) {
      ctxWithExplicit.exteriorShutters = 'yes';
      if (state.ctx.projectType === 'exterior') ctxWithExplicit.interiorShutters = state.ctx.interiorShutters;
    }
    if (/@b(?:overhangs?|patio covers?|porch ceilings?|pergolas?)@b/.test(low) && !negated('overhangs?')) ctxWithExplicit.overhangs = 'yes';
    if (/@bchimneys?@b/.test(low) && !negated('chimneys?') && !ctxWithExplicit.additionalDetails.toLowerCase().includes('chimney')) {
      ctxWithExplicit.additionalDetails = ` + "`${ctxWithExplicit.additionalDetails ? ctxWithExplicit.additionalDetails + '; ' : ''}chimney to paint`" + `;
    }
  }

`);
t = t.slice(0, a) + block + t.slice(b);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
