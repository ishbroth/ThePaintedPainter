import { CHAT_STATE_KEY } from './chatEstimator/persistence';
import { ZIP3_CENTROIDS } from './geo/zip3Centroids';

/** Where the map opens when nobody is placed yet: the whole US. */
export const US_VIEW = { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 };
/** Roughly a metro area. */
export const LOCAL_ZOOM = 10;

/** The ZIP the customer gave the estimator in this tab, if any. */
export function estimatorZip(): string | null {
  try {
    const raw = sessionStorage.getItem(CHAT_STATE_KEY);
    if (!raw) return null;
    const zip = String(JSON.parse(raw)?.state?.ctx?.zipCode ?? '').trim();
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch {
    return null;
  }
}

/** Where a ZIP is on the map: Google's geocoder when it answers, otherwise the rough center of its 3-digit area. */
export async function zipToLatLng(zip: string): Promise<{ lat: number; lng: number } | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  try {
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ address: zip, componentRestrictions: { country: 'US', postalCode: zip } });
    const loc = results?.[0]?.geometry?.location;
    if (loc) return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    // geocoding unavailable (API not enabled for this key, quota...): fall through to the rough position
  }
  const approx = ZIP3_CENTROIDS[zip.slice(0, 3)];
  return approx ? { lat: approx[0], lng: approx[1] } : null;
}
