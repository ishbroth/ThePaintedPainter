import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabaseUrl } from '../../lib/supabase';

interface DashboardData {
  companyName: string;
  offers: { id: string; zip: string | null; offerSentAt: string | null }[];
  confirmed: { id: string; status: string; phaseLabel: string | null; confirmedAt: string | null; acceptedAt: string | null }[];
  completed: { id: string; phaseLabel: string | null; completedAt: string | null }[];
  totalEarnings: number;
  rating: { avgRating: number; reviewCount: number };
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  icon: string;
  timestamp: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function buildActivity(data: DashboardData): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const offer of data.offers) {
    if (!offer.offerSentAt) continue;
    items.push({
      id: `offer-${offer.id}`,
      text: `New job offer received${offer.zip ? ` in ${offer.zip}` : ''}`,
      icon: '\u{1F4E9}',
      time: formatWhen(offer.offerSentAt),
      timestamp: new Date(offer.offerSentAt).getTime(),
    });
  }
  for (const job of data.confirmed) {
    const ts = job.confirmedAt ?? job.acceptedAt;
    if (!ts) continue;
    items.push({
      id: `confirmed-${job.id}`,
      text: job.confirmedAt
        ? `Deposit received — ${job.phaseLabel || 'job'} confirmed`
        : `You accepted ${job.phaseLabel || 'a job'}`,
      icon: '✅',
      time: formatWhen(ts),
      timestamp: new Date(ts).getTime(),
    });
  }
  for (const job of data.completed) {
    if (!job.completedAt) continue;
    items.push({
      id: `completed-${job.id}`,
      text: `${job.phaseLabel || 'Job'} marked as completed`,
      icon: '\u{1F3C1}',
      time: formatWhen(job.completedAt),
      timestamp: new Date(job.completedAt).getTime(),
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
}

export default function PainterDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${supabaseUrl}/functions/v1/get-painter-projects`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load dashboard');
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (loading) return <p className="text-[var(--text-secondary)]">Loading your dashboard…</p>;
  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!data) return null;

  const activeJobs = data.confirmed.length;
  const totalJobs = activeJobs + data.completed.length;
  const activity = buildActivity(data);

  const stats = [
    { label: 'Total Jobs', value: String(totalJobs), icon: '\u{1F3E0}' },
    { label: 'Active Jobs', value: String(activeJobs), icon: '\u{1F528}' },
    { label: 'Average Rating', value: data.rating.reviewCount > 0 ? data.rating.avgRating.toFixed(1) : '—', icon: '⭐' },
    { label: 'Total Reviews', value: String(data.rating.reviewCount), icon: '\u{1F4AC}' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Welcome back, {data.companyName}</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Here is an overview of your painting business.
        {data.totalEarnings > 0 && <> You've earned <strong className="text-[var(--accent)]">{currency(data.totalEarnings)}</strong> through The Painted Painter.</>}
      </p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-sm text-[var(--text-secondary)]">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-[var(--text-faint)] text-sm">No activity yet — new job offers will show up here.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                <span className="text-xl mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{item.text}</p>
                  <p className="text-xs text-[var(--text-faint)] mt-1">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
