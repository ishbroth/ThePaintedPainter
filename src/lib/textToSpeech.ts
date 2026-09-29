// Thin wrapper around the browser's built-in Web Speech API
// (window.speechSynthesis) — no backend/paid TTS service needed. Support
// varies (works in Chrome/Safari/Edge; not in some older/embedded webviews),
// so every caller must check isTTSSupported() first and degrade gracefully.
//
// Two problems with reading the chat's raw text verbatim:
//   1. Units/symbols get sounded out letter-by-letter or spoken oddly —
//      "2,000 sq ft" comes out as "sq" and "ft" as if they were words, "$45"
//      as a dollar SIGN rather than "45 dollars", "12×14" reads the × glyph
//      literally instead of "by". naturalizeForSpeech() rewrites these to
//      how a person would actually say them before handing text to the
//      synthesizer.
//   2. The "[[photo:id|label]]" markers ChatPanel renders as clickable
//      "Provide a picture of ___" links have no business being read aloud
//      at all — naturalizeForSpeech() drops them entirely rather than
//      speaking the link text, so only the surrounding sentence is heard.

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Rewrites chat text into something closer to how a person would actually say it out loud. */
export function naturalizeForSpeech(text: string): string {
  let s = text;

  // Markdown bold markers — not spoken, just emphasis in the transcript.
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');

  // "Provide a picture of ___" link markers — rendered visually by
  // ChatPanel, but not meant to be read aloud at all; drop entirely rather
  // than speaking the label, then collapse the double space this leaves
  // behind between the surrounding sentences.
  s = s.replace(/\[\[photo:[^|]+\|[^\]]+\]\]/g, '').replace(/ {2,}/g, ' ').trim();

  // Any stray middle dots (shouldn't normally happen, but a literal "·"
  // glyph read aloud is worse than a dropped one) — treat as a soft "or"
  // list separator.
  s = s.replace(/\s*·\s*/g, ', or ');

  // Dollar ranges before single amounts, so "$1,500 – $2,000" becomes
  // "1,500 to 2,000 dollars" rather than "1,500 dollars to 2,000 dollars".
  s = s.replace(/\$\s?([\d,]+)\s*[–—-]\s*\$\s?([\d,]+)/g, '$1 to $2 dollars');
  s = s.replace(/\$\s?([\d,]+)/g, '$1 dollars');

  // Units — longest/most specific patterns first so "sq ft" isn't left
  // half-converted by a bare "ft" rule running first.
  s = s
    .replace(/\blin(?:ear)?\s*\.?\s*ft\.?\b/gi, 'linear feet')
    .replace(/\bsq\.?\s*ft\.?\b/gi, 'square feet')
    .replace(/\bsqft\b/gi, 'square feet')
    .replace(/\bsf\b/gi, 'square feet')
    .replace(/(\d)\s*ft\b/gi, '$1 feet')
    .replace(/\bhoa\b/gi, 'H O A')
    .replace(/\bepa\b/gi, 'E P A');

  // "12×14" / "12x14" (room dimensions) → "12 by 14".
  s = s.replace(/(\d+)\s*[×x]\s*(\d+)/gi, '$1 by $2');

  // "%" and "+"/"/" used as compact scope shorthand ("walls + ceiling",
  // "walls/ceiling/trim") rather than math.
  s = s.replace(/(\d)\s*%/g, '$1 percent');
  s = s.replace(/(\w)\s*\+\s*(\w)/g, '$1 plus $2');
  s = s.replace(/(\w)\/(\w)/g, '$1 or $2');

  // "E.g., " read-aloud reads better as a full phrase.
  s = s.replace(/\be\.g\.,?\s*/gi, 'for example, ');

  // Em/en dash used as a clause break ("Got it —", "Noted —") — a comma
  // gives every engine a consistent brief pause; relying on the dash glyph
  // itself is inconsistent across voices/platforms.
  s = s.replace(/\s+[–—]\s+/g, ', ');

  return s;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Voice list loads asynchronously in most browsers — the first call right after page load often returns []. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices) return Promise.resolve(cachedVoices);
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        cachedVoices = window.speechSynthesis.getVoices();
        resolve(cachedVoices);
      },
      { once: true },
    );
    // Some browsers never fire voiceschanged if voices were already
    // available synchronously — fall back after a short wait either way.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
  return voicesPromise;
}

/** Ranks available voices for how natural/human they sound, best first. */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  if (english.length === 0) return null;

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    // Modern neural/cloud voices (Edge's "Online (Natural)" voices, Google's
    // WaveNet-backed voices) sound dramatically more human than the classic
    // desktop TTS engines that show up as "Microsoft David/Zira Desktop" or
    // generic "eSpeak" voices.
    if (name.includes('natural')) return 100;
    if (name.includes('online')) return 90;
    if (/\b(aria|jenny|guy|ana|davis|jane|sara)\b/.test(name)) return 85; // Edge neural voice names
    if (name.includes('google')) return 80;
    if (/\b(samantha|ava|allison|susan)\b/.test(name)) return 70; // Apple's better system voices
    if (v.lang.toLowerCase() === 'en-us') return 40;
    if (v.lang.toLowerCase().startsWith('en')) return 30;
    return 10;
  };

  return [...english].sort((a, b) => score(b) - score(a))[0];
}

let selectedVoice: SpeechSynthesisVoice | null | undefined;

async function getPreferredVoice(): Promise<SpeechSynthesisVoice | null> {
  if (selectedVoice !== undefined) return selectedVoice;
  const voices = await loadVoices();
  selectedVoice = pickBestVoice(voices);
  return selectedVoice;
}

/** Cancels whatever is currently speaking (if anything) and speaks new text. */
export async function speak(text: string): Promise<void> {
  if (!isTTSSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(naturalizeForSpeech(text));
  // A hair slower than the 1.0 default reads as noticeably less rushed/
  // robotic without dragging.
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voice = await getPreferredVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isTTSSupported()) return;
  window.speechSynthesis.cancel();
}
