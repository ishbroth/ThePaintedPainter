const fs = require('fs');
const f = 'src/lib/chatEstimator/responseSummary.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  lowVocRequested: 'Low-VOC paint requested',\n};";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, "  lowVocRequested: 'Low-VOC paint requested',\n  excludedRooms: 'Rooms the customer took off the price',\n  excludedItems: 'Items the customer took off the price',\n  trimLinearFeet: 'Trim (linear feet)',\n  crownLinearFeet: 'Crown molding (linear feet)',\n  accentWallCount: 'Accent walls',\n  stairRailFeet: 'Stair railing (feet)',\n  popcornCeilingSqft: 'Popcorn ceiling area (sq ft)',\n  cabinetDoorCount: 'Cabinet doors and drawer fronts',\n  deckSqft: 'Deck area (sq ft)',\n  pressureWashSqft: 'Pressure-wash area (sq ft)',\n  exteriorBody: 'House body painted (siding/stucco/brick)',\n};");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
