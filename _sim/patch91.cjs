const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/lib/textToSpeech.ts', [
  // ZIP codes digit by digit
  ["  // Dollar ranges before single amounts,", "  // ZIP codes are said digit by digit (\"9 1 9 4 1\"), never as a number (\"ninety-one thousand...\").\n  s = s.replace(/\\b(zip(?:\\s*code)?(?:\\s+is)?\\s*)(\\d{5})(?:-(\\d{4}))?\\b/gi, (_m, lead: string, five: string, four?: string) => `${lead}${five.split('').join(' ')}${four ? `, ${four.split('').join(' ')}` : ''}`);\n\n  // Dollar ranges before single amounts,"],
  // male voice
  ["  const score = (v: SpeechSynthesisVoice): number => {\n    const name = v.name.toLowerCase();", "  // Browsers don't say which voices are male, so known male voice names (Edge, Google, Apple, Windows) get a big lead and known\n  // female ones a penalty.\n  const MALE = /\\b(guy|davis|christopher|eric|roger|steffan|brian|andrew|ryan|tony|jason|david|mark|james|aaron|fred|alex|tom|evan|nathan|ralph|albert|bruce|junior|rishi|daniel|arthur|oliver|male)\\b/;\n  const FEMALE = /\\b(aria|jenny|sara|jane|ana|michelle|emma|ava|allison|susan|karen|moira|tessa|zoe|nicky|samantha|victoria|kathy|fiona|zira|hazel|catherine|female|siri)\\b/;\n  const score = (v: SpeechSynthesisVoice): number => {\n    const name = v.name.toLowerCase();\n    return baseScore(v, name) + (MALE.test(name) ? 200 : 0) - (FEMALE.test(name) ? 50 : 0);\n  };\n  const baseScore = (v: SpeechSynthesisVoice, name: string): number => {"],
  // speak with a natural pause at "..."
  ["export async function speak(text: string): Promise<void> {\n  if (!isTTSSupported()) return;\n  window.speechSynthesis.cancel();\n  const utterance = new SpeechSynthesisUtterance(naturalizeForSpeech(splitPrompt(text).spoken));\n  // A hair slower than the 1.0 default reads as noticeably less rushed/\n  // robotic without dragging.\n  utterance.rate = 0.9975; // 5% faster than the previous 0.95\n  utterance.pitch = 1;\n  const voice = await getPreferredVoice();\n  if (voice) utterance.voice = voice;\n  window.speechSynthesis.speak(utterance);\n}",
   "export async function speak(text: string): Promise<void> {\n  if (!isTTSSupported()) return;\n  window.speechSynthesis.cancel();\n  const myRun = ++speakRun;\n  // \"Hello citizen...what do you need painted?\": the \"...\" is a real pause, so each side is spoken separately with a beat between.\n  const parts = splitPrompt(text).spoken.split(/\\.{3,}|\\u2026/).map((p) => p.trim()).filter(Boolean);\n  const voice = await getPreferredVoice();\n  if (myRun !== speakRun) return; // something newer started speaking while the voice loaded\n  const speakPart = (index: number) => {\n    if (myRun !== speakRun || index >= parts.length) return;\n    const utterance = new SpeechSynthesisUtterance(naturalizeForSpeech(parts[index]));\n    // A hair slower than the 1.0 default reads as noticeably less rushed/\n    // robotic without dragging.\n    utterance.rate = 0.9975; // 5% faster than the previous 0.95\n    utterance.pitch = 1;\n    if (voice) utterance.voice = voice;\n    utterance.onend = () => {\n      if (index + 1 < parts.length) window.setTimeout(() => speakPart(index + 1), ELLIPSIS_PAUSE_MS);\n    };\n    window.speechSynthesis.speak(utterance);\n  };\n  speakPart(0);\n}\n\n/** Bumped every time speech starts or stops, so a pending second half of a sentence is dropped. */\nlet speakRun = 0;\nconst ELLIPSIS_PAUSE_MS = 650;"],
  ["export function stopSpeaking(): void {\n  if (!isTTSSupported()) return;\n  window.speechSynthesis.cancel();", "export function stopSpeaking(): void {\n  if (!isTTSSupported()) return;\n  speakRun++;\n  window.speechSynthesis.cancel();"],
]);

patch('src/lib/chatEstimator/chatEngine.ts', [
  ['text: "Hello, what do you need painted?",', 'text: "Hello citizen...what do you need painted?",'],
]);
console.log('ok');
