const fs = require('fs');
const f = 'src/components/ChatEstimator/ChatPanel.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("  const [thinking, setThinking] = useState(false);", "  const [thinking, setThinking] = useState(false);\n  // what was just sent, shown in the conversation right away while the reply is on its way\n  const [pendingText, setPendingText] = useState('');");
rep("    focusComposerNextRef.current = true;\n    setThinking(true);", "    focusComposerNextRef.current = true;\n    setPendingText(text);\n    setThinking(true);");
rep("      setThinking(false);\n      // the cursor goes back", "      setThinking(false);\n      setPendingText('');\n      // the cursor goes back");
rep("          {thinking && !waiting && (\n            <div className=\"chat-bubble chat-bubble-bot\">", "          {pendingText && !waiting && (\n            <div className=\"chat-bubble chat-bubble-user\">\n              <div className=\"chat-bubble-text\">{pendingText}</div>\n            </div>\n          )}\n          {thinking && !waiting && (\n            <div className=\"chat-bubble chat-bubble-bot\">");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
