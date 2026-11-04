const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf('function stripQuantifiedBedBath(text: string): string {');
const b = t.indexOf('export function extractRooms(text: string): string[] {');
if (a < 0 || b < 0) throw new Error('markers');
const body = String.raw`function stripQuantifiedBedBath(text: string): string {
  const NUM = '(?:\\d+(?:\\.\\d)?|one|two|three|four|five|six|seven|eight|nine|ten)';
  const BED = '(?:bed(?:room)?s?|br|bd)';
  const BATH = '(?:bath(?:room)?s?|ba)';
  const hasBedCount = new RegExp('\\b' + NUM + '\\s*(?:-|\\s)?\\s*' + BED + '\\b', 'i').test(text);
  const homeWords = /\b(house|home|apartment|condo|townhouse|townhome|unit|place|sq\.?\s?ft|square f)/i.test(text);
  // "Two bathrooms (one 5x8, one 8x10)" is two rooms, not a size description; likewise "one bedroom 12x14" is one room.
  const keepBaths = !hasBedCount && !homeWords;
  const oneRoomWithDims = new RegExp('\\b(?:one|1)\\s*(?:-|\\s)?\\s*bed(?:room)?\\s+\\d{1,2}\\s*(?:x|by|×)\\s*\\d{1,2}\\b', 'i').test(text) && !homeWords;
  const parts: string[] = [];
  if (!oneRoomWithDims) parts.push(BED);
  if (!keepBaths) parts.push(BATH);
  if (parts.length === 0) return text;
  return text.replace(new RegExp('\\b' + NUM + '\\s*(?:-|\\s)?\\s*(?:' + parts.join('|') + ')\\b', 'gi'), ' ');
}

`;
t = t.slice(0, a) + body + t.slice(b);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
