const fs = require('fs');
function load(f) {
  const t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 70)));
  o.t = o.t.replace(a, () => b);
}

// ---- textToSpeech
{
  const o = load('src/lib/textToSpeech.ts');
  rep(o, "import { splitPrompt } from './promptHints';", "import { splitPrompt } from './promptHints';\nimport { neuralVoiceAvailable, speakNeural, stopNeural, unlockNeuralAudio, isNeuralBusy, prefetchNeural } from './neuralVoice';");
  // speak -> speakWeb, with a new speak in front
  rep(o, "export function speak(text: string): Promise<void> {\n  if (!isTTSSupported()) return Promise.resolve();\n  const synth = window.speechSynthesis;",
    `export function speak(text: string): Promise<void> {
  lastSpeakAt = Date.now();
  // Phones and tablets get the natural server voice when it is set up (their built-in voices sound robotic); otherwise the built-in one.
  if (isPhoneLike() && neuralVoiceAvailable()) {
    if (isTTSSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
    const myRun = ++speakRun;
    const spoken = naturalizeForSpeech(splitPrompt(text).spoken.replace(/\\.{3,}|\\u2026/g, '. '));
    void speakNeural(spoken).then((played) => {
      if (!played && myRun === speakRun) speakWeb(text); // not set up or not reachable: the phone's own voice
    });
    return Promise.resolve();
  }
  speakWeb(text);
  return Promise.resolve();
}

/** Phones and tablets (a touch screen as the main pointer). */
function isPhoneLike(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

/** When the last speak() was called: speech takes a moment to begin, and that moment still counts as "speaking". */
let lastSpeakAt = 0;

/** Starts getting the audio for this text ready (phones with the server voice), so it plays the instant it is needed. */
export function prefetchSpeech(text: string): void {
  if (isPhoneLike() && neuralVoiceAvailable()) {
    void prefetchNeural(naturalizeForSpeech(splitPrompt(text).spoken.replace(/\\.{3,}|\\u2026/g, '. ')));
  }
}

/** Resolves when nothing is being spoken any more (or after maxMs, so a stuck voice can never hold the page back). */
export async function waitForSpeechEnd(maxMs = 120000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    await new Promise((r) => window.setTimeout(r, 250));
    const web = isTTSSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    const startingUp = Date.now() - lastSpeakAt < 1500;
    if (!web && !isNeuralBusy() && !startingUp) return;
  }
}

function speakWeb(text: string): void {
  if (!isTTSSupported()) return;
  const synth = window.speechSynthesis;`);
  rep(o, "  else speakPart(0);\n  return Promise.resolve();\n}", "  else speakPart(0);\n}");
  // the old tail had these two branches calling speakPart(0) with a return; make sure the cancel-delay version still reads right
  save('src/lib/textToSpeech.ts', o);
}
console.log('ok');
