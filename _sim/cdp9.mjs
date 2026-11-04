import { spawn } from 'node:child_process';
import fs from 'node:fs';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9343','--window-size=1300,900','--user-data-dir='+process.env.TEMP+'/cdp-prof10','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
const tabs = await (await fetch('http://127.0.0.1:9343/json')).json();
const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
const shot=async n=>{const r=await send('Page.captureScreenshot',{format:'png',clip:{x:300,y:450,width:700,height:200,scale:1}});fs.writeFileSync('_sim/shots/'+n+'.png',Buffer.from(r.data,'base64'))};
await send('Page.enable');await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
for (const th of ['light','dark']) {
  await ev(`localStorage.setItem('theme','${th}');document.documentElement.setAttribute('data-theme','${th}')`);
  await sleep(1200);
  console.log(th, await ev("getComputedStyle(document.querySelector('.site-hero-bg__title')).opacity + ' / ' + getComputedStyle(document.querySelector('.site-hero-bg__img')).opacity + ' / site ' + getComputedStyle(document.querySelector('.site-hero-bg')).getPropertyValue('--hero-opacity')"));
  await shot('title-'+th);
}
ws.close();chrome.kill();process.exit(0);
