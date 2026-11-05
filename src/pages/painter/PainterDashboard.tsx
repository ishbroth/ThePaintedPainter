import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { useUnreadMessages } from '../../lib/jobMessages';
import AvailabilityCalendar from '../../components/painter/AvailabilityCalendar';
import { JobCard, OfferCard, type PainterProjectsData } from '../../components/painter/JobCards';

interface NoteRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const COMPLETED_SHOWN = 5;

function Bubble({ value, label, icon, hot = false }: { value: string; label: string; icon?: React.ReactNode; hot?: boolean }) {
  return (
    <div
      className="rounded-xl px-2 py-1.5 text-center min-w-0"
      style={{ background: 'var(--bg-surface)', border: `1px solid ${hot ? 'var(--danger)' : 'var(--border)'}` }}
    >
      <p className="font-bold leading-tight flex items-center justify-center gap-1" style={{ fontSize: '1.05rem', color: hot ? 'var(--danger)' : 'var(--text-primary)' }}>
        {icon}{value}
      </p>
      <p className="uppercase tracking-wide text-[var(--text-faint)] truncate" style={{ fontSize: '0.6rem' }}>{label}</p>
    </div>
  );
}

function BubbleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 21l1.9-5.1A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
    </svg>
  );
}

function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mt-4 mb-1.5">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">{children}</h2>
      {right}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-[var(--text-faint)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-3 text-center">{text}</p>;
}

/**
 * The painter's home: a tight row of numbers, then what needs them (offers, and the jobs they are on with their messages), the calendar with the days
 * they are booked and blacked out, and the jobs they have finished. It is what the Dashboard and My Projects pages were, as one page.
 */
export default function PainterDashboard() {
  const { session } = useAuth();
  const { unread, refresh: refreshUnread } = useUnreadMessages(session?.access_token);
  // a message notification links here with ?messages=<job id>: that job's thread opens
  const openThreadFor = useSearchParams()[0].get('messages');
  const [data, setData] = useState<PainterProjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [showAllDone, setShowAllDone] = useState(false);

  const load = () => {
    if (!session?.access_token) return;
    fetch(`${supabaseUrl}/functions/v1/get-painter-projects`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load your dashboard');
        setData(json);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your dashboard'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [session?.access_token]);

  // review follow-ups that need an answer
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('notifications')
      .select('id, type, title, body, link, is_read, created_at')
      .eq('type', 'review_followup')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data: rows }) => setNotes((rows as NoteRow[]) ?? []));
  }, [session?.user?.id]);

  const resolveNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const call = async (fn: string, body: Record<string, unknown>, failed: string) => {
    if (!session?.access_token) return;
    const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || failed);
  };

  const handleMarkCompleted = async (jobId: string) => {
    setMarkingId(jobId);
    try { await call('mark-job-completed', { jobId }, 'Failed to mark job completed'); load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to mark job completed'); }
    finally { setMarkingId(null); }
  };

  const handleReschedule = async (jobId: string, newDate: string) => {
    try { await call('reschedule-job', { jobId, newDate }, 'Failed to change date'); load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to change date'); }
  };

  const unreadTotal = Object.values(unread).reduce((n, c) => n + c, 0);
  // the days of the jobs that are confirmed, for the calendar
  const jobSpans = useMemo(
    () => (data?.confirmed ?? []).filter((j) => j.status === 'confirmed' && j.scheduledDate).map((j) => ({ start: j.scheduledDate as string, end: j.scheduledEndDate })),
    [data],
  );

  if (loading) return <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>;
  if (error && !data) return <p className="p-4 text-sm text-[var(--danger)]">{error}</p>;
  if (!data) return null;

  const confirmedCount = data.confirmed.filter((j) => j.status === 'confirmed').length;
  const { avgRating, reviewCount } = data.rating;
  const done = showAllDone ? data.completed : data.completed.slice(0, COMPLETED_SHOWN);

  return (
    <div className="max-w-3xl mx-auto px-3 py-3">
      <p className="text-xs text-[var(--text-secondary)] mb-2 truncate">Hi, <strong className="text-[var(--text-primary)]">{data.companyName}</strong></p>

      {error && <p className="text-xs text-[var(--danger)] mb-2">{error}</p>}

      {notes.length > 0 && (
        <div className="mb-3 rounded-lg p-3 border" style={{ borderColor: 'var(--danger)', background: 'var(--bg-surface)' }}>
          <p className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">Needs your attention</p>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{n.title}</p>
                  {n.body && <p className="text-xs text-[var(--text-secondary)]">{n.body}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {n.link && <Link to={n.link} className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[var(--accent)] text-[var(--accent-ink)]">See customers</Link>}
                  <button type="button" onClick={() => resolveNote(n.id)} className="px-2.5 py-1 text-xs rounded-md border border-[var(--border)] text-[var(--text-primary)]">Resolved</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Bubble value={String(data.offers.length)} label="Offers" />
        <Bubble value={String(unreadTotal)} label="Messages" icon={<BubbleIcon />} hot={unreadTotal > 0} />
        <Bubble value={String(confirmedCount)} label="Confirmed" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <Bubble value={String(data.completed.length)} label="Completed" />
        <Bubble value={reviewCount > 0 ? `${avgRating.toFixed(1)} ★` : '—'} label="Rating" />
        <Bubble value={String(reviewCount)} label="Reviews" />
      </div>

      <Heading>Offers &amp; messages</Heading>
      {data.offers.length === 0 && data.confirmed.length === 0 ? (
        <Empty text="No offers or active jobs right now." />
      ) : (
        <div className="grid gap-2">
          {data.offers.map((o) => <OfferCard key={o.id} offer={o} />)}
          {data.confirmed.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              onMarkCompleted={handleMarkCompleted}
              onReschedule={handleReschedule}
              marking={markingId === j.id}
              unread={unread[j.id] ?? 0}
              autoOpenMessages={openThreadFor === j.id}
              onMessagesClosed={refreshUnread}
            />
          ))}
        </div>
      )}

      <Heading>Calendar</Heading>
      <AvailabilityCalendar jobs={jobSpans} />

      <Heading right={data.completed.length > COMPLETED_SHOWN ? (
        <button type="button" onClick={() => setShowAllDone((v) => !v)} className="text-xs text-[var(--accent-blue)]">{showAllDone ? 'Show fewer' : `Show all ${data.completed.length}`}</button>
      ) : undefined}>Completed</Heading>
      {data.completed.length === 0 ? (
        <Empty text="Finished jobs show up here." />
      ) : (
        <div className="grid gap-2">
          {done.map((j) => <JobCard key={j.id} job={j} marking={false} />)}
        </div>
      )}
    </div>
  );
}
