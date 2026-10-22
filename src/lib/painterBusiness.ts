import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabaseUrl } from './supabase';

export interface BusinessCustomer {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  jobs: number;
  completedJobs: number;
  totalPaid: number;
  lastJobAt: string | null;
  lowestRating: number | null;
  projects: { id: string; label: string | null; status: string; amount: number; date: string | null; rating: number | null }[];
}

export interface BusinessData {
  companyName: string;
  income: {
    totalEarned: number;
    thisMonth: number;
    yearToDate: number;
    pipeline: number;
    completedJobs: number;
    averageJob: number;
    months: { month: string; earned: number; jobs: number }[];
  };
  schedule: {
    id: string;
    label: string | null;
    customerName: string | null;
    customerPhone: string | null;
    address: string;
    scheduledDate: string | null;
    scheduledEndDate: string | null;
    amount: number;
  }[];
  customers: BusinessCustomer[];
  rewards: {
    completedJobs: number;
    countedReviews: number;
    jobMilestones: number[];
    reviewMilestones: number[];
    earned: { kind: 'jobs' | 'reviews'; threshold: number; earned_at: string }[];
  };
}

export const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/** Loads the painter's schedule, customers, income and rewards from get-painter-business. */
export function usePainterBusiness() {
  const { session } = useAuth();
  const [data, setData] = useState<BusinessData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${supabaseUrl}/functions/v1/get-painter-business`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  return { data, error, loading };
}
