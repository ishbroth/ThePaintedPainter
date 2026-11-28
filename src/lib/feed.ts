// The painting feed: articles about painting (from free public feeds, gathered by the news-feed function), featured painters with a gallery photo, and
// reviews customers wrote, mixed into one list. For now the painters and reviews are the demonstration ones (see supabase/functions/news-feed/index.ts).

import { supabaseUrl, supabaseAnonKey } from './supabase';

export interface FeedArticle { id: string; title: string; snippet: string; url: string; source: string; image: string | null }
export interface FeedPainter {
  id: string;
  companyName: string;
  city: string | null;
  state: string | null;
  photo: { url: string; caption: string | null };
  rating: { average: number; count: number };
  quote: { text: string; reviewer: string } | null;
}
export interface FeedReview {
  id: string;
  rating: number;
  title: string | null;
  text: string;
  reviewer: string;
  painter: { id: string; companyName: string; city: string | null; state: string | null };
}
export interface FeedData { articles: FeedArticle[]; painters: FeedPainter[]; reviews: FeedReview[] }

export type FeedItem =
  | { kind: 'article'; key: string; article: FeedArticle }
  | { kind: 'painter'; key: string; painter: FeedPainter }
  | { kind: 'review'; key: string; review: FeedReview };

export async function fetchFeed(): Promise<FeedData> {
  const res = await fetch(`${supabaseUrl}/functions/v1/news-feed`, { headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } });
  if (!res.ok) throw new Error('feed unavailable');
  const data = (await res.json()) as Partial<FeedData>;
  return { articles: data.articles ?? [], painters: data.painters ?? [], reviews: data.reviews ?? [] };
}

/** Articles with a featured painter and a customer review worked in between, in a steady rhythm, until everything is used. */
export function mixFeed(data: FeedData): FeedItem[] {
  const rhythm = ['article', 'article', 'painter', 'article', 'review', 'article', 'article', 'review', 'painter', 'article'] as const;
  const a = [...data.articles];
  const p = [...data.painters];
  const r = [...data.reviews];
  const out: FeedItem[] = [];
  for (let i = 0; a.length + p.length + r.length > 0; i++) {
    let slot: 'article' | 'painter' | 'review' = rhythm[i % rhythm.length];
    // a kind that has run out hands its slot to whatever is left
    if ((slot === 'article' && a.length === 0) || (slot === 'painter' && p.length === 0) || (slot === 'review' && r.length === 0)) slot = a.length > 0 ? 'article' : p.length > 0 ? 'painter' : 'review';
    if (slot === 'article') { const article = a.shift()!; out.push({ kind: 'article', key: 'a:' + article.id, article }); }
    else if (slot === 'painter') { const painter = p.shift()!; out.push({ kind: 'painter', key: 'p:' + painter.id, painter }); }
    else { const review = r.shift()!; out.push({ kind: 'review', key: 'r:' + review.id, review }); }
  }
  return out;
}
