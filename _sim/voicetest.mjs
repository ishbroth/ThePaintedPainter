const mk = (name, lang, local = true) => ({ name, lang, localService: local, default: false, voiceURI: name });
const lists = {
  'iPhone (basic)': [mk('Aaron','en-US'),mk('Fred','en-US'),mk('Nicky','en-US'),mk('Samantha','en-US'),mk('Ralph','en-US'),mk('Junior','en-US'),mk('Albert','en-US'),mk('Bad News','en-US'),mk('Daniel','en-GB'),mk('Karen','en-AU'),mk('Eddy (English (United States))','en-US'),mk('Reed (English (United States))','en-US'),mk('Rocko (English (United States))','en-US')],
  'iPhone (no Aaron)': [mk('Samantha','en-US'),mk('Fred','en-US'),mk('Ralph','en-US'),mk('Eddy (English (United States))','en-US'),mk('Reed (English (United States))','en-US'),mk('Daniel','en-GB'),mk('Zarvox','en-US')],
  'iPhone (enhanced downloaded)': [mk('Samantha','en-US'),mk('Evan (Enhanced)','en-US'),mk('Aaron','en-US'),mk('Nathan (Enhanced)','en-US'),mk('Fred','en-US')],
  'Android': [mk('Google US English','en-US',false),mk('English United States','en-US'),mk('en-us-x-iol-local','en-US'),mk('en-us-x-sfg-network','en-US',false),mk('Google UK English Male','en-GB',false)],
  'iPhone (only Samantha + GB/AU/IE)': [mk('Samantha','en-US'),mk('Daniel','en-GB'),mk('Karen','en-AU'),mk('Moira','en-IE'),mk('Rishi','en-IN'),mk('Tessa','en-ZA')],
  'iPhone (Daniel Compact)': [mk('Samantha (Compact)','en-US'),mk('Daniel (Compact)','en-GB'),mk('Fred','en-US')],
  'Windows Edge': [mk('Microsoft Aria Online (Natural) - English (United States)','en-US',false),mk('Microsoft Guy Online (Natural) - English (United States)','en-US',false),mk('Microsoft David - English (United States)','en-US'),mk('Microsoft Zira - English (United States)','en-US')],
};
let current = [];
const spoken = [];
globalThis.window = globalThis;
globalThis.document = { addEventListener(){}, removeEventListener(){} };
globalThis.SpeechSynthesisUtterance = class { constructor(t){this.text=t;} };
globalThis.speechSynthesis = { speaking:false, pending:false, getVoices:()=>current, speak:(u)=>spoken.push(u.voice?.name ?? '(default)'), cancel(){}, resume(){}, addEventListener(){} };
const { speak } = await import('./out/tts.mjs');
for (const [name, list] of Object.entries(lists)) {
  current = list; spoken.length = 0;
  // fresh module state per list: re-import with a cache-buster
  const m = await import('./out/tts.mjs?x=' + name);
  m.speak('Hello, citizen. What do you need painted?');
  await new Promise(r => setTimeout(r, 120));
  console.log(name.padEnd(30), '->', spoken[0]);
}
