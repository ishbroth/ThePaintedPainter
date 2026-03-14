import type { EstimatorContext, JobSummary, JobScopeSection } from './types';

export function buildJobSummary(ctx: EstimatorContext, estimateRange: string): JobSummary {
  return {
    projectOverview: {
      propertyType: formatLabel(ctx.propertyType),
      projectType: formatLabel(ctx.projectType),
      squareFeet: ctx.squareFeet,
      stories: ctx.stories,
      yearBuilt: ctx.yearBuilt,
      location: ctx.zipCode ? `${ctx.state} ${ctx.zipCode}` : 'Not provided',
    },
    interiorScope: buildInteriorScope(ctx),
    exteriorScope: buildExteriorScope(ctx),
    prepWork: buildPrepWorkList(ctx),
    specialtyNeeds: ctx.specialtyReferrals,
    contactInfo: {
      name: ctx.contactName,
      phone: ctx.contactPhone,
      email: ctx.contactEmail,
      notes: ctx.contactNotes,
    },
    estimateRange,
    accessNotes: buildAccessNotes(ctx),
  };
}

function buildInteriorScope(ctx: EstimatorContext): JobScopeSection | null {
  if (ctx.projectType === 'exterior') return null;

  const details: string[] = [];

  details.push(`Scope: ${ctx.interiorScope === 'whole_house' ? 'Whole house' : 'Specific rooms'}`);

  if (ctx.selectedRooms.length > 0) {
    details.push(`Rooms: ${ctx.selectedRooms.map(formatLabel).join(', ')}`);
  }

  if (ctx.interiorWalls === 'yes') details.push('Walls: Yes');
  if (ctx.accentWalls === 'yes') details.push('Accent walls: Yes');
  if (ctx.interiorCeilings === 'yes') {
    details.push(`Ceilings: Yes (${formatLabel(ctx.ceilingType || 'flat')})`);
  }
  if (ctx.interiorTrim === 'yes') details.push('Trim & baseboards: Yes');
  if (ctx.crownMolding === 'yes') details.push('Crown molding: Yes');
  if (ctx.wainscoting === 'yes') details.push('Wainscoting: Yes');

  if (ctx.interiorDoors !== 'none') {
    const count = ctx.doorCount ? ` (${ctx.doorCount})` : '';
    const types = ctx.doorTypes.length > 0 ? ` - ${ctx.doorTypes.map(formatLabel).join(', ')}` : '';
    details.push(`Doors${count}${types}`);
    if (ctx.doorFrames === 'yes') details.push('Door frames: Yes');
  }

  if (ctx.interiorWindows !== 'none') {
    const count = ctx.windowCount ? ` (${ctx.windowCount})` : '';
    details.push(`Window frames/sills${count}`);
  }

  if (ctx.cabinetLocations.length > 0) {
    details.push(`Cabinets: ${ctx.cabinetLocations.map(formatLabel).join(', ')}`);
  }

  if (ctx.closets !== 'none') {
    const count = ctx.closetCount ? ` (${ctx.closetCount})` : '';
    details.push(`Closets: ${formatLabel(ctx.closets)}${count}`);
  }

  if (ctx.stairways === 'yes') {
    const count = ctx.stairwayCount ? ` (${ctx.stairwayCount})` : '';
    details.push(`Stairways${count}: ${formatLabel(ctx.stairwayDetails || 'walls_only')}`);
  }

  if (ctx.interiorShutters === 'yes') details.push('Interior shutters: Yes');

  details.push(`Color change: ${formatLabel(ctx.interiorColorChange || 'same')}`);

  if (ctx.ceilingHeight && ctx.ceilingHeight !== 'standard') {
    details.push(`Ceiling height: ${formatLabel(ctx.ceilingHeight)}`);
  }

  return { scope: ctx.interiorScope || 'whole_house', details };
}

function buildExteriorScope(ctx: EstimatorContext): JobScopeSection | null {
  if (ctx.projectType === 'interior') return null;

  const details: string[] = [];

  details.push(`Scope: ${ctx.exteriorScope === 'full' ? 'Full exterior' : 'Partial / touch-up'}`);
  details.push(`Siding: ${formatLabel(ctx.sidingType || 'stucco')}`);

  if (ctx.exteriorTrim === 'yes') details.push('Trim & fascia: Yes');
  if (ctx.soffitsEaves === 'yes') details.push('Soffits & eaves: Yes');

  if (ctx.exteriorShutters === 'yes') {
    const count = ctx.exteriorShutterCount ? ` (${ctx.exteriorShutterCount})` : '';
    details.push(`Shutters${count}: Yes`);
  }

  if (ctx.garageDoor !== 'none' && ctx.garageDoor) {
    details.push(`Garage door: ${formatLabel(ctx.garageDoor)}`);
  }
  if (ctx.entryDoor === 'yes') details.push('Entry door: Yes');

  if (ctx.railings === 'yes') {
    details.push(`Railings: ${formatLabel(ctx.railingType || 'simple')}`);
  }
  if (ctx.balconies === 'yes') {
    const count = ctx.balconyCount ? ` (${ctx.balconyCount})` : '';
    details.push(`Balconies${count}: Yes`);
  }
  if (ctx.deck === 'yes') {
    details.push(`Deck: ${formatLabel(ctx.deckSize || 'medium')}`);
  }
  if (ctx.fence === 'yes') {
    const ft = ctx.fenceLinearFeet ? ` (${ctx.fenceLinearFeet} ft)` : '';
    details.push(`Fence${ft}: Yes`);
  }
  if (ctx.gutters === 'yes') details.push('Gutters & downspouts: Yes');
  if (ctx.foundation === 'yes') details.push('Foundation walls: Yes');
  if (ctx.exteriorWindows !== 'none' && ctx.exteriorWindows) {
    const count = ctx.exteriorWindowCount ? ` (${ctx.exteriorWindowCount})` : '';
    details.push(`Exterior windows${count}: ${formatLabel(ctx.exteriorWindows)}`);
  }
  if (ctx.overhangs === 'yes') details.push('Overhangs / patio covers: Yes');

  details.push(`Color change: ${formatLabel(ctx.exteriorColorChange || 'same')}`);
  details.push(`Condition: ${formatLabel(ctx.exteriorCondition || 'good')}`);

  if (ctx.accessRestrictions !== 'none' && ctx.accessRestrictions) {
    details.push(`Access restrictions: ${formatLabel(ctx.accessRestrictions)}`);
  }

  return { scope: ctx.exteriorScope || 'full', details };
}

function buildPrepWorkList(ctx: EstimatorContext): string[] {
  const items: string[] = [];

  if (ctx.prepWork.includes('caulking')) {
    items.push(`Caulking: ${formatLabel(ctx.caulkingExtent || 'minor')}`);
  }
  if (ctx.prepWork.includes('stain_cover')) items.push('Painting over stain');
  if (ctx.prepWork.includes('drywall_repair')) {
    items.push(`Drywall repair: ${formatLabel(ctx.drywallRepairExtent || 'minor')}`);
  }
  if (ctx.prepWork.includes('wood_rot')) {
    items.push(`Wood rot repair: ${formatLabel(ctx.woodRotExtent || 'minor')}`);
  }
  if (ctx.prepWork.includes('wallpaper_removal')) {
    items.push(`Wallpaper removal: ${ctx.wallpaperRooms || 1} room(s)`);
  }
  if (ctx.prepWork.includes('popcorn_removal')) {
    items.push(`Popcorn ceiling removal: ${ctx.popcornCeilingRooms || 1} room(s)`);
  }
  if (ctx.prepWork.includes('power_washing')) items.push('Power washing');
  if (ctx.prepWork.includes('lead_test')) items.push('Lead paint testing');

  return items;
}

function buildAccessNotes(ctx: EstimatorContext): string {
  const notes: string[] = [];

  if (ctx.occupancy === 'occupied') notes.push('Property will be occupied during work');
  if (ctx.utilities === 'no') notes.push('Utilities may not be available');
  if (ctx.hoa === 'yes') notes.push('HOA approval may be required');
  if (ctx.accessRestrictions === 'significant') notes.push('Significant exterior access restrictions');
  if ((ctx.stories || 1) >= 3) notes.push('3+ story property - equipment needed');

  return notes.join('. ');
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
