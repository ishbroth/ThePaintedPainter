// ZIP code -> city name, so the estimator can say "ZIP 91941, La Mesa" back to the customer.
// Uses the free zippopotam.us lookup (no key). It is a nicety: if it can't be reached in a couple of seconds, nothing is said.

const cache = new Map<string, string>();

export async function lookupZipCity(zip: string): Promise<string> {
  if (!/^\d{5}$/.test(zip)) return '';
  const cached = cache.get(zip);
  if (cached !== undefined) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: controller.signal });
    if (!res.ok) {
      cache.set(zip, '');
      return '';
    }
    const data = (await res.json()) as { places?: { 'place name'?: string }[] };
    const city = data.places?.[0]?.['place name']?.trim() ?? '';
    cache.set(zip, city);
    return city;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}
