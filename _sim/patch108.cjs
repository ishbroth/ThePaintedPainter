const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

// ---------- voice: a good American male on every platform (iPhone included)
patch('src/lib/textToSpeech.ts', [
  [/* male list */ "  const MALE = /\\b(guy|davis|christopher|eric|roger|steffan|brian|andrew|ryan|tony|jason|david|mark|james|aaron|fred|alex|tom|evan|nathan|ralph|albert|bruce|junior|rishi|daniel|arthur|oliver|male)\\b/;",
   "  // Real male voices: Edge/Windows (Guy, Davis, Christopher, Eric, Roger, Steffan, Brian, Andrew, Ryan, David, Mark), iPhone/Mac\n  // (Aaron, Evan, Nathan, Tom, Alex), plus the British ones as a last resort. The old robotic Apple voices (Fred, Ralph, Junior,\n  // Albert) and the novelty ones are deliberately NOT here, and are pushed down below.\n  const MALE = /\\b(guy|davis|christopher|eric|roger|steffan|brian|andrew|ryan|tony|jason|david|mark|james|aaron|alex|tom|evan|nathan|daniel|arthur|oliver|rishi|male)\\b/;\n  // iPhone and Mac ship joke and robot voices; they must never be picked.\n  const NOVELTY = /\\b(fred|ralph|junior|albert|rocko|eddy|reed|sandy|shelley|flo|grandma|grandpa|bad news|good news|whisper|zarvox|trinoids|bubbles|bells|boing|cellos|organ|wobble|jester|superstar|bahh|kathy|princess|agnes|bruce|victoria|compact)\\b/;"],
  ["    return baseScore(v, name) + (MALE.test(name) ? 200 : 0) - (FEMALE.test(name) ? 50 : 0);", "    // the best-sounding iPhone male voices first (Enhanced and Premium downloads, then Evan, Nathan, Tom, Aaron)\n    const iosPreferred = /\\b(evan|nathan|tom|aaron)\\b/.test(name) ? 40 : 0;\n    return baseScore(v, name) + (MALE.test(name) ? 200 : 0) + iosPreferred - (FEMALE.test(name) ? 50 : 0) - (NOVELTY.test(name) ? 1000 : 0);"],
  // do not cache an empty answer (iPhone often has no voices on the first ask)
  ["  const voices = await loadVoices();\n  selectedVoice = pickBestVoice(voices);\n  return selectedVoice;", "  const voices = await loadVoices();\n  const best = pickBestVoice(voices);\n  if (best) selectedVoice = best;\n  else voicesPromise = null; // none yet (iPhone loads them late): ask again next time instead of settling for the default\n  return best;"],
  ["    if (voice) utterance.voice = voice;\n    utterance.onend", "    utterance.lang = voice?.lang || 'en-US'; // never the phone's other-language default\n    if (voice) utterance.voice = voice;\n    utterance.onend"],
]);

// ---------- estimator: Mute moves to the bottom left, beside "Getting off track?"
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["            {ttsSupported && (\n              <button\n                type=\"button\"\n                className={`chat-read-aloud-toggle ${readAloud ? 'active' : ''}`}\n                onClick={toggleReadAloud}\n                aria-pressed={!readAloud}\n                aria-label={readAloud ? 'Mute' : 'Unmute'}\n                title={readAloud ? 'Mute' : 'Unmute'}\n              >\n                {readAloud ? '\\u{1F50A} Mute' : '\\u{1F507} Unmute'}\n              </button>\n            )}\n", ""],
  ["        <p className=\"chat-input-hint\">\n          Getting off track? Try \"Back Up\" or \"Start Over\"\n        </p>", `        <div className="chat-footer-row">
          {ttsSupported && (
            <button
              type="button"
              className={\`chat-read-aloud-toggle \${readAloud ? 'active' : ''}\`}
              onClick={toggleReadAloud}
              aria-pressed={!readAloud}
              aria-label={readAloud ? 'Mute' : 'Unmute'}
              title={readAloud ? 'Mute' : 'Unmute'}
            >
              {readAloud ? '\\u{1F50A} Mute' : '\\u{1F507} Unmute'}
            </button>
          )}
          <p className="chat-input-hint">
            Getting off track? Try "Back Up" or "Start Over"
          </p>
        </div>`],
]);
fs.appendFileSync('src/styles/chat-estimator.css', `
/* Mute sits at the bottom left, beside the "Getting off track?" line */
.chat-footer-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 12px;
}

.chat-footer-row .chat-input-hint {
  flex: 1;
  padding: 0;
  text-align: center;
}
`);

// ---------- header: no logo link, no hamburger; the links spread across the bar on every screen
patch('src/components/Header.tsx', [
  ["import { useState } from 'react';\n", ""],
  ["  const [isMenuOpen, setIsMenuOpen] = useState(false);\n", ""],
  ["  const toggleNav = () => {\n    hapticLight();\n    setIsMenuOpen(!isMenuOpen);\n  };\n\n  const closeMenu = () => {\n    hapticLight();\n    setIsMenuOpen(false);\n  };", "  const closeMenu = () => {\n    hapticLight();\n  };"],
  ["        <Link to=\"/\" className=\"logo\" onClick={closeMenu}>\n          The Painted Painter\n        </Link>\n        <nav className={`nav ${isMenuOpen ? 'active' : ''}`} id=\"nav\">", "        <nav className=\"nav\" id=\"nav\">"],
  ["        <button className=\"mobile-menu\" onClick={toggleNav} aria-label=\"Toggle navigation\">\n          &#9776;\n        </button>\n", ""],
]);
patch('src/index.css', [
  [`  .header-container {
    justify-content: space-between;
  }

  .nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-page);
    flex-direction: column;
    padding: 15px;
  }

  .nav.active {
    display: flex;
  }

  .nav a {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }

  .mobile-menu {
    display: block;
  }
`, `  /* The header links are spread across the whole bar on a phone (no hamburger menu). */
  .header-container {
    padding: 0 10px;
  }

  .nav {
    width: 100%;
    justify-content: space-evenly;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .nav a {
    font-size: 0.66rem;
    letter-spacing: 0.6px;
  }

  .nav a.nav-cta {
    padding: 5px 10px;
  }
`],
]);
console.log('ok');
