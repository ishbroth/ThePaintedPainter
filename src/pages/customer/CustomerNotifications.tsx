import { useState } from 'react';

type NotificationType =
  | 'project_update'
  | 'painter_assigned'
  | 'review_reminder'
  | 'estimate_ready';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

const typeColors: Record<NotificationType, string> = {
  project_update: '#3b82f6',
  painter_assigned: '#f5a623',
  review_reminder: '#a855f7',
  estimate_ready: '#22c55e',
};

const initialNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'estimate_ready',
    title: 'Estimate Ready',
    body: 'Your estimate for interior painting at 245 Elm Street is ready to review.',
    timestamp: '10 minutes ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'painter_assigned',
    title: 'Painter Assigned',
    body: 'Manhattan Brush Co. has been assigned to your living room project.',
    timestamp: '2 hours ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'project_update',
    title: 'Project Update',
    body: 'Your exterior painting project status has changed to In Progress.',
    timestamp: '1 day ago',
    read: false,
  },
  {
    id: 'n4',
    type: 'review_reminder',
    title: 'Review Reminder',
    body: 'You have not left a review for your completed cabinet painting project.',
    timestamp: '2 days ago',
    read: false,
  },
  {
    id: 'n5',
    type: 'project_update',
    title: 'Project Completed',
    body: 'Your deck staining project has been marked as completed.',
    timestamp: '5 days ago',
    read: true,
  },
  {
    id: 'n6',
    type: 'estimate_ready',
    title: 'Estimate Ready',
    body: 'A new estimate for bathroom painting has been prepared for you.',
    timestamp: '1 week ago',
    read: true,
  },
  {
    id: 'n7',
    type: 'painter_assigned',
    title: 'Painter Matched',
    body: 'SoCal Pro Painters has accepted your project request.',
    timestamp: '1 week ago',
    read: true,
  },
  {
    id: 'n8',
    type: 'review_reminder',
    title: 'Review Reminder',
    body: 'Share your experience with Manhattan Brush Co. for the bedroom painting project.',
    timestamp: '2 weeks ago',
    read: true,
  },
];

export default function CustomerNotifications() {
  const [notifications, setNotifications] = useState(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-gray-400 text-sm mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 text-sm font-semibold text-[#f5a623] border border-[#f5a623] rounded-lg hover:bg-[#f5a623] hover:text-black transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => markAsRead(notification.id)}
            className={`w-full text-left bg-[#222] border rounded-xl p-5 transition-colors hover:bg-[#2a2a2a] ${
              notification.read
                ? 'border-[#333]'
                : 'border-l-4'
            }`}
            style={
              !notification.read
                ? { borderLeftColor: typeColors[notification.type] }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className={`font-semibold ${
                      notification.read ? 'text-gray-400' : 'text-white'
                    }`}
                  >
                    {notification.title}
                  </h3>
                  {!notification.read && (
                    <span className="w-2 h-2 rounded-full bg-[#f5a623] flex-shrink-0" />
                  )}
                </div>
                <p
                  className={`text-sm ${
                    notification.read ? 'text-gray-500' : 'text-gray-300'
                  }`}
                >
                  {notification.body}
                </p>
              </div>
              <span className="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">
                {notification.timestamp}
              </span>
            </div>
          </button>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No notifications</p>
        </div>
      )}
    </div>
  );
}
