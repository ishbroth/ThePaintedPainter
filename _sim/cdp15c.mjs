import { spawn } from 'node:child_process';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9351','--window-size=390,844','--user-data-dir='+process.env.TEMP+'/cdp-prof18','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
const tabs = await (await fetch('http://127.0.0.1:9351/json')).json();
const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
// the keypad-open split, as the page does it on a phone
await ev("document.querySelector('.chat-composer-text').focus()");
await sleep(300);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:430,screenWidth:390,screenHeight:844,deviceScaleFactor:2,mobile:true});
await sleep(1200);
console.log('keyboard-open class:', await ev("document.querySelector('.chat-estimator-section').classList.contains('keyboard-open')"), 'section h:', await ev("Math.round(document.querySelector('.chat-estimator-section').getBoundingClientRect().height)"));
const msgs=["i need the exterior of my house painted, it is a two story with stucco and some wood trim and the paint is peeling in a few spots","stucco and wood","about 2500 sq ft","2 stories","yes the trim too, and the front door","no garage door for now"];
const probe = "(()=>{const box=document.querySelector('.chat-messages').getBoundingClientRect();const c=document.querySelector('.chat-composer').getBoundingClientRect();return JSON.stringify({composerBottom:Math.round(c.bottom),boxBottom:Math.round(box.bottom),boxTop:Math.round(box.top),composerTop:Math.round(c.top),visible:c.top>=box.top-1&&c.bottom<=box.bottom+1,scrollable:document.querySelector('.chat-messages').scrollHeight>document.querySelector('.chat-messages').clientHeight})})()";
for (const m of msgs) {
  await ev("document.querySelector('.chat-composer-text').focus()");
  for (const ch of m.match(/.{1,12}/g)) { await send('Input.insertText',{text:ch}); await sleep(60); }
  console.log('typing  :', await ev(probe));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await sleep(7000);
  console.log('replied :', await ev(probe));
}
ws.close();chrome.kill();process.exit(0);
