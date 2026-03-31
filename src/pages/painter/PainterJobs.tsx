interface Job {
  id: number;
  customerName: string;
  projectType: string;
  price: string;
  date: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed';
}

const activeJobs: Job[] = [
  {
    id: 1001,
    customerName: 'Sarah Johnson',
    projectType: 'Interior - Full Home',
    price: '$2,450',
    date: '2026-03-30',
    status: 'accepted',
  },
  {
    id: 1002,
    customerName: 'Mike Rodriguez',
    projectType: 'Exterior - House',
    price: '$3,100',
    date: '2026-03-28',
    status: 'in_progress',
  },
  {
    id: 1003,
    customerName: 'Emily Chen',
    projectType: 'Interior - Single Room',
    price: '$650',
    date: '2026-03-27',
    status: 'pending',
  },
];

const completedJobs: Job[] = [
  {
    id: 995,
    customerName: 'James Wilson',
    projectType: 'Exterior - Fence',
    price: '$800',
    date: '2026-03-15',
    status: 'completed',
  },
  {
    id: 994,
    customerName: 'Amanda Clark',
    projectType: 'Interior - 3 Rooms',
    price: '$1,650',
    date: '2026-03-10',
    status: 'completed',
  },
  {
    id: 993,
    customerName: 'Robert Lee',
    projectType: 'Commercial - Office Suite',
    price: '$4,200',
    date: '2026-02-28',
    status: 'completed',
  },
  {
    id: 992,
    customerName: 'Karen Martinez',
    projectType: 'Interior - Kitchen Cabinets',
    price: '$1,100',
    date: '2026-02-20',
    status: 'completed',
  },
  {
    id: 991,
    customerName: 'Tom Baker',
    projectType: 'Exterior - Full House',
    price: '$3,500',
    date: '2026-02-10',
    status: 'completed',
  },
];

const statusConfig: Record<Job['status'], { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-yellow-900/40 text-yellow-400' },
  accepted: { label: 'Accepted', classes: 'bg-blue-900/40 text-blue-400' },
  in_progress: { label: 'In Progress', classes: 'bg-purple-900/40 text-purple-400' },
  completed: { label: 'Completed', classes: 'bg-green-900/40 text-green-400' },
};

function JobRow({ job }: { job: Job }) {
  const { label, classes } = statusConfig[job.status];
  return (
    <div className="bg-[#222] border border-[#333] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-white font-semibold text-sm">{job.projectType}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes}`}>
            {label}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span>Customer: <span className="text-gray-300">{job.customerName}</span></span>
          <span>Date: <span className="text-gray-300">{job.date}</span></span>
          <span>Job #{job.id}</span>
        </div>
      </div>
      <p className="text-lg font-bold text-[#f5a623]">{job.price}</p>
    </div>
  );
}

export default function PainterJobs() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">My Jobs</h1>
      <p className="text-gray-400 text-sm mb-6">Track your active and completed painting jobs.</p>

      {/* Active jobs */}
      <h2 className="text-lg font-semibold text-white mb-3">
        Active Jobs ({activeJobs.length})
      </h2>
      <div className="space-y-3 mb-8">
        {activeJobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>

      {/* Completed jobs */}
      <h2 className="text-lg font-semibold text-white mb-3">
        Completed ({completedJobs.length})
      </h2>
      <div className="space-y-3">
        {completedJobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
