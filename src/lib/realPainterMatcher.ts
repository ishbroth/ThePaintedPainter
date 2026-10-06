// ============================================================================
// Painter results (customer-facing)
// ============================================================================
// Matching, distance and each painter's price are computed on the server
// (supabase/functions/painter-results), so the browser never receives painter
// emails, phone numbers, license/policy numbers or their pricing answers. This
// file is just the typed client for the two functions:
//   painter-results  -> the listing cards (name, city, ratings, photos, price)
//   painter-detail   -> the expanded view of one painter (credentials, reviews…)
// ============================================================================

import type { EstimatorContext } from './types';
import { supabase } from './supabase';

export type ExternalSource = 'google' | 'yelp' | 'facebook';

/** Rating a painter reports from another site, with a link so customers can verify it. */
export interface ExternalReview {
  source: ExternalSource;
  url: string;
  rating: number | null;
  count: number | null;
}

export interface PainterResult {
  id: string;
  companyName: string;
  city: string;
  state: string;
  distanceMiles: number;
  /** Guaranteed price shown for (and charged if the customer picks) this painter. */
  price: number;
  /** Rating from reviews on The Painted Painter. */
  rating: { average: number | null; count: number };
  external: ExternalReview[];
  /** Portfolio photo URLs, newest first. */
  photos: string[];
  reasons: string[];
}

export interface PainterReview {
  rating: number;
  title: string | null;
  body: string | null;
  reviewer: string;
  date: string;
}

export interface PainterDetail {
  companyName: string;
  city: string;
  state: string;
  bio: string | null;
  yearsInBusiness: number | null;
  crewSize: number | null;
  jobsPerMonth: number | null;
  maxProjectSize: string | null;
  services: string[];
  offersEstimates: boolean | null;
  warranty: string | null;
  credentials: {
    license: { has: boolean; state: string | null; expires: string | null };
    insurance: { has: boolean; company: string | null; coverage: string | null };
    bond: { has: boolean; company: string | null; amount: string | null };
    workersComp: { has: boolean; carrier: string | null };
    certifications: string[];
  };
  external: ExternalReview[];
  photos: { url: string; caption: string }[];
  rating: { average: number | null; count: number };
  reviews: PainterReview[];
}

/** Approved painters near the job, nearest first, each with their own price. */
export async function fetchPainterResults(ctx: EstimatorContext, baseTotal: number): Promise<PainterResult[]> {
  const { data, error } = await supabase.functions.invoke('painter-results', { body: { ctx, baseTotal } });
  if (error || !data?.painters) {
    console.error('Failed to fetch painters:', error ?? data);
    return [];
  }
  return data.painters as PainterResult[];
}

export async function fetchPainterDetail(painterId: string): Promise<PainterDetail | null> {
  const { data, error } = await supabase.functions.invoke('painter-detail', { body: { painterId } });
  if (error || !data || data.error) return null;
  return data as PainterDetail;
}
