// Straight-line distance between two ZIP codes, using each ZIP's 3-digit-prefix
// centroid (accurate to a city/region — plenty for "is this painter nearby").
// Shared by submit-quote-claim (who gets a job offer) and painter-results (who
// is shown to a customer) so both always agree.

import { ZIP3_CENTROIDS } from './zip3Centroids.ts'

function coordsForZip(zip: string): [number, number] | null {
  if (!/^\d{5}$/.test(zip)) return null
  return ZIP3_CENTROIDS[zip.slice(0, 3)] ?? null
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

export function zipDistanceMiles(zipA: string, zipB: string): number | null {
  const a = coordsForZip(zipA)
  const b = coordsForZip(zipB)
  if (!a || !b) return null
  return haversineMiles(a, b)
}
