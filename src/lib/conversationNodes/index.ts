import type { ConversationNode } from '../types';
import { startNodes } from './startNodes';
import { interiorNodes } from './interiorNodes';
import { exteriorNodes } from './exteriorNodes';
import { prepWorkNodes } from './prepWorkNodes';
import { propertyNodes } from './propertyNodes';
import { specialtyNodes } from './specialtyNodes';
import { contactNodes } from './contactNodes';

export const allNodes: Record<string, ConversationNode> = {
  ...startNodes,
  ...interiorNodes,
  ...exteriorNodes,
  ...prepWorkNodes,
  ...propertyNodes,
  ...specialtyNodes,
  ...contactNodes,
};

// Ordered list of all node IDs for progress tracking
export const nodeOrder: string[] = [
  // Start + Smart Qualifiers
  'welcome', 'zip_code', 'year_built', 'property_type', 'project_type',
  'project_condition', 'stained_wood', 'bedroom_count',
  // Interior
  'interior_scope', 'interior_rooms',
  'interior_walls', 'interior_wall_texture', 'interior_accent_walls',
  'interior_ceilings', 'interior_ceiling_type',
  'interior_trim', 'interior_trim_condition',
  'interior_crown_molding', 'interior_wainscoting',
  'interior_doors', 'interior_door_count', 'interior_door_types',
  'interior_door_material', 'interior_door_frames',
  'interior_windows', 'interior_window_count', 'interior_window_types',
  'interior_cabinets', 'interior_cabinet_locations', 'interior_cabinet_scope',
  'interior_closets', 'interior_closet_count', 'interior_closet_shelving',
  'interior_stairways', 'interior_stairway_count', 'interior_stairway_details',
  'interior_railing_material',
  // Specialty Services
  'interior_specialty',
  'interior_fireplace_type',
  'interior_beam_length', 'interior_beam_location',
  'interior_builtin_count',
  'interior_epoxy_type',
  'interior_furniture',
  'interior_brick_treatment', 'interior_brick_sqft',
  'interior_shutters', 'interior_color_change',
  // Exterior
  'exterior_scope', 'exterior_siding', 'exterior_stucco_condition',
  'exterior_trim', 'exterior_soffits',
  'exterior_shutters', 'exterior_shutter_count',
  'exterior_garage_door', 'exterior_entry_door',
  'exterior_railings', 'exterior_railing_type', 'exterior_railing_material',
  'exterior_balconies', 'exterior_balcony_count',
  'exterior_deck', 'exterior_deck_size',
  'exterior_fence', 'exterior_fence_size',
  'exterior_gutters', 'exterior_foundation',
  'exterior_windows', 'exterior_window_count',
  'exterior_overhangs', 'exterior_access',
  'exterior_color_change', 'exterior_condition',
  // Additional Details
  'additional_details',
  // Prep
  'prep_overview', 'prep_caulking', 'prep_drywall', 'prep_wood_rot',
  'prep_wallpaper_rooms', 'prep_popcorn_rooms',
  // Property
  'property_sqft', 'property_stories', 'property_ceiling_height',
  'property_occupancy', 'property_utilities', 'property_hoa',
  // Specialty
  'specialty_check', 'specialty_warning',
  // Contact
  'contact_name', 'contact_phone', 'contact_email', 'contact_notes',
  // Result
  'result',
];
