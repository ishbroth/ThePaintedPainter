const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of pairs) {
    if (!t.includes(from)) { console.log('NOT FOUND:', from.slice(0, 70)); continue; }
    t = t.split(from).join(to);
  }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/chatEstimator/topics.ts', [
  ["What size ${label} are we talking? Small/medium/large is fine if you don't know exact numbers.", "What size ${label} are we talking? Small, medium, or large is fine if you don't know exact numbers."],
  ["Door frames/casings, closet shelving", "Door frames, casings, closet shelving"],
  ["'needs to be nights/weekends, we're open during the day'", "'needs to be nights or weekends, we're open during the day'"],
  ["'same beige going back up' / 'changing to a light gray' / 'going from dark navy to white'", "'same beige going back up', 'changing to a light gray', or 'going from dark navy to white'"],
  ["more ladder/scaffold time", "more ladder and scaffold time"],
  ["'single story' / 'two story' / 'three-story building'", "'single story', 'two story', or 'three-story building'"],
  ["'single story' / 'two story' / 'it's a three-story townhouse'", "'single story', 'two story', or 'it's a three-story townhouse'"],
  ["customers/staff", "customers and staff"],
  ["'ASAP' / 'sometime next month' / 'whenever, no rush'", "'ASAP', 'sometime next month', or 'whenever, no rush'"],
  ["'ASAP, we'll be closed for it' / 'next month, still open for business' / 'whenever, no rush'", "'ASAP, we'll be closed for it', 'next month, still open for business', or 'whenever, no rush'"],
  ["'ASAP, place is vacant' / 'next month, we'll still be living there' / 'whenever, nothing urgent'", "'ASAP, place is vacant', 'next month, we'll still be living there', or 'whenever, nothing urgent'"],
  ["'Just baseboards' or 'baseboards and door frames' or", "'Just baseboards', 'baseboards and door frames', or"],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["removing and reinstalling fixtures/hardware around", "removing and reinstalling fixtures and hardware around"],
]);
