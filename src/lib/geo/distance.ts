// ============================================================================
// ZIP-code distance
// ============================================================================
// Painter matching needs to know "is this painter actually within range of
// the job," not just "same 3-digit ZIP prefix" (which was the previous,
// broken check — see painterMatcher.ts history). This computes real
// straight-line distance in miles between two ZIP codes.
//
// PAINTER_ZIP_COORDS holds precise lat/lng for the fake painter roster's
// fixed ZIP codes (looked up once from the 'zipcodes' npm package). Any
// other ZIP (i.e. the job's ZIP, which is arbitrary) falls back to its
// 3-digit-prefix centroid from zip3Centroids.ts — accurate to a city/region,
// not a rooftop, but plenty for a "is this painter roughly nearby" gate.
// ============================================================================

import { ZIP3_CENTROIDS } from './zip3Centroids';

/** Precise coordinates for the fake painter roster's ZIP codes. */
export const PAINTER_ZIP_COORDS: Record<string, [number, number]> = {
  '10001': [40.7484, -73.9967],
  '15201': [40.4752, -79.9528],
  '19101': [40.0018, -75.1179],
  '23219': [37.5463, -77.4378],
  '27601': [35.7727, -78.6324],
  '28202': [35.229, -80.8419],
  '29401': [32.7795, -79.9371],
  '30301': [33.8444, -84.4741],
  '32099': [30.3375, -81.7686],
  '32801': [28.5399, -81.3727],
  '33101': [25.7791, -80.1978],
  '33601': [27.9961, -82.582],
  '35203': [33.521, -86.8066],
  '37201': [36.1657, -86.7781],
  '38101': [35.1495, -90.049],
  '40201': [38.189, -85.6768],
  '43085': [40.0999, -83.0157],
  '44101': [41.5234, -81.5996],
  '45201': [39.1668, -84.5382],
  '46201': [39.775, -86.1093],
  '50301': [41.6727, -93.5722],
  '53202': [43.0506, -87.8968],
  '55401': [44.9835, -93.2683],
  '60601': [41.8858, -87.6181],
  '63101': [38.6346, -90.1913],
  '64101': [39.1024, -94.5986],
  '68101': [41.2586, -95.9378],
  '70112': [29.9605, -90.0753],
  '73101': [35.4916, -97.5628],
  '75201': [32.7904, -96.8044],
  '77001': [29.8131, -95.3098],
  '78201': [29.4711, -98.5356],
  '78701': [30.2713, -97.7426],
  '80201': [39.7263, -104.8568],
  '83701': [43.6038, -116.2729],
  '84101': [40.7559, -111.8967],
  '85001': [33.4484, -112.074],
  '85701': [32.2139, -110.9694],
  '87101': [35.1996, -106.6448],
  '89101': [36.1721, -115.1224],
  '90001': [33.9731, -118.2479],
  '94102': [37.7813, -122.4167],
  '95110': [37.3391, -121.9016],
  '95814': [38.5804, -121.4922],
  '96801': [21.3278, -157.8294],
  '97201': [45.5078, -122.6897],
  '98101': [47.6114, -122.3305],
  '99501': [61.2116, -149.8761],
  '06101': [41.7801, -72.6771],
  '05401': [44.484, -73.2199],
};

function coordsForZip(zip: string): [number, number] | null {
  if (!/^\d{5}$/.test(zip)) return null;
  if (PAINTER_ZIP_COORDS[zip]) return PAINTER_ZIP_COORDS[zip];
  return ZIP3_CENTROIDS[zip.slice(0, 3)] ?? null;
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Straight-line distance in miles between two ZIP codes, or null if either can't be resolved. */
export function zipDistanceMiles(zipA: string, zipB: string): number | null {
  const a = coordsForZip(zipA);
  const b = coordsForZip(zipB);
  if (!a || !b) return null;
  return haversineMiles(a, b);
}
