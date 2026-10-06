// "Reviews elsewhere": client-side mirror of supabase/functions/_shared/externalReviews.ts,
// used to validate what a painter types before saving. The server re-cleans everything
// before it's shown to customers, so this is for helpful form errors, not security.

export type ExternalSource = 'google' | 'yelp' | 'facebook';

export const EXTERNAL_SOURCES: { key: ExternalSource; label: string; placeholder: string; hosts: string[] }[] = [
  { key: 'google', label: 'Google', placeholder: 'https://g.page/your-business or your Google Maps link', hosts: ['google.com', 'g.page', 'goo.gl', 'g.co'] },
  { key: 'yelp', label: 'Yelp', placeholder: 'https://www.yelp.com/biz/your-business', hosts: ['yelp.com'] },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/your-business', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
];

/** What the form holds per source: strings, since they come from inputs. */
export interface ExternalFormEntry {
  url: string;
  rating: string;
  count: string;
}
export type ExternalFormValue = Record<ExternalSource, ExternalFormEntry>;

export const emptyExternalForm = (): ExternalFormValue => ({
  google: { url: '', rating: '', count: '' },
  yelp: { url: '', rating: '', count: '' },
  facebook: { url: '', rating: '', count: '' },
});

/** Stored object -> form strings. */
export function toExternalForm(stored: unknown): ExternalFormValue {
  const out = emptyExternalForm();
  if (stored && typeof stored === 'object') {
    for (const { key } of EXTERNAL_SOURCES) {
      const e = (stored as Record<string, { url?: string; rating?: number | null; count?: number | null }>)[key];
      if (e) out[key] = { url: e.url ?? '', rating: e.rating != null ? String(e.rating) : '', count: e.count != null ? String(e.count) : '' };
    }
  }
  return out;
}

/** Returns an error message for the first problem, or null. Blank sources are fine. */
export function validateExternalForm(value: ExternalFormValue): string | null {
  for (const s of EXTERNAL_SOURCES) {
    const e = value[s.key];
    const url = e.url.trim();
    if (!url) {
      if (e.rating.trim() || e.count.trim()) return `Add your ${s.label} link, or clear its rating and review count.`;
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return `The ${s.label} link doesn't look like a web address.`;
    }
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || !s.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return `The ${s.label} link should be an https link on ${s.hosts[0]}.`;
    }
    if (e.rating.trim()) {
      const r = Number(e.rating);
      if (!isFinite(r) || r < 0 || r > 5) return `${s.label} rating must be between 0 and 5.`;
    }
    if (e.count.trim()) {
      const c = Number(e.count);
      if (!Number.isInteger(c) || c < 0) return `${s.label} review count must be a whole number.`;
    }
  }
  return null;
}

/** Form strings -> stored object (only sources with a link). */
export function fromExternalForm(value: ExternalFormValue): Record<string, { url: string; rating: number | null; count: number | null }> {
  const out: Record<string, { url: string; rating: number | null; count: number | null }> = {};
  for (const s of EXTERNAL_SOURCES) {
    const e = value[s.key];
    if (!e.url.trim()) continue;
    out[s.key] = {
      url: e.url.trim(),
      rating: e.rating.trim() ? Math.round(Number(e.rating) * 10) / 10 : null,
      count: e.count.trim() ? Number(e.count) : null,
    };
  }
  return out;
}
