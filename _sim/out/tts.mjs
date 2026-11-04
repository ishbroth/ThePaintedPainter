// src/lib/promptHints.ts
var QUESTION_STEM = /\b(are|is|do|does|did|will|would|what|which|how|where|when|who|can|could|any|about)\b/i;
var LIST_SEPARATORS = /,|\bor\b/gi;
function listLike(s) {
  return (s.match(LIST_SEPARATORS) ?? []).length >= 2;
}
function clean(s) {
  return s.replace(/\s{2,}/g, " ").trim();
}
function splitPrompt(text) {
  let spoken = text;
  const hints = [];
  spoken = spoken.replace(/\(([^)]{8,})\)/g, (_m, inner) => {
    hints.push(inner);
    return "";
  });
  const tail = spoken.match(/^(.*\?)\s+([A-Z][^?.!]*\?)$/s);
  if (tail && listLike(tail[2])) {
    spoken = tail[1];
    hints.push(tail[2].replace(/\?$/, ""));
  } else {
    const dash = spoken.match(/^(.*?[.!?]\s+)?([^.!?]*?)\s[—–]\s([^.!?—–]*\?)$/s);
    if (dash && QUESTION_STEM.test(dash[2]) && dash[2].length >= 15 && listLike(dash[3])) {
      spoken = `${dash[1] ?? ""}${dash[2]}?`;
      hints.push(dash[3].replace(/\?$/, ""));
    }
  }
  return { spoken: clean(spoken), hint: clean(hints.join(" \xB7 ")) };
}

// src/lib/textToSpeech.ts
function isTTSSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
function naturalizeForSpeech(text) {
  let s = text;
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\[\[photos?[:|][^\]]*\]\]/g, "").replace(/ {2,}/g, " ").trim();
  s = s.replace(/\s*·\s*/g, ", or ");
  s = s.replace(/\b(zip(?:\s*code)?(?:\s+is)?\s*)(\d{5})(?:-(\d{4}))?\b/gi, (_m, lead, five, four) => `${lead}${five.split("").join(" ")}${four ? `, ${four.split("").join(" ")}` : ""}`);
  s = s.replace(/\$\s?([\d,]+)\s*[–—-]\s*\$\s?([\d,]+)/g, "$1 to $2 dollars");
  s = s.replace(/\$\s?([\d,]+)/g, "$1 dollars");
  s = s.replace(/\blin(?:ear)?\s*\.?\s*ft\.?\b/gi, "linear feet").replace(/\bsq\.?\s*ft\.?\b/gi, "square feet").replace(/\bsqft\b/gi, "square feet").replace(/\bsf\b/gi, "square feet").replace(/(\d)\s*ft\b/gi, "$1 feet").replace(/\bhoa\b/gi, "H O A").replace(/\bepa\b/gi, "E P A");
  s = s.replace(/(\d+)\s*[×x]\s*(\d+)/gi, "$1 by $2");
  s = s.replace(/(\d)\s*%/g, "$1 percent");
  s = s.replace(/(\w)\s*\+\s*(\w)/g, "$1 plus $2");
  s = s.replace(/(\w)\/(\w)/g, "$1 or $2");
  s = s.replace(/\be\.g\.,?\s*/gi, "for example, ");
  s = s.replace(/\s+[–—]\s+/g, ", ");
  return s;
}
var cachedVoices = null;
var voicesPromise = null;
function loadVoices() {
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
      "voiceschanged",
      () => {
        cachedVoices = window.speechSynthesis.getVoices();
        resolve(cachedVoices);
      },
      { once: true }
    );
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
  return voicesPromise;
}
function pickBestVoice(voices) {
  const english = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("en"));
  if (english.length === 0) return null;
  const accentBonus = (v) => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    return lang === "en-us" ? 60 : lang === "en-gb" ? 35 : 0;
  };
  const MALE = /\b(guy|davis|christopher|eric|roger|steffan|brian|andrew|ryan|tony|jason|david|mark|james|aaron|alex|tom|evan|nathan|daniel|arthur|oliver|rishi|lee|gordon|martin|thomas|malcolm|gerard|male)\b/;
  const NOVELTY = /\b(fred|ralph|junior|albert|sandy|shelley|flo|grandma|grandpa|bad news|good news|whisper|zarvox|trinoids|bubbles|bells|boing|cellos|organ|wobble|jester|superstar|bahh|kathy|princess|agnes|bruce|victoria)\b/;
  const MALE_FALLBACK = /\b(eddy|reed|rocko)\b/;
  const ANDROID_MALE = /en-us-x-(?:iol|iom|tpd)/;
  const FEMALE = /\b(aria|jenny|sara|jane|ana|michelle|emma|ava|allison|susan|karen|moira|tessa|zoe|nicky|samantha|victoria|kathy|fiona|zira|hazel|catherine|female|siri)\b/;
  const score = (v) => {
    const name = v.name.toLowerCase();
    const iosPreferred = /\b(evan|nathan|tom|aaron)\b/.test(name) ? 40 : 0;
    return baseScore(v, name) + (MALE.test(name) || ANDROID_MALE.test(name) ? 200 : MALE_FALLBACK.test(name) ? 120 : 0) + accentBonus(v) + iosPreferred - (FEMALE.test(name) ? 50 : 0) - (NOVELTY.test(name) ? 1e3 : 0);
  };
  const baseScore = (v, name) => {
    if (name.includes("natural")) return 100;
    if (name.includes("online")) return 95;
    if (name.includes("premium")) return 92;
    if (name.includes("enhanced")) return 90;
    if (name.includes("neural")) return 88;
    if (/\b(aria|jenny|guy|ana|davis|jane|sara)\b/.test(name)) return 85;
    if (name.includes("google")) return 80;
    if (/\b(samantha|ava|allison|susan|karen|moira|tessa|zoe|nicky|siri)\b/.test(name)) return 70;
    if (v.localService === false) return 60;
    if (v.lang.toLowerCase() === "en-us") return 40;
    if (v.lang.toLowerCase().startsWith("en")) return 30;
    return 10;
  };
  return [...english].sort((a, b) => score(b) - score(a))[0];
}
var selectedVoice;
async function getPreferredVoice() {
  if (selectedVoice !== void 0) return selectedVoice;
  const voices = await loadVoices();
  const best = pickBestVoice(voices);
  if (best) selectedVoice = best;
  else voicesPromise = null;
  return best;
}
function describeVoices() {
  if (!isTTSSupported()) return { all: [], chosen: "(speech not supported)" };
  const voices = window.speechSynthesis.getVoices();
  const best = pickBestVoice(voices);
  return { all: voices.map((v) => `${v.name} [${v.lang}]${v.localService ? "" : " (online)"}`), chosen: best ? `${best.name} [${best.lang}]` : "(none found: the default voice is used)" };
}
function prepareVoice() {
  if (!isTTSSupported()) return;
  void getPreferredVoice();
}
function speak(text) {
  if (!isTTSSupported()) return Promise.resolve();
  const synth = window.speechSynthesis;
  if (!selectedVoice) {
    const known = synth.getVoices();
    if (known.length > 0) selectedVoice = pickBestVoice(known) ?? selectedVoice;
    if (!selectedVoice) prepareVoice();
  }
  const mustCancel = (synth.speaking || synth.pending) && !unlockInFlight;
  if (mustCancel) synth.cancel();
  synth.resume?.();
  const myRun = ++speakRun;
  const parts = splitPrompt(text).spoken.split(/\.{3,}|\u2026/).map((p) => p.trim()).filter(Boolean);
  const speakPart = (index) => {
    if (myRun !== speakRun || index >= parts.length) return;
    const voice = selectedVoice ?? null;
    const utterance = new SpeechSynthesisUtterance(naturalizeForSpeech(parts[index]));
    utterance.rate = 0.9975;
    utterance.pitch = 1;
    utterance.lang = voice?.lang || "en-US";
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (index + 1 < parts.length) window.setTimeout(() => speakPart(index + 1), ELLIPSIS_PAUSE_MS);
    };
    synth.speak(utterance);
  };
  if (mustCancel) window.setTimeout(() => speakPart(0), 80);
  else speakPart(0);
  return Promise.resolve();
}
var speakRun = 0;
var ELLIPSIS_PAUSE_MS = 250;
function stopSpeaking() {
  if (!isTTSSupported()) return;
  speakRun++;
  window.speechSynthesis.cancel();
}
var unlocked = false;
function unlockSpeechSynthesis() {
  if (unlocked || !isTTSSupported()) return;
  unlocked = true;
  const utterance = new SpeechSynthesisUtterance(" ");
  utterance.volume = 0;
  unlockInFlight = true;
  utterance.onend = utterance.onerror = () => {
    unlockInFlight = false;
  };
  window.speechSynthesis.speak(utterance);
}
var unlockInFlight = false;
function setupSpeechUnlock() {
  if (!isTTSSupported() || typeof document === "undefined") return () => {
  };
  prepareVoice();
  const handler = () => {
    prepareVoice();
    unlockSpeechSynthesis();
  };
  document.addEventListener("touchstart", handler, { once: true, passive: true });
  document.addEventListener("click", handler, { once: true });
  return () => {
    document.removeEventListener("touchstart", handler);
    document.removeEventListener("click", handler);
  };
}
export {
  describeVoices,
  isTTSSupported,
  naturalizeForSpeech,
  prepareVoice,
  setupSpeechUnlock,
  speak,
  stopSpeaking
};
