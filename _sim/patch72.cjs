const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("import { reviewLocally, reviewWithAI, hasPaintingScope, retryMessage, type ReviewResult } from './conversationReview';", "import { reviewLocally, reviewWithAI, hasPaintingScope, retryMessage, profanityScan, type ReviewResult } from './conversationReview';");
rep("  // The customer is disputing something the bot did", "  // Cursing or insults: say so once, kindly, and ask the question again; nothing in that message is used. (The conversation is\n  // also reviewed as a whole before any price goes out, and the customer's words go to painters with the job.)\n  {\n    const heat = profanityScan(trimmed);\n    if (heat.strong > 0 || heat.insult) {\n      const again = state.lastBotTopic ? state.lastBotTopic.ask(state.ctx) : 'What do you need painted?';\n      return asBot({}, `Let's keep this friendly. I'm here to get you a price for a painting job. ${again}`);\n    }\n  }\n\n  // The customer is disputing something the bot did");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
