const fs = require('fs');
const f = 'src/lib/textToSpeech.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b, label) {
  if (!t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 70)));
  t = t.replace(a, () => b);
}

// ---- male voices: the compact Apple male voices count as male (Eddy, Reed, Rocko), after Aaron/Evan/Nathan/Tom; Android's male voice codes
{
  const a = t.indexOf("  const NOVELTY = ");
  const e = t.indexOf("\n", a);
  t = t.slice(0, a) + "  const NOVELTY = /\\b(fred|ralph|junior|albert|sandy|shelley|flo|grandma|grandpa|bad news|good news|whisper|zarvox|trinoids|bubbles|bells|boing|cellos|organ|wobble|jester|superstar|bahh|kathy|princess|agnes|bruce|victoria|compact)\\b/;\n  // Apple's other American male voices (a step below Aaron, Evan, Nathan and Tom) and Android's male voice codes: still male, so they beat any female default\n  const MALE_FALLBACK = /\\b(eddy|reed|rocko)\\b|en-us-x-(?:iol|iom|tpd)\\b/;" + t.slice(e);
}
rep("    return baseScore(v, name) + (MALE.test(name) ? 200 : 0) + iosPreferred", "    return baseScore(v, name) + (MALE.test(name) ? 200 : MALE_FALLBACK.test(name) ? 120 : 0) + iosPreferred");

// ---- the silent "unlock" utterance must not make the greeting cancel itself
rep("  const utterance = new SpeechSynthesisUtterance(' ');\n  utterance.volume = 0;\n  window.speechSynthesis.speak(utterance);\n}", "  const utterance = new SpeechSynthesisUtterance(' ');\n  utterance.volume = 0;\n  unlockInFlight = true;\n  utterance.onend = utterance.onerror = () => {\n    unlockInFlight = false;\n  };\n  window.speechSynthesis.speak(utterance);\n}\n\n/** True while the silent unlock sound is still playing (a greeting that starts in the same tap queues behind it instead of cancelling it). */\nlet unlockInFlight = false;");

// ---- speak: choose the voice right now if the phone already knows its voices; never cancel the unlock; give a cancel a moment to settle
rep("  const synth = window.speechSynthesis;\n  if (synth.speaking || synth.pending) synth.cancel();\n  synth.resume?.(); // a phone can leave the engine paused\n  const myRun = ++speakRun;\n  if (selectedVoice === undefined) prepareVoice();",
    "  const synth = window.speechSynthesis;\n  // choose the voice now, from what the phone already knows (the list is often there even before the async lookup finishes)\n  if (!selectedVoice) {\n    const known = synth.getVoices();\n    if (known.length > 0) selectedVoice = pickBestVoice(known) ?? selectedVoice;\n    if (!selectedVoice) prepareVoice();\n  }\n  // cancelling something that is playing makes some phones drop whatever is spoken right after, so that start waits a moment\n  const mustCancel = (synth.speaking || synth.pending) && !unlockInFlight;\n  if (mustCancel) synth.cancel();\n  synth.resume?.(); // a phone can leave the engine paused\n  const myRun = ++speakRun;");
rep("  speakPart(0);\n  return Promise.resolve();", "  if (mustCancel) window.setTimeout(() => speakPart(0), 80);\n  else speakPart(0);\n  return Promise.resolve();");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
