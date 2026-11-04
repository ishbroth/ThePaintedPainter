const fs = require('fs');
const f = 'src/pages/QuoteResults.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "      // The server decides how long these prices can be claimed; the countdown follows it.\n      expiresAtRef.current = r.holdUntil;\n      try {\n        sessionStorage.setItem(QUOTE_EXPIRES_KEY, String(r.holdUntil));\n      } catch {\n        // ignore\n      }";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "      // The countdown keeps running from when the price was first shown. A reload (a browser that was minimized and reopened), or\n      // changing the price, fetches fresh painter prices, and the server offers a new full hold for those: that must not restart the\n      // clock. The server's time is only used when it is sooner than ours, or when ours has already run out (a new price).\n      const current = expiresAtRef.current;\n      expiresAtRef.current = current > Date.now() ? Math.min(current, r.holdUntil) : r.holdUntil;\n      try {\n        sessionStorage.setItem(QUOTE_EXPIRES_KEY, String(expiresAtRef.current));\n      } catch {\n        // ignore\n      }");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
