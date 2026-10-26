import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** One painter on the network, as shown on the map and the browse list (nothing private). */
export interface NetworkPainter {
  id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number;
  longitude: number;
  years_in_business: number | null;
  crew_size: number | null;
  is_licensed: boolean;
  is_insured: boolean;
  is_bonded: boolean;
  service_types: string[];
  is_demo: boolean;
  avg_rating: number;
  review_count: number;
}

const COLUMNS = 'id, company_name, city, state, zip_code, latitude, longitude, years_in_business, crew_size, is_licensed, is_insured, is_bonded, service_types, is_demo, avg_rating, review_count';

/**
 * Everyone on the network, live: a painter appears the moment they are approved and disappears the moment they are removed, with
 * no refresh (the map_painters table is kept in step with painters by the database and broadcast over realtime).
 */
export function useNetworkPainters(): { painters: NetworkPainter[]; loading: boolean } {
  const [painters, setPainters] = useState<NetworkPainter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase
        .from('map_painters')
        .select(COLUMNS)
        .then(({ data }) => {
          if (cancelled) return;
          setPainters((data as NetworkPainter[]) ?? []);
          setLoading(false);
        });

    load();
    const channel = supabase
      .channel('network-painters')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_painters' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          setPainters((prev) => prev.filter((p) => p.id !== id));
          return;
        }
        const row = payload.new as NetworkPainter;
        setPainters((prev) => (prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row]));
      })
      // a dropped connection can miss changes, so catch up whenever it comes back
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { painters, loading };
}
