import { spawn } from 'node:child_process';
import fs from 'node:fs';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9354','--window-size=390,844','--user-data-dir='+process.env.TEMP+'/cdp-prof21','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
const tabs = await (await fetch('http://127.0.0.1:9354/json')).json();
const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
const shot=async n=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('_sim/shots/'+n+'.png',Buffer.from(r.data,'base64'))};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
// a stand-in for the phone's visual viewport: its height drops to 420 when the typing line has focus (the keypad), and returns when it loses it
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
(() => {
  const fake = new EventTarget();
  fake.height = innerHeight; fake.offsetTop = 0; fake.width = innerWidth;
  Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
  const set = (h) => { fake.height = h; fake.dispatchEvent(new Event('resize')); };
  window.__kbd = (open) => set(open ? 420 : innerHeight);
  document.addEventListener('focusin', (e) => { if (e.target.closest && e.target.closest('.chat-composer')) setTimeout(() => set(420), 50); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.closest('.chat-composer')) set(innerHeight); }, 150));
})();`});
await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
// tap the typing line like a finger
const pos = JSON.parse(await ev("(()=>{const b=document.querySelector('.chat-composer').getBoundingClientRect();return JSON.stringify({x:b.x+b.width/2,y:b.y+b.height/2})})()"));
await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pos.x,y:pos.y}]});
await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await sleep(1200);
console.log('overlay on:', await ev("document.querySelector('.chat-estimator-section').classList.contains('keyboard-open')"));
await shot('kb-1');
const msgs=["i need the exterior of my house painted","stucco and wood","about 2500 sq ft"];
const probe = "(()=>{const s=document.querySelector('.chat-estimator-section').getBoundingClientRect();const box=document.querySelector('.chat-messages');const b=box.getBoundingClientRect();const c=document.querySelector('.chat-composer').getBoundingClientRect();return JSON.stringify({overlay:document.querySelector('.chat-estimator-section').classList.contains('keyboard-open'),sectionTop:Math.round(s.top),sectionBottom:Math.round(s.bottom),composerTop:Math.round(c.top),composerBottom:Math.round(c.bottom),composerInView:c.top>=s.top&&c.bottom<=s.bottom+1,focused:!!document.activeElement.closest('.chat-composer')})})()";
for (const [i,m] of msgs.entries()) {
  for (const ch of m.match(/.{1,10}/g)) { await send('Input.insertText',{text:ch}); await sleep(50); }
  console.log(i+1,'typing :', await ev(probe));
  const sb = JSON.parse(await ev("(()=>{const b=document.querySelector('.chat-send-inline').getBoundingClientRect();return JSON.stringify({x:b.x+b.width/2,y:b.y+b.height/2})})()"));
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sb.x,y:sb.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  console.log('   user bubbles now:', await ev("document.querySelectorAll('.chat-bubble-user').length"));
  await sleep(7000);
  console.log(i+1,'replied:', await ev(probe));
}
await shot('kb-2');
ws.close();chrome.kill();process.exit(0);
