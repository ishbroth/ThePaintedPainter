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

{
  const f = 'src/lib/textToSpeech.ts';
  const o = load(f);
  // all English voices compete: a male voice (American first, then British, then other English) beats a female one of any accent
  rep(o, "  // American English first (en-US); other English accents only if no US voice is installed.\n  const allEnglish = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('en'));\n  const american = allEnglish.filter((v) => v.lang.toLowerCase().replace('_', '-') === 'en-us');\n  const english = american.length > 0 ? american : allEnglish;\n  if (english.length === 0) return null;",
    "  // Every English voice competes. A male voice beats a female one whatever the accent; among male voices American comes first,\n  // then British, then the other English accents.\n  const english = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('en'));\n  if (english.length === 0) return null;\n  const accentBonus = (v: SpeechSynthesisVoice): number => {\n    const lang = v.lang.toLowerCase().replace('_', '-');\n    return lang === 'en-us' ? 60 : lang === 'en-gb' ? 35 : 0;\n  };");
  rep(o, "(MALE.test(name) ? 200 : MALE_FALLBACK.test(name) ? 120 : 0) + iosPreferred", "(MALE.test(name) ? 200 : MALE_FALLBACK.test(name) ? 120 : 0) + accentBonus(v) + iosPreferred");
  // "compact" is a quality tier, not a joke voice (Daniel (Compact) is a perfectly normal male voice)
  rep(o, "|kathy|princess|agnes|bruce|victoria|compact)", "|kathy|princess|agnes|bruce|victoria)");
  // more male names: other English-speaking regions, and Daniel/Oliver/Arthur are the British ones
  rep(o, "|daniel|arthur|oliver|rishi|male)", "|daniel|arthur|oliver|rishi|lee|gordon|martin|thomas|malcolm|gerard|male)");
  // for the "what voices does this phone have?" check
  rep(o, "/** Starts loading and choosing the voice ahead of time", `/** Every voice this device offers and the one that would be used (for the ?voices check page). */
export function describeVoices(): { all: string[]; chosen: string } {
  if (!isTTSSupported()) return { all: [], chosen: '(speech not supported)' };
  const voices = window.speechSynthesis.getVoices();
  const best = pickBestVoice(voices);
  return { all: voices.map((v) => \`\${v.name} [\${v.lang}]\${v.localService ? '' : ' (online)'}\`), chosen: best ? \`\${best.name} [\${best.lang}]\` : '(none found: the default voice is used)' };
}

/** Starts loading and choosing the voice ahead of time`);
  save(f, o);
}

// ---- a tiny on-screen list, shown only at /?voices
{
  fs.writeFileSync('src/components/VoiceCheck.tsx', `import { useEffect, useState } from 'react';
import { describeVoices, prepareVoice } from '../lib/textToSpeech';

/** Open the site with ?voices at the end of the address to see which voices this device has and which one gets used. */
const VoiceCheck = () => {
  const show = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('voices');
  const [info, setInfo] = useState<{ all: string[]; chosen: string } | null>(null);
  useEffect(() => {
    if (!show) return;
    prepareVoice();
    const read = () => setInfo(describeVoices());
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [show]);
  if (!show || !info) return null;
  return (
    <div style={{ position: 'fixed', inset: '8px 8px auto 8px', maxHeight: '70vh', overflow: 'auto', zIndex: 5000, background: '#fff', color: '#111', border: '2px solid #ff7a3d', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.4 }}>
      <strong>Voice used:</strong> {info.chosen}
      <br />
      <strong>Voices on this device ({info.all.length}):</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
        {info.all.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </div>
  );
};

export default VoiceCheck;
`);
  const o = load('src/App.tsx');
  rep(o, "import { ThemeAccountSync } from './components/ThemeAccountSync';", "import { ThemeAccountSync } from './components/ThemeAccountSync';\nimport VoiceCheck from './components/VoiceCheck';");
  rep(o, "          <SiteBackground />", "          <SiteBackground />\n          <VoiceCheck />");
  save('src/App.tsx', o);
}
console.log('ok');
