import { useState } from 'react';

interface Notification {
  id: number;
  icon: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

const initialNotifications: Notification[] = [
  {
    id: 1,
    icon: '\u{1F4E9}',
    title: 'New Job Offer',
    body: 'Sarah Johnson in Dallas, TX wants an interior full home paint job. Estimated at $2,450.',
    timestamp: '2 hours ago',
    read: false,
  },
  {
    id: 2,
    icon: '\u2B50',
    title: 'New Review: 5 Stars',
    body: 'Tom Baker left a 5-star review: "Our house looks like it just came off the lot."',
    timestamp: '5 hours ago',
    read: false,
  },
  {
    id: 3,
    icon: '\u{1F4B0}',
    title: 'Payment Received',
    body: 'You received a payment of $1,650 for Job #994 (Amanda Clark - Interior 3 Rooms).',
    timestamp: '1 day ago',
    read: false,
  },
  {
    id: 4,
    icon: '\u{1F4E9}',
    title: 'New Job Offer',
    body: 'Mike Rodriguez in Fort Worth, TX needs an exterior house repaint. Estimated at $3,100.',
    timestamp: '2 days ago',
    read: true,
  },
  {
    id: 5,
    icon: '\u{1F4C8}',
    title: 'Deal Performance',
    body: 'Your "Spring Interior Special" deal has been viewed 12 times in the last 24 hours.',
    timestamp: '2 days ago',
    read: true,
  },
  {
    id: 6,
    icon: '\u2705',
    title: 'Job Completed',
    body: 'Job #995 (James Wilson - Exterior Fence) has been marked as completed.',
    timestamp: '3 days ago',
    read: true,
  },
  {
    id: 7,
    icon: '\u{1F4E9}',
    title: 'New Job Offer',
    body: 'Emily Chen in Plano, TX wants a single room accent wall painted. Estimated at $650.',
    timestamp: '4 days ago',
    read: true,
  },
  {
    id: 8,
    icon: '\u2B50',
    title: 'New Review: 4 Stars',
    body: 'Amanda Clark left a 4-star review for your 3-room interior project.',
    timestamp: '5 days ago',
    read: true,
  },
  {
    id: 9,
    icon: '\u{1F514}',
    title: 'Reminder',
    body: 'Your insurance documentation expires in 30 days. Please update it in your profile.',
    timestamp: '1 week ago',
    read: true,
  },
  {
    id: 10,
    icon: '\u{1F389}',
    title: 'Milestone Reached',
    body: 'Congratulations! You have completed 45 jobs on The Painted Painter platform.',
    timestamp: '1 week ago',
    read: true,
  },
];

export default function PainterNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notifications</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.`
              : 'You are all caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-5 py-2.5 border border-[var(--input-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] rounded-lg transition-colors text-sm"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.read && markAsRead(n.id)}
            className={`bg-[var(--bg-surface)] border rounded-xl p-4 flex items-start gap-3 transition-colors ${
              n.read
                ? 'border-[var(--border)] opacity-70'
                : 'border-[color-mix(in_srgb,var(--accent)_30%,transparent)] cursor-pointer hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <span className="text-2xl mt-0.5 flex-shrink-0">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{n.title}</h3>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{n.body}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{n.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
