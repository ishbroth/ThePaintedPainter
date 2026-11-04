const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/chatEstimator/chatEngine.ts', [['text: "Hello citizen, what do you need painted?",', 'text: "Hello citizen...what do you need painted?",']]);
patch('src/pages/Home.tsx', [
  ["import { useEffect, useRef } from 'react';", "import { useEffect, useLayoutEffect, useRef } from 'react';"],
  ["const Home = () => {\n", `const Home = () => {
  // The home page always opens at the top (not wherever a refresh or the back button left it), unless the link points at a section
  // (the "Get your price" link goes to /#estimator and scrolls itself).
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    if (!window.location.hash) window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

`],
]);
