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

// ---------------------------------------------------------------------------
// Exact ZIP coordinates
// ---------------------------------------------------------------------------
// The 3-digit-prefix centers above are only a fallback. getZipCoords looks each ZIP up once with Google's
// Geocoding API and remembers it in zip_geocodes, so every later match uses the real position of the ZIP.
// A ZIP that can't be looked up (no key yet, or a Google error) falls back to its prefix center for that
// call and is retried next time.

export type Coords = [number, number]

// deno-lint-ignore no-explicit-any
type Supabase = any

const MAX_LOOKUPS_PER_CALL = 30

async function googleZipLookup(zip: string): Promise<Coords | null> {
  const key = Deno.env.get('GOOGLE_GEOCODING_API_KEY') ?? Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!key) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?components=${encodeURIComponent(`postal_code:${zip}|country:US`)}&key=${encodeURIComponent(key)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const loc = json?.results?.[0]?.geometry?.location
    if (json?.status === 'OK' && typeof loc?.lat === 'number' && typeof loc?.lng === 'number') return [loc.lat, loc.lng]
    if (json?.status && json.status !== 'ZERO_RESULTS') console.error('geocode status:', json.status, json.error_message ?? '')
    return null
  } catch (err) {
    console.error('geocode failed:', err)
    return null
  }
}

/** Coordinates for each ZIP: exact when known (cached or just looked up), otherwise the ZIP's prefix center. */
export async function getZipCoords(supabase: Supabase, zips: string[]): Promise<Map<string, Coords>> {
  const wanted = [...new Set(zips.map((z) => String(z ?? '').trim().slice(0, 5)).filter((z) => /^\d{5}$/.test(z)))]
  const out = new Map<string, Coords>()
  if (wanted.length === 0) return out

  const { data: cached } = await supabase.from('zip_geocodes').select('zip, latitude, longitude').in('zip', wanted)
  for (const row of (cached ?? []) as { zip: string; latitude: number; longitude: number }[]) out.set(row.zip, [row.latitude, row.longitude])

  const missing = wanted.filter((z) => !out.has(z))
  const toLookUp = missing.slice(0, MAX_LOOKUPS_PER_CALL)
  const found = await Promise.all(toLookUp.map(async (z) => [z, await googleZipLookup(z)] as const))
  const fresh: { zip: string; latitude: number; longitude: number }[] = []
  for (const [z, c] of found) {
    if (c) {
      out.set(z, c)
      fresh.push({ zip: z, latitude: c[0], longitude: c[1] })
    }
  }
  if (fresh.length > 0) await supabase.from('zip_geocodes').upsert(fresh, { onConflict: 'zip' })

  for (const z of wanted) {
    if (!out.has(z)) {
      const approx = coordsForZip(z)
      if (approx) out.set(z, approx)
    }
  }
  return out
}

/** Straight-line miles between two ZIPs using coordinates from getZipCoords; null when either is unknown. */
export function milesBetweenZips(coords: Map<string, Coords>, zipA: string, zipB: string): number | null {
  const a = coords.get(String(zipA ?? '').trim().slice(0, 5))
  const b = coords.get(String(zipB ?? '').trim().slice(0, 5))
  if (!a || !b) return null
  return haversineMiles(a, b)
}
