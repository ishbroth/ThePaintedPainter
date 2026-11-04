import { renderToStaticMarkup } from 'react-dom/server';
import PriceBreakdown from '../src/components/results/PriceBreakdown';
import { makeInitialContext } from '../src/lib/chatEstimator/defaultContext';
import { buildPriceEditor } from '../src/lib/priceEditing';
const ctx = { ...makeInitialContext(), zipCode:'31406', projectType:'both' as const, interiorScope:'whole_house', squareFeet:1200, stories:2, sidingType:'aluminum', propertyType:'rental', interiorCeilings:'no', interiorTrim:'no', interiorDoors:'none', surfacesAddressed:true, prepWork:['power_washing'] };
const view = buildPriceEditor({ ctx, transcript: '' }, [], []);
const html = renderToStaticMarkup(<PriceBreakdown view={view} assumptions={[]} canEdit edited={false} onToggleItem={() => {}} onToggleRoom={() => {}} onSetField={() => {}} onReset={() => {}} />);
console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 900));
