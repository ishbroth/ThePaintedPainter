import { spawn } from 'node:child_process';
import fs from 'node:fs';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9348','--window-size=1300,900','--user-data-dir='+process.env.TEMP+'/cdp-prof15','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
const tabs = await (await fetch('http://127.0.0.1:9348/json')).json();
const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
const shot=async n=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('_sim/shots/'+n+'.png',Buffer.from(r.data,'base64'))};
await send('Page.enable');await send('DOM.enable');await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
const msgs=["i need the exterior of my house painted","stucco and wood","about 2500 sq ft","2","yes","yes","no","no","no","vinyl","some peeling in spots","a few rotted boards","same color","91941","this month"];
for(const m of msgs){
  await ev("document.querySelector('.chat-composer-text').focus()");
  await send('Input.insertText',{text:m});await sleep(200);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await sleep(6500);
  const last=await ev("[...document.querySelectorAll('.chat-bubble-bot')].pop()?.innerText");
  console.log('>',m,'\n  ',(last||'').replace(/\n/g,' ').slice(0,160));
  if(/attach some here/.test(last||''))break;
}
ws.close();chrome.kill();process.exit(0);
