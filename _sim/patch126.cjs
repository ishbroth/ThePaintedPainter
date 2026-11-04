const fs = require('fs');
const f = 'src/components/ChatEstimator/ChatPanel.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("      const nowOpen = focused && height < full * 0.78;\n      if (nowOpen === open) return;", "      const nowOpen = focused && height < full * 0.78;\n      // the window just changed size (the keypad moved): keep the latest line in view\n      if (nowOpen && messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;\n      if (nowOpen === open) return;");
rep("  // Typing while focus is elsewhere on the page", `  // Phones and tablets: the conversation stays scrolled to the bottom inside its window whenever anything in it changes (a new
  // bubble, the reply arriving, the "..." while it thinks, or the words being typed growing the typing line), so what is being
  // typed is always in view and the conversation follows along.
  useEffect(() => {
    if (keyboardDevice) return;
    const box = messagesRef.current;
    if (!box) return;
    const stick = () => {
      box.scrollTop = box.scrollHeight;
    };
    const observer = new MutationObserver(stick);
    observer.observe(box, { childList: true, subtree: true, characterData: true });
    stick();
    return () => observer.disconnect();
  }, [keyboardDevice]);

  // Typing while focus is elsewhere on the page`);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
