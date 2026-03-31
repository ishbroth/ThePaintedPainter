const stats = [
  { label: 'Total Jobs', value: '47', icon: '\u{1F3E0}' },
  { label: 'Active Jobs', value: '3', icon: '\u{1F528}' },
  { label: 'Average Rating', value: '4.8', icon: '\u2B50' },
  { label: 'Total Reviews', value: '38', icon: '\u{1F4AC}' },
];

const recentActivity = [
  { id: 1, text: 'New job offer received in Dallas, TX', time: '2 hours ago', icon: '\u{1F4E9}' },
  { id: 2, text: 'Review received: 5 stars from Sarah M.', time: '5 hours ago', icon: '\u2B50' },
  { id: 3, text: 'Job #1042 marked as completed', time: '1 day ago', icon: '\u2705' },
  { id: 4, text: 'Your deal "Spring Special" got 12 views', time: '2 days ago', icon: '\u{1F4C8}' },
  { id: 5, text: 'New job offer received in Austin, TX', time: '3 days ago', icon: '\u{1F4E9}' },
];

export default function PainterDashboard() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Welcome back, Pro Painters Co.</h1>
      <p className="text-gray-400 mb-8">Here is an overview of your painting business.</p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#222] border border-[#333] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-sm text-gray-400">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-[#222] border border-[#333] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <ul className="space-y-3">
          {recentActivity.map((activity) => (
            <li
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#2a2a2a] transition-colors"
            >
              <span className="text-xl mt-0.5">{activity.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{activity.text}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
