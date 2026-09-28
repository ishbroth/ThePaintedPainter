import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';
import type { PhotoAssessment } from './chatEngine';

const BUCKET = 'quote-photos';

/** Uploads a photo the customer picked/took and returns its public URL. */
export async function uploadQuotePhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Asks the analyze-quote-photo edge function for a visual severity/scope
 * read on an uploaded photo. Best-effort — returns null on any failure
 * (unreachable, rate-limited, malformed) so the caller can just skip the
 * pricing refinement rather than treat it as an error; the photo itself is
 * already attached regardless of whether this succeeds.
 */
export async function analyzeQuotePhoto(
  photoUrl: string,
  description: string,
  label: string,
): Promise<PhotoAssessment | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/analyze-quote-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoUrl, description, label }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
