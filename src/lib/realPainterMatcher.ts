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
  /** Signed proof that this price came from us; a claim is only accepted with it. */
  priceToken: string;
  /** Set when the painter is booked until later: the date they're next free. */
  availableFrom: string | null;
  /** Rating from reviews on The Painted Painter. */
  rating: { average: number | null; count: number };
  external: ExternalReview[];
  /** Portfolio photo URLs, newest first. */
  photos: string[];
  reasons: string[];
  /** The customer picked "Work with again" for this painter: listed first. */
  workedWithBefore?: boolean;
}

/** What became of the painter the customer asked to work with again. */
export interface PreferredPainterOutcome {
  id: string;
  companyName: string;
  status: 'listed' | 'unavailable';
  /** When unavailable, e.g. "is booked through your dates". */
  reason?: string;
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

export interface PainterResults {
  painters: PainterResult[];
  /** Mystery Painter: the baseline price and its signed token. */
  mystery: { price: number; priceToken: string };
  /** When the displayed prices stop being claimable (ms since epoch) — enforced by the server. */
  holdUntil: number;
  /** Estimated working days for the job. */
  duration: { days: number; low: number; high: number };
  preferred?: PreferredPainterOutcome;
}

/**
 * Approved, available painters near the job, nearest first, each with their own signed price.
 * `resumeToken` reloads a search from a "your painter declined" email.
 */
export async function fetchPainterResults(ctx: EstimatorContext, baseTotal: number, resumeToken?: string): Promise<PainterResults | null> {
  const { data, error } = await supabase.functions.invoke('painter-results', { body: { ctx, baseTotal, resumeToken } });
  if (error || !data?.painters) {
    console.error('Failed to fetch painters:', error ?? data);
    return null;
  }
  return data as PainterResults;
}

export async function fetchPainterDetail(painterId: string): Promise<PainterDetail | null> {
  const { data, error } = await supabase.functions.invoke('painter-detail', { body: { painterId } });
  if (error || !data || data.error) return null;
  return data as PainterDetail;
}
