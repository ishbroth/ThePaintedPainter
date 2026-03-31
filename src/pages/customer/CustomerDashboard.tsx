import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';

const mockStats = {
  activeProjects: 2,
  completedProjects: 5,
  pendingEstimates: 1,
};

const mockActivity = [
  {
    id: 1,
    text: 'Estimate completed for interior painting',
    time: '2 hours ago',
  },
  {
    id: 2,
    text: 'Painter assigned to your project',
    time: '1 day ago',
  },
  {
    id: 3,
    text: 'Payment processed for exterior painting job',
    time: '3 days ago',
  },
  {
    id: 4,
    text: 'New review reminder for Manhattan Brush Co.',
    time: '5 days ago',
  },
];

export default function CustomerDashboard() {
  const { profile } = useAuth();
  const displayName = profile?.display_name ?? 'Customer';

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Welcome back!</h1>
      <p className="text-gray-400 mb-8">
        Hi {displayName}, here is an overview of your painting projects.
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#222] border border-[#333] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Active Projects</p>
          <p className="text-3xl font-bold text-[#f5a623]">
            {mockStats.activeProjects}
          </p>
        </div>
        <div className="bg-[#222] border border-[#333] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Completed Projects</p>
          <p className="text-3xl font-bold text-green-400">
            {mockStats.completedProjects}
          </p>
        </div>
        <div className="bg-[#222] border border-[#333] rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Pending Estimates</p>
          <p className="text-3xl font-bold text-blue-400">
            {mockStats.pendingEstimates}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-10">
        <Link
          to="/contact"
          className="px-6 py-3 bg-[#f5a623] text-black font-semibold rounded-lg hover:bg-[#e09510] transition-colors"
        >
          Get New Estimate
        </Link>
        <Link
          to="/painters-map"
          className="px-6 py-3 border border-[#f5a623] text-[#f5a623] font-semibold rounded-lg hover:bg-[#f5a623] hover:text-black transition-colors"
        >
          Find Painters
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#222] border border-[#333] rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
        <ul className="space-y-4">
          {mockActivity.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between border-b border-[#333] pb-4 last:border-b-0 last:pb-0"
            >
              <p className="text-gray-300">{item.text}</p>
              <span className="text-gray-500 text-sm whitespace-nowrap ml-4">
                {item.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
