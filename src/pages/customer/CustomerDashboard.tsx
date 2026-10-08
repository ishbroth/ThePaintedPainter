import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import { supabaseUrl } from '../../lib/supabase';

interface Project {
  id: string;
  status: string;
  price: number | null;
  phaseLabel: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  painter: { company_name: string } | null;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function CustomerDashboard() {
  const { profile, session } = useAuth();
  const displayName = profile?.display_name ?? 'Customer';

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${supabaseUrl}/functions/v1/get-my-projects`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load projects');
        setProjects(data.projects);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const activeProjects = (projects ?? []).filter((p) => p.status === 'confirmed' || p.status === 'painter_accepted');
  const completedProjects = (projects ?? []).filter((p) => p.status === 'completed');
  const totalInvested = (projects ?? []).reduce((sum, p) => sum + (p.price ?? 0), 0);

  const activity = (projects ?? [])
    .flatMap((p) => {
      const items: { id: string; text: string; timestamp: number; time: string }[] = [];
      if (p.confirmedAt) {
        items.push({
          id: `${p.id}-confirmed`,
          text: `Painter confirmed for ${p.phaseLabel || 'your project'}${p.painter ? ` — ${p.painter.company_name}` : ''}`,
          timestamp: new Date(p.confirmedAt).getTime(),
          time: formatWhen(p.confirmedAt),
        });
      }
      if (p.completedAt) {
        items.push({
          id: `${p.id}-completed`,
          text: `${p.phaseLabel || 'Your project'} was marked complete`,
          timestamp: new Date(p.completedAt).getTime(),
          time: formatWhen(p.completedAt),
        });
      }
      return items;
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 6);

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Welcome back!</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Hi {displayName}, here is an overview of your painting projects.
      </p>

      {error && <p className="text-[var(--danger)] mb-6">{error}</p>}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <p className="text-[var(--text-secondary)] text-sm mb-1">Active Projects</p>
          <p className="text-3xl font-bold text-[var(--accent)]">
            {loading ? '—' : activeProjects.length}
          </p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <p className="text-[var(--text-secondary)] text-sm mb-1">Completed Projects</p>
          <p className="text-3xl font-bold text-green-400">
            {loading ? '—' : completedProjects.length}
          </p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <p className="text-[var(--text-secondary)] text-sm mb-1">Total Invested</p>
          <p className="text-3xl font-bold text-[var(--accent-blue)]">
            {loading ? '—' : currency(totalInvested)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-10">
        <Link
          to="/"
          className="px-6 py-3 bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
        >
          Get a New Price
        </Link>
        <Link
          to="/painters-map"
          className="px-6 py-3 border border-[var(--accent)] text-[var(--accent)] font-semibold rounded-lg hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] transition-colors"
        >
          Find Painters
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Recent Activity</h2>
        {loading ? (
          <p className="text-[var(--text-secondary)]">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="text-[var(--text-faint)]">No activity yet — once a painter accepts and confirms a job, it'll show up here.</p>
        ) : (
          <ul className="space-y-4">
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0"
              >
                <p className="text-[var(--text-secondary)]">{item.text}</p>
                <span className="text-[var(--text-faint)] text-sm whitespace-nowrap ml-4">
                  {item.time}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
