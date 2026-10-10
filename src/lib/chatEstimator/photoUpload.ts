import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';
import type { PhotoAssessment } from './chatEngine';

const BUCKET = 'quote-photos';

/** The popup takes up to this many photos. */
export const MAX_POPUP_PHOTOS = 5;
/** Longest side after shrinking, and the quality it is saved at: a room photo comes out around 200 to 500 KB. */
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;
/** Photos bigger than this (before shrinking) are refused. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Shrinks a photo (longest side 1600px, JPEG) so it is cheap to upload, store and send to painters. */
export async function compressImage(file: File): Promise<File> {
  if (file.size > MAX_INPUT_BYTES) throw new Error('too large');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  let quality = JPEG_QUALITY;
  let blob: Blob | null = null;
  for (let i = 0; i < 3; i++) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= 900 * 1024) break;
    quality -= 0.15;
  }
  if (!blob) throw new Error('could not shrink');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

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
