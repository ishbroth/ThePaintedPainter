import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { enablePush, getPushState, syncPushSubscription, type PushState } from '../../lib/notifications/push';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Real notifications for the signed-in user (customer or painter): loads from
 * the notifications table, updates live via realtime when a new one arrives,
 * and lets the user turn on push so they get them on their phone too.
 */
export default function NotificationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [pushState, setPushState] = useState<PushState>(getPushState());
  const [pushBusy, setPushBusy] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    supabase
      .from('notifications')
      .select('id, type, title, body, link, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled) setRows((data as NotificationRow[]) ?? []);
      });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setRows((prev) => [payload.new as NotificationRow, ...(prev ?? [])]),
      )
      .subscribe();

    syncPushSubscription(userId);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setRows((prev) => (prev ?? []).map((r) => (ids.includes(r.id) ? { ...r, is_read: true } : r)));
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    // Clear the home-screen badge once everything is read, where supported.
    if ('clearAppBadge' in navigator) (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {});
  }, []);

  const open = (n: NotificationRow) => {
    if (!n.is_read) markRead([n.id]);
    if (n.link) navigate(n.link);
  };

  const turnOnPush = async () => {
    if (!userId) return;
    setPushBusy(true);
    setPushState(await enablePush(userId));
    setPushBusy(false);
  };

  const unread = (rows ?? []).filter((r) => !r.is_read);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Notifications</h1>
          {unread.length > 0 && (
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {unread.length} unread notification{unread.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markRead(unread.map((r) => r.id))}
            className="px-4 py-2 text-sm font-semibold text-[var(--accent)] border border-[var(--accent)] rounded-lg hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {pushState !== 'granted' && pushState !== 'unsupported' && (
        <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-[var(--text-secondary)] max-w-xl">
            {pushState === 'needs-install' && (
              <>To get notifications on your iPhone or iPad, tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app from your Home Screen and turn them on here.</>
            )}
            {pushState === 'default' && <>Get a ping on this device when a painter accepts, your date changes, or a job is coming up.</>}
            {pushState === 'denied' && <>Notifications are blocked for this site. Re-enable them in your browser or phone settings to get alerts.</>}
          </div>
          {pushState === 'default' && (
            <button
              onClick={turnOnPush}
              disabled={pushBusy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-50"
            >
              {pushBusy ? 'Turning on…' : 'Turn on notifications'}
            </button>
          )}
        </div>
      )}
      {pushState === 'granted' && (
        <p className="mb-6 text-sm text-[var(--text-faint)]">✓ Push notifications are on for this device.</p>
      )}

      {rows === null && <p className="text-[var(--text-secondary)]">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <div className="text-center py-12 text-[var(--text-faint)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
          You're all caught up. Updates about your projects will show up here.
        </div>
      )}

      <div className="space-y-3">
        {(rows ?? []).map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className={`w-full text-left bg-[var(--bg-surface)] border rounded-xl p-5 transition-colors hover:bg-[var(--bg-surface-hover)] ${
              n.is_read ? 'border-[var(--border)]' : 'border-l-4 border-[var(--border)]'
            }`}
            style={!n.is_read ? { borderLeftColor: 'var(--accent-blue)' } : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[var(--text-primary)] ${n.is_read ? 'font-medium' : 'font-bold'}`}>{n.title}</p>
                {n.body && <p className="text-sm text-[var(--text-secondary)] mt-1">{n.body}</p>}
              </div>
              <span className="text-xs text-[var(--text-faint)] whitespace-nowrap">{timeAgo(n.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
