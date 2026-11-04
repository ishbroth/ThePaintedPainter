import { makeInitialState, handleUserMessage } from './out/rules.mjs';
let s = makeInitialState();
for (const m of process.argv.slice(2)) {
  const r = await handleUserMessage(s, m); s = r.state;
  console.log('USER:', m); console.log('BOT :', s.history.at(-1).text, '\n  [topic', s.lastBotTopic?.id, 'done', !!r.done, ']\n');
  if (r.done) { console.log(JSON.stringify(r.done.estimate).slice(0,800)); break; }
}
