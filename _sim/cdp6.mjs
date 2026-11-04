import { spawn } from 'node:child_process';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9339','--window-size=1300,900','--user-data-dir='+process.env.TEMP+'/cdp-prof6','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
async function attach(wsUrl){const ws=new WebSocket(wsUrl);await new Promise(r=>ws.onopen=r);let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
 const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
 const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;return {ws,send,ev};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tabs = await (await fetch('http://127.0.0.1:9339/json')).json();
const a = await attach(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await a.send('Page.enable');await a.send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
await a.ev("document.querySelector('.chat-composer-text').focus()");
await a.send('Input.insertText',{text:'i have a one bedroom apartment'});
await a.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
await a.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
await sleep(7000);
await a.ev("window.dispatchEvent(new Event('pagehide'))");
console.log('tab A bubbles:',await a.ev("document.querySelectorAll('.chat-bubble').length"),'mirror:',await a.ev("!!localStorage.getItem('ttp_chat_mirror')"));
// a brand new tab = a new browser session (empty sessionStorage), same browser profile
const t = await (await fetch('http://127.0.0.1:9339/json/new?http://localhost:5173/',{method:'PUT'})).json();
await sleep(9000);
const b = await attach(t.webSocketDebuggerUrl);
console.log('new tab bubbles:',await b.ev("document.querySelectorAll('.chat-bubble').length"));
await b.send('Page.enable');await b.send('Page.reload',{ignoreCache:true});await sleep(9000);
console.log('new tab after hard refresh, bubbles:',await b.ev("document.querySelectorAll('.chat-bubble').length"));
chrome.kill();process.exit(0);
