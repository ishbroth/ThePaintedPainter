import { useState } from 'react';
import { Link } from 'react-router-dom';

type ProjectStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface Project {
  id: string;
  projectType: string;
  address: string;
  painterName: string;
  painterId: string;
  status: ProjectStatus;
  price: string;
  date: string;
}

const statusColors: Record<ProjectStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  completed: 'bg-green-500/20 text-green-400 border-green-500/40',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const statusLabels: Record<ProjectStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const activeProjects: Project[] = [
  {
    id: 'proj-1',
    projectType: 'Interior Painting - Living Room & Kitchen',
    address: '245 Elm Street, Brooklyn, NY',
    painterName: "Manhattan Brush Co.",
    painterId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'in_progress',
    price: '$2,450 (estimated)',
    date: 'Started Mar 15, 2026',
  },
  {
    id: 'proj-2',
    projectType: 'Exterior Painting - Full House',
    address: '18 Oak Avenue, Queens, NY',
    painterName: 'SoCal Pro Painters',
    painterId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    status: 'pending',
    price: '$5,800 (estimated)',
    date: 'Scheduled Apr 1, 2026',
  },
];

const pastProjects: Project[] = [
  {
    id: 'proj-3',
    projectType: 'Cabinet Painting - Kitchen',
    address: '102 Pine St, Manhattan, NY',
    painterName: "Manhattan Brush Co.",
    painterId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'completed',
    price: '$1,200',
    date: 'Completed Feb 10, 2026',
  },
  {
    id: 'proj-4',
    projectType: 'Deck Staining',
    address: '77 Maple Drive, Hoboken, NJ',
    painterName: 'SoCal Pro Painters',
    painterId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    status: 'completed',
    price: '$800',
    date: 'Completed Jan 22, 2026',
  },
  {
    id: 'proj-5',
    projectType: 'Interior Painting - Bedroom',
    address: '245 Elm Street, Brooklyn, NY',
    painterName: "Manhattan Brush Co.",
    painterId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'completed',
    price: '$950',
    date: 'Completed Dec 5, 2025',
  },
];

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function ProjectCard({
  project,
  showReview,
}: {
  project: Project;
  showReview: boolean;
}) {
  return (
    <div className="bg-[#222] border border-[#333] rounded-xl p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-white font-semibold text-lg">
          {project.projectType}
        </h3>
        <StatusBadge status={project.status} />
      </div>
      <div className="space-y-2 text-sm text-gray-400">
        {project.address && (
          <p>
            <span className="text-gray-500">Location:</span> {project.address}
          </p>
        )}
        <p>
          <span className="text-gray-500">Painter:</span>{' '}
          {project.painterName}
        </p>
        <p>
          <span className="text-gray-500">Price:</span>{' '}
          <span className="text-white">{project.price}</span>
        </p>
        <p>
          <span className="text-gray-500">Date:</span> {project.date}
        </p>
      </div>
      {showReview && project.status === 'completed' && (
        <div className="mt-4 pt-4 border-t border-[#333]">
          <Link
            to={`/customer/dashboard/review/${project.painterId}`}
            className="inline-block px-4 py-2 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09510] transition-colors"
          >
            Leave Review
          </Link>
        </div>
      )}
    </div>
  );
}

export default function CustomerProjects() {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">My Projects</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#222] rounded-lg p-1 inline-flex">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === 'active'
              ? 'bg-[#f5a623] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Active Projects ({activeProjects.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
            activeTab === 'past'
              ? 'bg-[#f5a623] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Past Projects ({pastProjects.length})
        </button>
      </div>

      {/* Project Cards */}
      <div className="grid gap-6">
        {activeTab === 'active' &&
          activeProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showReview={false}
            />
          ))}
        {activeTab === 'past' &&
          pastProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showReview={true}
            />
          ))}
      </div>

      {activeTab === 'active' && activeProjects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No active projects</p>
          <Link
            to="/contact"
            className="text-[#f5a623] hover:underline"
          >
            Get a new estimate
          </Link>
        </div>
      )}
      {activeTab === 'past' && pastProjects.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No past projects yet</p>
        </div>
      )}
    </div>
  );
}
