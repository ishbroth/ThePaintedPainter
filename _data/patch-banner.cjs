const fs = require('fs');
const edit = (p, fn) => { const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); const s = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
const rep = (s, a, b, l) => { if (!s.includes(a)) throw new Error('missing: ' + l); return s.replace(a, () => b); };
edit('src/components/AuthRedirectBanner.tsx', (s) => {
  s = rep(s, "  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');\n", `  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  // the banner can be closed with its x; the good news ("you're all set", "new email sent") also fades away by itself after ten seconds
  const [dismissed, setDismissed] = useState(false);
  const [fading, setFading] = useState(false);
  const goodNews = state === 'confirmed' || resendStatus === 'sent';
  useEffect(() => {
    if (!goodNews) return;
    setFading(false);
    const fade = window.setTimeout(() => setFading(true), 9000);
    const gone = window.setTimeout(() => setDismissed(true), 10000);
    return () => { window.clearTimeout(fade); window.clearTimeout(gone); };
  }, [goodNews]);
`, 'state');
  s = rep(s, "  if (state === 'none') return null;", "  if (state === 'none' || dismissed) return null;", 'null');
  s = rep(s, "        position: 'relative',\n        zIndex: 2,\n      }}\n    >", "        position: 'relative',\n        zIndex: 2,\n        opacity: fading ? 0 : 1,\n        transition: 'opacity 1s ease',\n      }}\n    >\n      <button\n        type=\"button\"\n        onClick={() => setDismissed(true)}\n        aria-label=\"Close this message\"\n        style={{ position: 'absolute', top: 6, right: 10, width: 28, height: 28, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer' }}\n      >\n        ×\n      </button>", 'x');
  s = rep(s, "        padding: '10px 20px',\n        textAlign: 'center',", "        padding: '10px 44px 10px 20px',\n        textAlign: 'center',", 'pad');
  return s;
});
console.log('ok');
