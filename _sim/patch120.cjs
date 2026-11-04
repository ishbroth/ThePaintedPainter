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

// ---------- speech: start speaking inside the tap (phones only allow sound that starts from a real touch)
{
  const f = 'src/lib/textToSpeech.ts';
  const o = load(f);
  const a = o.t.indexOf("/** Cancels whatever is currently speaking (if anything) and speaks new text. */");
  const b = o.t.indexOf("/** Bumped every time speech starts or stops");
  if (a < 0 || b < 0) throw new Error('speak block');
  o.t = o.t.slice(0, a) + `/** Starts loading and choosing the voice ahead of time, so the first spoken words can start inside a tap. */
export function prepareVoice(): void {
  if (!isTTSSupported()) return;
  void getPreferredVoice();
}

/**
 * Cancels whatever is currently speaking (if anything) and speaks new text.
 *
 * It starts speaking right away, in the same moment it is called. Phones (iPhone especially) only play speech that starts from a
 * real touch; waiting for the voice list first (an await) made the greeting silent when it came from a tap. The voice is chosen
 * ahead of time (prepareVoice) so it is normally already known here.
 */
export function speak(text: string): Promise<void> {
  if (!isTTSSupported()) return Promise.resolve();
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  synth.resume?.(); // a phone can leave the engine paused
  const myRun = ++speakRun;
  if (selectedVoice === undefined) prepareVoice();
  // "Hello, citizen...": a "..." is a real pause, so each side is spoken separately with a beat between.
  const parts = splitPrompt(text).spoken.split(/\\.{3,}|\\u2026/).map((p) => p.trim()).filter(Boolean);
  const speakPart = (index: number) => {
    if (myRun !== speakRun || index >= parts.length) return;
    const voice = selectedVoice ?? null;
    const utterance = new SpeechSynthesisUtterance(naturalizeForSpeech(parts[index]));
    // A hair slower than the 1.0 default reads as noticeably less rushed/
    // robotic without dragging.
    utterance.rate = 0.9975; // 5% faster than the previous 0.95
    utterance.pitch = 1;
    utterance.lang = voice?.lang || 'en-US'; // never the phone's other-language default
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (index + 1 < parts.length) window.setTimeout(() => speakPart(index + 1), ELLIPSIS_PAUSE_MS);
    };
    synth.speak(utterance);
  };
  speakPart(0);
  return Promise.resolve();
}

` + o.t.slice(b);
  // the voice is prepared as soon as the page has a first touch (and on load for browsers that allow it)
  rep(o, "  const handler = () => unlockSpeechSynthesis();", "  prepareVoice();\n  const handler = () => {\n    prepareVoice();\n    unlockSpeechSynthesis();\n  };");
  save(f, o);
}

// ---------- panel: a phone's greeting starts from the tap, not from scrolling
{
  const f = 'src/components/ChatEstimator/ChatPanel.tsx';
  const o = load(f);
  rep(o, "    const el = sectionRef.current;\n    if (!el || !ttsSupported) return;\n    // IntersectionObserver always reports", "    const el = sectionRef.current;\n    if (!el || !ttsSupported) return;\n    // Phones only play speech that starts from a tap, so scrolling does not start it there (the tap on the typing bubble does).\n    // If the scroll trigger spoke into silence it would also use up the one automatic greeting before the tap could play it.\n    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;\n    // IntersectionObserver always reports");
  save(f, o);
}
console.log('ok');
