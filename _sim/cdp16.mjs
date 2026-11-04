import { spawn } from 'node:child_process';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9355','--window-size=1300,900','--user-data-dir='+process.env.TEMP+'/cdp-prof22','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
const tabs = await (await fetch('http://127.0.0.1:9355/json')).json();
const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__speakUntil=0;Object.defineProperty(SpeechSynthesis.prototype,'speaking',{get(){return Date.now()<window.__speakUntil}});"});
await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
const mode = process.env.MODE || 'wait';
const msgs=["i need my backyard fence painted, about 120 feet","91941","next week","run it","run it"];
for(const m of msgs){
  await ev("document.querySelector('.chat-composer-text')?.focus()");
  await send('Input.insertText',{text:m});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await sleep(8500);
  if (await ev("!!document.querySelector('.chat-post-actions')")) break;
}
const t0 = Date.now();
console.log('button text:', await ev("document.querySelector('.chat-post-actions .chat-action-primary')?.innerText"), '| path:', await ev('location.pathname'));
await ev("window.__speakUntil = Date.now()+8000");
if (mode === 'click') { await sleep(2500); await ev("document.querySelector('.chat-post-actions .chat-action-primary').click()"); await sleep(1500); console.log('after click (about 4s in, speech still going): path =', await ev('location.pathname')); }
else { for (let i=0;i<16;i++){ await sleep(1000); const path=await ev('location.pathname'); if(path!=='/'){ console.log('navigated after', Math.round((Date.now()-t0)/1000)+'s (fake speech lasted 8s)'); break; } } }
ws.close();chrome.kill();process.exit(0);
