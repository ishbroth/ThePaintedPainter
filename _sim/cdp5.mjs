import { spawn } from 'node:child_process';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--remote-debugging-port=9338','--window-size=1300,900','--user-data-dir='+process.env.TEMP+'/cdp-prof5','about:blank'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,8000));
const tabs = await (await fetch('http://127.0.0.1:9338/json')).json();
const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d.result);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
const bubbles=()=>ev("document.querySelectorAll('.chat-bubble').length");
await send('Page.enable');await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(9000);
await ev("document.querySelector('.chat-composer-text').focus()");
await send('Input.insertText',{text:'i have a one bedroom apartment'});
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
await sleep(7000);
console.log('after message, bubbles:',await bubbles());
// SPA navigation away and back keeps it
await ev("document.querySelector('a[href=\"/support\"]')?.click()");await sleep(1500);
await ev("history.back()");await sleep(2500);
console.log('after leaving and coming back, bubbles:',await bubbles());
// mirror written when the page goes away
await ev("document.dispatchEvent(new Event('visibilitychange'))");
await ev("window.dispatchEvent(new Event('pagehide'))");
console.log('mirror saved:',await ev("!!localStorage.getItem('ttp_chat_mirror')"));
// browser closed and reopened: sessionStorage gone, mirror still there
await ev("window.addEventListener('pagehide', e => e.stopImmediatePropagation(), true); document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true); sessionStorage.clear()");
await send('Page.navigate',{url:'http://localhost:5173/?reopened=1'});await sleep(8000);
console.log('after reopening: session hist', await ev("(()=>{try{return JSON.parse(sessionStorage.getItem('ttp_chat_estimator_state')).state.history.length}catch(e){return String(e)}})()"), 'bubbles', await bubbles(), 'mirror', await ev("!!localStorage.getItem('ttp_chat_mirror')"));
// refresh clears
await send('Page.reload',{ignoreCache:true});await sleep(9000);
console.log('after hard refresh, bubbles:',await bubbles(),'| mirror:',await ev("!!localStorage.getItem('ttp_chat_mirror')"));
ws.close();chrome.kill();process.exit(0);
