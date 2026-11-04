import fs from 'node:fs';
const src = fs.readFileSync('_sim/cdp15.mjs','utf8')
  .replace("9350","9351").replace("cdp-prof17","cdp-prof18")
  .replace(/await ev\("document\.documentElement\.style\.setProperty\('--vvh'[^\n]*\n/, `await ev("document.querySelector('.chat-composer-text').focus()");
await sleep(300);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:430,screenWidth:390,screenHeight:844,deviceScaleFactor:2,mobile:true});
await sleep(1200);
console.log('keyboard-open class:', await ev("document.querySelector('.chat-estimator-section').classList.contains('keyboard-open')"), 'section h:', await ev("Math.round(document.querySelector('.chat-estimator-section').getBoundingClientRect().height)"));
`);
fs.writeFileSync('_sim/cdp15c.mjs', src);
