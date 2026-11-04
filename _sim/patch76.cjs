const fs = require('fs');
const f = 'src/lib/chatEstimator/topics.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const pairs = [
  // project type
  ['"Quick one — interior, exterior, or both?"', '"Quick one, is this interior, exterior, or both?"'],
  ['"Interior, exterior, or the whole house inside and out?"', '"Are we painting the inside, the outside, or both?"'],
  ['"What are we tackling — inside, outside, or both?"', '"What are we tackling, the inside, the outside, or both?"'],
  ['"Just so I scope this right — inside, outside, or both?"', '"Just so I scope this right, is it inside, outside, or both?"'],
  // rooms
  ['"Got it — which room? Bedroom, living room, kitchen, bathroom, something else?"', '"Got it, which room?"'],
  ['"Which spaces are we covering — go ahead and rattle them off."', '"Which spaces are we covering?"'],
  ['"Give me the room list — bedrooms, living areas, whatever\'s getting painted."', '"What rooms are getting painted?"'],
  ['"What all needs paint? Just name the rooms."', '"What all needs paint?"'],
  ['"Which rooms are we painting? List as many as you like."', '"Which rooms are we painting?"'],
  // size
  ['"About how big is the space — total square footage?"', '"About how big is the space, in total square feet?"'],
  ['"About how big is the place? Square footage or bedroom count works — whatever you know."', '"About how big is the place?"'],
  ['"Roughly how big is it — square footage, or even just bedroom count if that\'s easier?"', '"Roughly how big is it?"'],
  ['"What\'s the size of the place? A square footage number is ideal, but bedroom count works too."', '"What\'s the size of the place?"'],
  ['"And about how many square feet is the place? Bedroom count alone can vary a lot in size, so a rough number helps me price it right."', '"And about how many square feet is the place?"'],
  ['"Got the bedroom count — do you also know roughly the square footage? It varies enough that a real number helps."', '"Got the bedroom count. Do you also know roughly how many square feet it is?"'],
  // surfaces
  ['"No trim, got it. What about the ceilings and the doors — are those getting painted, or staying as they are?"', '"No trim, got it. What about the ceilings and the doors, are those getting painted?"'],
  ['"No ceilings, got it. And the trim and doors — painted too, or staying as they are?"', '"No ceilings, got it. And the trim and doors, are those getting painted too?"'],
  ['"For the kitchen — walls, ceiling, trim, doors, and are the cabinets getting painted too?"', '"For the kitchen, what all is getting painted, and are the cabinets included?"'],
  ['`In that ${label}, are we doing just the walls, or walls + ceiling + trim + doors — or somewhere in between?`', '`In that ${label}, what all are we painting?`'],
  ['`For the ${label} — just walls, or the full package (ceiling, trim, doors too)?`', '`For the ${label}, are we painting just the walls, or more than that?`'],
  ['"Are we painting just the walls in those rooms, or the full package — walls, ceilings, trim, doors?"', '"What all are we painting in those rooms?"'],
  ['"For those rooms — just walls, or everything (ceilings, trim, doors included)?"', '"For those rooms, are we painting just the walls, or more than that?"'],
  ['"How much of each room — walls only, or the full walls/ceiling/trim/door package?"', '"How much of each room are we painting?"'],
  // trim
  ['"Quick one on the trim — is that just the baseboards, or does it also cover door frames/casings, closet shelving, or other woodwork like built-ins?"', '"Quick one on the trim, what does that include?"'],
  ['"When you say trim, do you mean baseboards only, or should I also price door frames, casings, or built-in shelving?"', '"When you say trim, what all does that cover?"'],
  ['"Just to price the trim right — baseboards alone, or also door frames/casings and any built-in woodwork?"', '"Just to price the trim right, what does it include?"'],
  // condition
  ['"How are the walls looking right now — smooth and ready, or any holes, cracks, wallpaper, popcorn ceilings, anything like that?"', '"How are the walls looking right now?"'],
  ['"What kind of shape is it in — clean and ready for paint, or are there repairs to deal with first?"', '"What kind of shape is it in?"'],
  ['"Any prep concerns I should know about — holes, wallpaper, popcorn ceilings, water stains, that sort of thing?"', '"Any prep concerns I should know about?"'],
  ['"Is it in good shape overall, or is there some damage/repair work mixed in?"', '"Is it in good shape overall?"'],
  // popcorn
  ['"For the popcorn ceiling removal — about how many rooms are we talking?"', '"For the popcorn ceiling removal, about how many rooms are we talking?"'],
  // ownership
  ['"Are you living here, or renting/selling it?"', '"Are you living here, or is it a rental or something you\'re selling?"'],
  ['"Is this your home, or a rental/listing?"', '"Is this your home, or a rental?"'],
  ['"Quick one — do you live here, or is it a rental or something you\'re selling?"', '"Quick one, do you live here, or is it a rental?"'],
  // commercial
  ['"Since it\'s a business — does this need to happen after hours or on weekends so it doesn\'t disrupt operations, or can the crew work during the day?"', '"Since it\'s a business, when can the crew work so it doesn\'t disrupt operations?"'],
  // color
  ['"Same color going back, or a different one? And if different — anything dramatic like dark-to-light?"', '"Is it the same color going back, or a different one?"'],
  ['"Sticking with the same color, or changing it up? Let me know if it\'s a big shift like dark to light."', '"Are you sticking with the same color, or changing it up?"'],
  ['"Are we matching the existing color or going with something new?"', '"Are we matching the existing color, or going with something new?"'],
  ['"How many colors total, roughly?"', '"Roughly how many colors?"'],
  // reno
  ['"Since it\'s a renovation: where are the other trades at? Drywall taped and textured, trim installed, primer done — or still in progress?"', '"Since it\'s a renovation, where are the other trades at?"'],
  ['"How far along are the other trades — is drywall/trim finished, or is stuff still being installed?"', '"How far along are the other trades?"'],
  ['"What stage is the space in — ready for paint, or are other contractors still working?"', '"What stage is the space in?"'],
  // siding
  ['"What\'s the exterior made of — stucco, wood, Hardie board, vinyl, brick, or a mix?"', '"What\'s the exterior made of?"'],
  ['"What material is the outside — stucco, wood, fiber cement, vinyl, brick, something else?"', '"What material is the outside?"'],
  // stories
  ['"Is the building single-story, two-story, or taller?"', '"How tall is the building?"'],
  ['"Is it single-story, two-story, or taller?"', '"How tall is the house?"'],
  ['"How tall is the place — how many stories?"', '"How many stories is the place?"'],
  // location
  ['"What ZIP code is the property in? Helps me calibrate local pricing."', '"What ZIP code is the property in?"'],
  ['"What\'s the ZIP code there? Rates vary quite a bit by area."', '"What\'s the ZIP code there?"'],
  ['"Where\'s this located — what ZIP code?"', '"Where\'s this located, what ZIP code?"'],
  // timeline and access
  ['pick(["Last thing — when would you like this done? (a specific date or range, ASAP, or tell me your dates are flexible)", "And what\'s the timeline on this — specific dates, any rush, or are your dates flexible?"], seed(c))', 'pick(["Last thing, when would you like this done?", "And what\'s the timeline on this?"], seed(c))'],
  ['pick(["Last thing — when would you like this done? (a specific date or range, ASAP, or tell me your dates are flexible)", "And what\'s the timeline — specific dates, any rush, or are your dates flexible?"], seed(c))', 'pick(["Last thing, when would you like this done?", "And what\'s the timeline?"], seed(c))'],
  ['"Last thing — will the space still be open/operating during the work, or empty?"', '"Last thing, will the space still be open during the work?"'],
  ['"Will the business still be running while we work, or will it be closed/vacant?"', '"Will the business still be running while we work?"'],
  ['"Last thing — will the property be occupied, furnished, or completely empty when we work?"', '"Last thing, will the property be occupied, furnished, or empty when we work?"'],
  ['"Will it be lived-in during the work, furnished but empty, or totally vacant?"', '"Will anyone be living there while we work?"'],
  ['"Last thing — when would you like this done, and will the business still be operating during the work, or closed/vacant?"', '"Last thing, when would you like this done, and will the business still be operating during the work?"'],
  ['"Last thing — when would you like this done (specific dates, ASAP, or flexible?), and will it be occupied / furnished / or empty when we work?"', '"Last thing, when would you like this done, and will anyone be there while we work?"'],
  ['"Two quick ones to wrap up — timeline, and will the place be occupied, furnished, or empty while we work?"', '"Two quick ones to wrap up, what\'s your timeline, and will anyone be there while we work?"'],
];
for (const [from, to] of pairs) {
  if (!t.includes(from)) { console.log('NOT FOUND:', from.slice(0, 70)); continue; }
  t = t.split(from).join(to);
}
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('done');
