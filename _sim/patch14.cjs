const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  if (rooms.length > 0 && prev.selectedRooms.length === 0 && prev.interiorScope !== 'whole_house') {";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, `  // "4 bedroom house, 2,400 sq ft ... kitchen cabinets too" describes the whole home; one room named along the way
  // (the kitchen the cabinets are in) must not shrink the job to that room.
  const describesWholeHome =
    (quantifiedBedBathMention || (!!sqft && /\b(house|home|apartment|condo|townhouse|townhome|unit|whole)\b/i.test(text))) &&
    !/\b(only|just)\b/i.test(text);
  if (rooms.length > 0 && describesWholeHome && prev.selectedRooms.length === 0 && !prev.interiorScope && !patch.interiorScope) {
    patch.interiorScope = 'whole_house';
  } else if (rooms.length > 0 && prev.selectedRooms.length === 0 && prev.interiorScope !== 'whole_house') {`);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
