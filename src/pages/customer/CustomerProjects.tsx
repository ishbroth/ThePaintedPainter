import { useEffect, useState } from 'react';
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
  painter: { company_name: string; owner_name: string; email: string; phone: string } | null;
}

const currency = (n: number | null) =>
  n == null ? 'Pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const statusLabels: Record<string, string> = {
  painter_accepted: 'Awaiting Deposit',
  confirmed: 'Confirmed',
};

const statusColors: Record<string, string> = {
  painter_accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/40',
};

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="bg-[#222] border border-[#333] rounded-xl p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-white font-semibold text-lg">
          {project.phaseLabel || 'Painting Project'}
        </h3>
        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[project.status] ?? statusColors.confirmed}`}>
          {statusLabels[project.status] ?? project.status}
        </span>
      </div>
      <div className="space-y-2 text-sm text-gray-400">
        {project.address && (
          <p><span className="text-gray-500">Location:</span> {project.address}</p>
        )}
        {project.painter && (
          <p>
            <span className="text-gray-500">Painter:</span> {project.painter.company_name}
            {' — '}
            <a href={`mailto:${project.painter.email}`} className="text-blue-400 hover:text-blue-300">{project.painter.email}</a>
            {' · '}
            <a href={`tel:${project.painter.phone}`} className="text-blue-400 hover:text-blue-300">{project.painter.phone}</a>
          </p>
        )}
        <p><span className="text-gray-500">Price:</span> <span className="text-white">{currency(project.price)}</span></p>
        <p>
          <span className="text-gray-500">{project.scheduledDate ? 'Scheduled:' : 'Requested date:'}</span>{' '}
          {project.scheduledDate || project.preferredDate || 'Not yet set'}
        </p>
      </div>
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

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">My Projects</h1>

      {loading && <p className="text-gray-400">Loading your projects…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-6">
          {(projects ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {!loading && !error && projects?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No upcoming projects yet</p>
          <p className="text-sm">
            Once a painter accepts a job and you confirm it, it'll show up here with their contact info and your
            scheduled date.
          </p>
        </div>
      )}
    </div>
  );
}
