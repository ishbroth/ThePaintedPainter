import { calculateEstimate, makeInitialContext, getRegionalMultiplier } from './out/rules.mjs';
const mk = (p) => ({ ...makeInitialContext(), zipCode: '37201', ...p });
const T = {
 'stair rail only (interior, 14 steps)': [250,900, { projectType:'interior', interiorScope:'specific_rooms', selectedRooms:[], surfacesAddressed:true, interiorWalls:'no', interiorCeilings:'no', interiorTrim:'no', interiorDoors:'none', stairways:'yes', stairwayCount:1, stairwayDetails:'railings_only' }],
 'stair rail via railings field': [250,900, { projectType:'interior', interiorScope:'specific_rooms', selectedRooms:[], surfacesAddressed:true, interiorWalls:'no', interiorCeilings:'no', interiorTrim:'no', interiorDoors:'none', railings:'yes', railingType:'spindles' }],
 'single bedroom 12x14 walls': [300,900, { projectType:'interior', interiorScope:'specific_rooms', selectedRooms:['master_bedroom'], surfacesAddressed:true, interiorCeilings:'no', interiorTrim:'no', interiorDoors:'none' }],
 'bathroom small w vanity': [350,1100, { projectType:'interior', interiorScope:'specific_rooms', selectedRooms:['bathroom_master'], surfacesAddressed:true, cabinets:'bathroom' }],
 '8 shutters only': [200,700, { projectType:'exterior', exteriorScope:'partial', exteriorShutters:'yes', exteriorShutterCount:8 }],
 'fence 150ft privacy': [700,3000, { projectType:'exterior', exteriorScope:'partial', fence:'yes', fenceLinearFeet:150, fenceType:'privacy_6ft' }],
 'deck medium': [800,3200, { projectType:'exterior', exteriorScope:'partial', deck:'yes', deckSize:'medium' }],
 'front+garage door': [300,900, { projectType:'exterior', exteriorScope:'partial', entryDoor:'yes', garageDoor:'double' }],
 'kitchen cabinets 25 doors': [2000,5500, { projectType:'interior', interiorScope:'specific_rooms', selectedRooms:['kitchen'], cabinets:'kitchen', surfacesAddressed:true, interiorWalls:'no', interiorCeilings:'no', interiorTrim:'no' }],
 '2br apt 900sf whole': [1500,3800, { projectType:'interior', interiorScope:'whole_house', squareFeet:900, propertyType:'rental', occupancy:'vacant' }],
 '3br house 1500sf whole': [2800,6500, { projectType:'interior', interiorScope:'whole_house', squareFeet:1500, propertyType:'residential' }],
 '4br 2400sf whole': [4500,10000, { projectType:'interior', interiorScope:'whole_house', squareFeet:2400, stories:2, propertyType:'residential' }],
 'ranch ext 1800 stucco': [3000,7500, { projectType:'exterior', exteriorScope:'full', squareFeet:1800, stories:1, sidingType:'stucco', propertyType:'residential' }],
 '2story wood ext 2600': [4500,11000, { projectType:'exterior', exteriorScope:'full', squareFeet:2600, stories:2, sidingType:'wood', propertyType:'residential' }],
 'victorian ext 3200 wood 3st': [9000,24000, { projectType:'exterior', exteriorScope:'full', squareFeet:3200, stories:3, sidingType:'wood', propertyType:'residential' }],
 'restaurant 1500sf': [3500,9000, { projectType:'interior', interiorScope:'whole_house', squareFeet:1500, propertyType:'commercial' }],
 'office 3000sf': [4500,12000, { projectType:'interior', interiorScope:'whole_house', squareFeet:3000, propertyType:'commercial' }],
 'warehouse 8000sf walls': [8000,24000, { projectType:'interior', interiorScope:'whole_house', squareFeet:8000, propertyType:'commercial', interiorCeilings:'no', interiorTrim:'no', interiorDoors:'none' }],
};
for (const [name,[lo,hi,p]] of Object.entries(T)) {
  const e = calculateEstimate(mk(p));
  const mult = getRegionalMultiplier('37201').multiplier;
  const ok = e.total >= lo*mult*0.9 && e.total <= hi*mult*1.1;
  console.log(name.padEnd(36), ('$'+e.total).padStart(8), `bench $${lo}-${hi} x${mult}`, ok?'ok':'<<<<', e.lineItems.slice(0,3).map(l=>l.description.slice(0,28)+':'+l.amount).join(' ; '));
}
