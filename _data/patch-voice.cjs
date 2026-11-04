const fs = require('fs');
const edit = (p, fn) => { const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); const s = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
const rep = (s, a, b, l) => { if (!s.includes(a)) throw new Error('missing: ' + l); return s.replace(a, () => b); };

edit('src/lib/textToSpeech.ts', (s) => {
  s = rep(s, "let selectedVoice: SpeechSynthesisVoice | null | undefined;", String.raw`let selectedVoice: SpeechSynthesisVoice | null | undefined;

// ---- the app's own voice choice (the iPhone / Android app only; the website always uses the automatic pick) ----
const CHOSEN_VOICE_KEY = 'tpp_chosen_voice';
const chosenName = (): string | null => {
  if (!isNativeApp()) return null;
  try { return localStorage.getItem(CHOSEN_VOICE_KEY); } catch { return null; }
};
/** The voice the person picked in the app, if the phone still has it; otherwise the best automatic pick. */
function chooseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const wanted = chosenName();
  const mine = wanted ? voices.find((v) => v.name === wanted) : undefined;
  return mine ?? pickBestVoice(voices);
}

export interface VoiceChoice { name: string; lang: string; quality: 'Premium' | 'Enhanced' | 'Standard'; automatic: boolean; chosen: boolean }
/** The English voices on this phone, best first, for the app's voice picker. */
export function listEnglishVoices(): VoiceChoice[] {
  if (!isTTSSupported()) return [];
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('en'));
  const auto = pickBestVoice(voices);
  const wanted = chosenName();
  const rank = (v: SpeechSynthesisVoice) => (/premium/i.test(v.name) ? 0 : /enhanced/i.test(v.name) ? 1 : 2);
  return voices
    .map((v) => ({ v, r: rank(v) }))
    .sort((a, b) => a.r - b.r || (a.v.lang === 'en-US' ? 0 : 1) - (b.v.lang === 'en-US' ? 0 : 1) || a.v.name.localeCompare(b.v.name))
    .map(({ v, r }) => ({ name: v.name, lang: v.lang, quality: r === 0 ? 'Premium' : r === 1 ? 'Enhanced' : 'Standard', automatic: v === auto, chosen: wanted === v.name }));
}
/** Remembers the voice picked in the app (null goes back to the automatic pick). */
export function chooseAppVoice(name: string | null): void {
  try { if (name) localStorage.setItem(CHOSEN_VOICE_KEY, name); else localStorage.removeItem(CHOSEN_VOICE_KEY); } catch { /* ignore */ }
  selectedVoice = undefined;
}
/** Says a short sample in one of the phone's voices. */
export function previewVoice(name: string): void {
  if (!isTTSSupported()) return;
  const voice = window.speechSynthesis.getVoices().find((v) => v.name === name);
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance('Hi, I can work out a price for your painting job. Tell me about your project.');
  u.rate = 0.9975;
  u.pitch = 1;
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  window.speechSynthesis.speak(u);
}`, 'chooser');
  s = rep(s, "  const best = pickBestVoice(voices);\n  if (best) selectedVoice = best;", "  const best = chooseVoice(voices);\n  if (best) selectedVoice = best;", 'preferred');
  s = rep(s, "    if (known.length > 0) selectedVoice = pickBestVoice(known) ?? selectedVoice;", "    if (known.length > 0) selectedVoice = chooseVoice(known) ?? selectedVoice;", 'speakWeb');
  s = rep(s, "  voicesPromise = new Promise((resolve) => {", "  voicesPromise = new Promise((resolve) => {", 'noop');
  return s;
});
edit('src/lib/textToSpeech.ts', (s) => {
  // import for isNativeApp
  const first = s.indexOf('\nimport ');
  if (s.includes("from './platform'")) return s;
  if (first >= 0) return s.slice(0, first) + "\nimport { isNativeApp } from './platform';" + s.slice(first);
  return "import { isNativeApp } from './platform';\n" + s;
});

fs.writeFileSync('src/components/ChatEstimator/VoicePicker.tsx', String.raw`import { useEffect, useState } from 'react';
import { chooseAppVoice, listEnglishVoices, previewVoice, type VoiceChoice } from '../../lib/textToSpeech';

/** The app's voice picker: the English voices on this phone, each with a sample, so the best-sounding one can be chosen. */
export default function VoicePicker({ onClose }: { onClose: () => void }) {
  const [voices, setVoices] = useState<VoiceChoice[]>(() => listEnglishVoices());
  useEffect(() => {
    const refresh = () => setVoices(listEnglishVoices());
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh);
    const t = window.setTimeout(refresh, 600);
    return () => { window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh); window.clearTimeout(t); window.speechSynthesis?.cancel(); };
  }, []);
  const anyChosen = voices.some((v) => v.chosen);
  const pick = (name: string | null) => { chooseAppVoice(name); setVoices(listEnglishVoices()); };
  return (
    <div role="dialog" aria-label="Choose a voice" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderRadius: 14, width: 'min(440px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>Choose a voice</h2>
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          These are the voices on your phone. For a more natural one, download an <b>Enhanced</b> or <b>Premium</b> voice in Settings &gt; Accessibility &gt; Spoken Content &gt; Voices &gt; English, then come back here: it appears in the list.
        </p>
        <button type="button" onClick={() => pick(null)} style={{ ...row, borderColor: !anyChosen ? 'var(--accent)' : 'var(--border-strong)' }}>
          <span><b>Automatic</b> <span style={{ color: 'var(--text-secondary)' }}>(the best the phone has)</span></span>
          {!anyChosen && <span aria-label="In use">✓</span>}
        </button>
        {voices.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No English voices found yet.</p>}
        {voices.map((v) => (
          <div key={v.name} style={{ ...row, borderColor: v.chosen ? 'var(--accent)' : 'var(--border-strong)', cursor: 'default' }}>
            <span style={{ minWidth: 0 }}>
              <b>{v.name.replace(/\s*\((?:Premium|Enhanced)\)/i, '')}</b>{' '}
              <span style={{ color: v.quality === 'Standard' ? 'var(--text-secondary)' : 'var(--accent)', fontSize: '0.8rem' }}>{v.quality}</span>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.lang}{v.automatic && !anyChosen ? ' · in use' : ''}</span>
            </span>
            <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
              <button type="button" onClick={() => previewVoice(v.name)} style={small}>Listen</button>
              <button type="button" onClick={() => pick(v.name)} style={{ ...small, background: v.chosen ? 'var(--accent)' : 'transparent', color: v.chosen ? 'var(--accent-ink)' : 'var(--text-primary)' }}>{v.chosen ? 'Using' : 'Use'}</button>
            </span>
          </div>
        ))}
        <button type="button" onClick={onClose} style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  );
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', font: 'inherit', cursor: 'pointer' };
const small: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', font: 'inherit', fontSize: '0.85rem', cursor: 'pointer' };
`);

edit('src/components/ChatEstimator/ChatPanel.tsx', (s) => {
  s = rep(s, "import { loadAccountChatState,", "import VoicePicker from './VoicePicker';\nimport { isNativeApp } from '../../lib/platform';\nimport { loadAccountChatState,", 'imp');
  s = rep(s, "  const ttsSupported = isTTSSupported();", "  const ttsSupported = isTTSSupported();\n  const [voicePickerOpen, setVoicePickerOpen] = useState(false);", 'state');
  s = rep(s, "          <p className=\"chat-input-hint\">\n            Getting off track?", "          {ttsSupported && isNativeApp() && (\n            <button type=\"button\" className=\"chat-read-aloud-toggle\" onClick={() => setVoicePickerOpen(true)} aria-label=\"Choose a voice\" title=\"Choose a voice\">\n              Voice\n            </button>\n          )}\n          <p className=\"chat-input-hint\">\n            Getting off track?", 'button');
  s = rep(s, "      <input\n        ref={photoInputRef}", "      {voicePickerOpen && <VoicePicker onClose={() => setVoicePickerOpen(false)} />}\n\n      <input\n        ref={photoInputRef}", 'render');
  return s;
});
console.log('ok');
