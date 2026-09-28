import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabaseUrl } from '../../lib/supabase';

interface Project {
  id: string;
  status: string;
  price: number | null;
  address: string;
  scheduledDate: string | null;
  preferredDate: string | null;
  phaseLabel: string | null;
  parentQuoteId: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  reviewToken: string | null;
  reviewSubmitted: boolean;
  painter: { company_name: string; owner_name: string; email: string; phone: string } | null;
}

const currency = (n: number | null) =>
  n == null ? 'Pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const statusLabels: Record<string, string> = {
  painter_accepted: 'Awaiting Deposit',
  confirmed: 'Confirmed',
  completed: 'Completed',
};

const statusColors: Record<string, string> = {
  painter_accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/40',
  completed: 'bg-blue-500/20 text-[var(--accent-blue)] border-blue-500/40',
};

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-[var(--text-primary)] font-semibold text-lg">
          {project.phaseLabel || 'Painting Project'}
        </h3>
        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[project.status] ?? statusColors.confirmed}`}>
          {statusLabels[project.status] ?? project.status}
        </span>
      </div>
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        {project.address && (
          <p><span className="text-[var(--text-faint)]">Location:</span> {project.address}</p>
        )}
        {project.painter && (
          <p>
            <span className="text-[var(--text-faint)]">Painter:</span> {project.painter.company_name}
            {' — '}
            <a href={`mailto:${project.painter.email}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)]">{project.painter.email}</a>
            {' · '}
            <a href={`tel:${project.painter.phone}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)]">{project.painter.phone}</a>
          </p>
        )}
        <p><span className="text-[var(--text-faint)]">Price:</span> <span className="text-[var(--text-primary)]">{currency(project.price)}</span></p>
        <p>
          <span className="text-[var(--text-faint)]">
            {project.status === 'completed' ? 'Completed:' : project.scheduledDate ? 'Scheduled:' : 'Requested date:'}
          </span>{' '}
          {project.status === 'completed'
            ? (project.completedAt ? new Date(project.completedAt).toLocaleDateString() : 'Recently')
            : (project.scheduledDate || project.preferredDate || 'Not yet set')}
        </p>
      </div>

      {project.status === 'completed' && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {project.reviewSubmitted ? (
            <span className="text-sm text-[var(--text-faint)]">✓ You reviewed this painter — thanks for the feedback!</span>
          ) : project.reviewToken ? (
            <Link
              to={`/leave-review?token=${project.reviewToken}`}
              className="inline-block px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              Rate this painter
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function CustomerProjects() {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This page is always behind ProtectedRoute, so a session should already
    // be present by the time it renders; if AuthProvider hasn't finished
    // loading it yet on the very first render, this effect just re-runs once
    // `session` shows up (it's in the dependency array below).
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

  const upcoming = (projects ?? []).filter((p) => p.status !== 'completed');
  const completed = (projects ?? []).filter((p) => p.status === 'completed');

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Projects</h1>

      {loading && <p className="text-[var(--text-secondary)]">Loading your projects…</p>}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      {!loading && !error && (
        <>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Upcoming &amp; In Progress</h2>
          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-faint)] mb-10">
              <p className="text-lg mb-2">No upcoming projects yet</p>
              <p className="text-sm">
                Once a painter accepts a job and you confirm it, it'll show up here with their contact info and your
                scheduled date.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 mb-10">
              {upcoming.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Completed</h2>
          {completed.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-faint)]">
              <p className="text-sm">Completed projects will show up here once your painter marks the work done.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {completed.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
