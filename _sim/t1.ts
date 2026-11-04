import { extractCeilingHeight, extractAll } from '../src/lib/chatEstimator/extractors.ts';
console.log(extractCeilingHeight('the fence is 10 ft and there is a friendly dog', true), extractCeilingHeight('the fence is 10 ft and there is a friendly dog', false));
const r: any = extractAll('the fence is 10 ft and there is a friendly dog', {} as any, null as any);
console.log(JSON.stringify(r?.patch?.ceilingHeight ?? r));
