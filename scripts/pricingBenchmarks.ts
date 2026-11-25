// Prices a set of standard jobs through the real estimator and sets each next to what published professional prices say (HomeAdvisor, Angi, Fixr, HomeGuide,
// Homewyse, 2025-2026). Run it after changing any rate:  npm run bench:pricing
import { makeInitialState } from '../src/lib/chatEstimator/chatEngine.ts';
import { calculateEstimate } from '../src/lib/estimateEngine.ts';
import { getRegionalMultiplier } from '../src/lib/marketPricingData.ts';
import type { EstimatorContext } from '../src/lib/types.ts';

const base = makeInitialState().ctx;
const mk = (o: Partial<EstimatorContext>) => ({ ...base, surfacesAddressed: true, ...o }) as EstimatorContext;
const jobs: { name: string; ctx: Partial<EstimatorContext>; market: string }[] = [
  { name: 'Interior 2,000 sq ft, 3bd/2ba, WALLS ONLY', ctx: { projectType: 'interior', interiorScope: 'whole_house', interiorWalls: 'yes', interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'none', squareFeet: 2000, bedroomCount: 3, bathroomCount: 2, stories: 1 }, market: '$4,000-$8,000 (walls ~$2.75/sf floor = $5,500)' },
  { name: 'Interior 2,000 sq ft, walls+ceilings+trim+doors', ctx: { projectType: 'interior', interiorScope: 'whole_house', interiorWalls: 'yes', interiorCeilings: 'yes', interiorTrim: 'yes', interiorDoors: 'some', doorsIncluded: true, squareFeet: 2000, bedroomCount: 3, bathroomCount: 2, stories: 1 }, market: '$6,000-$12,000 (about $4.70/sf with trim and ceilings = $9,400)' },
  { name: 'Interior 1,000 sq ft apartment, walls only', ctx: { projectType: 'interior', interiorScope: 'whole_house', interiorWalls: 'yes', interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'none', squareFeet: 1000, bedroomCount: 2, bathroomCount: 1, stories: 1 }, market: '$2,000-$6,000' },
  { name: 'One 12x12 bedroom, walls only', ctx: { projectType: 'interior', interiorScope: 'specific_rooms', selectedRooms: ['bedroom_2'], interiorWalls: 'yes', interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'none' }, market: '$350-$850 (FreshBooks 10x12: $391)' },
  { name: 'One bedroom, walls+ceiling+trim+door', ctx: { projectType: 'interior', interiorScope: 'specific_rooms', selectedRooms: ['bedroom_2'], interiorWalls: 'yes', interiorCeilings: 'yes', interiorTrim: 'yes', interiorDoors: 'some', doorsIncluded: true }, market: '$500-$1,100 (FreshBooks 10x12 full: $815)' },
  { name: 'Exterior 2,000 sq ft, 2-story stucco, trim+soffit', ctx: { projectType: 'exterior', exteriorBody: 'yes', sidingType: 'stucco', stories: 2, squareFeet: 2000, exteriorTrim: 'yes', soffitsEaves: 'yes' }, market: '$4,000-$10,000 (Angi $3k-$8k; two-story up to +50%)' },
  { name: 'Exterior 1,500 sq ft, 1-story stucco, trim', ctx: { projectType: 'exterior', exteriorBody: 'yes', sidingType: 'stucco', stories: 1, squareFeet: 1500, exteriorTrim: 'yes', soffitsEaves: 'yes' }, market: '$1,800-$4,600 (HomeAdvisor avg $3,178)' },
  { name: 'Kitchen cabinets, 25 doors+drawers, painted now', ctx: { projectType: 'interior', interiorScope: 'specific_rooms', selectedRooms: [], interiorWalls: 'no', interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'none', cabinets: 'kitchen', cabinetDoorCount: 25, cabinetFinish: 'painted' }, market: '$1,750-$4,600 ($70-$185/piece); whole kitchen $2,000-$6,500' },
  { name: 'Fence 100 ft x 6 ft, both sides, painted', ctx: { projectType: 'exterior', exteriorBody: 'no', exteriorTrim: 'no', soffitsEaves: 'no', fence: 'yes', fenceLinearFeet: 100, fenceHeightFt: 6 }, market: '$300-$1,400 ($3-$14/lf, one coat); avg $1,700 per HomeAdvisor' },
  { name: 'Deck 300 sq ft', ctx: { projectType: 'exterior', exteriorBody: 'no', exteriorTrim: 'no', soffitsEaves: 'no', deck: 'yes', deckSqft: 300 }, market: '$600-$1,200 ($2-$4/sf; avg $850)' },
  { name: 'Front door only', ctx: { projectType: 'exterior', exteriorBody: 'no', exteriorTrim: 'no', soffitsEaves: 'no', entryDoor: 'yes' }, market: '$100-$220 (avg $156-$190; Homewyse $160-$326)' },
  { name: 'Single garage door only', ctx: { projectType: 'exterior', exteriorBody: 'no', exteriorTrim: 'no', soffitsEaves: 'no', garageDoor: 'single' }, market: '$200-$500 (avg $350)' },
  { name: 'One interior door only', ctx: { projectType: 'interior', interiorWalls: 'no', interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'some', doorsIncluded: true, doorCount: 1 }, market: '$50-$200 (frame too: $100-$350)' },
  { name: 'Dining chair x4', ctx: { projectType: '', itemsOnly: true, specialtyServices: ['furniture'], furnitureItems: ['chair', 'chair', 'chair', 'chair'], chairKind: 'dining' }, market: '$100-$400 each; basic $150-$350' },
  { name: 'Dresser', ctx: { projectType: '', itemsOnly: true, specialtyServices: ['furniture'], furnitureItems: ['dresser'] }, market: '$300-$2,000; paint only "rarely over $600"' },
];
for (const zip of ['64101', '92101']) {
  console.log(`\n===== zip ${zip} (regional multiplier ${getRegionalMultiplier(zip).multiplier.toFixed(2)}) =====`);
  for (const j of jobs) {
    const e = calculateEstimate(mk({ ...j.ctx, zipCode: zip }));
    console.log(`${j.name.padEnd(52)} $${Math.round(e.total).toLocaleString().padStart(7)}   (market ${j.market})`);
  }
}
