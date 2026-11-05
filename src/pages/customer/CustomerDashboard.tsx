import FaceIdSettings from '../../components/FaceIdSettings';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/index.ts';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { useUnreadMessages } from '../../lib/jobMessages';
import AccountSettings from '../../components/account/AccountSettings';
import MessageButton from '../../components/messaging/MessageButton';
import ProfileBlock from '../../components/customer/ProfileBlock';
import ProjectCard, { type Project } from '../../components/customer/ProjectCard';
import { currency } from '../../components/customer/money';

const stat = (n: number) => new Intl.NumberFormat('en-US').format(n);

function Bubble({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-2 py-2 text-center">
      <p className={`text-lg font-bold leading-tight ${tone}`}>{value}</p>
      <p className="text-[11px] text-[var(--text-secondary)] leading-tight">{label}</p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
        {title}{count ? <span className="text-[var(--text-faint)]"> · {count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

const empty = (text: string) => <p className="text-xs text-[var(--text-faint)] bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-xl px-3 py-3">{text}</p>;

/**
 * The customer's one page: who they are, a few numbers, what is being arranged and what is said to them, what is scheduled, what is done, then settings.
 * It replaces the old Dashboard, My Projects and Profile pages (and the sidebar that linked them).
 */
export default function CustomerDashboard() {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { unread, refresh: refreshUnread } = useUnreadMessages(session?.access_token);
  // a message notification links here with ?messages=<job id>: that project's thread opens
  const openThreadFor = useSearchParams()[0].get('messages');

  // The profile in auth context is loaded once at login, so a discount that has since lapsed would still show.
  // sync_loyalty_decay applies any due decay and returns the current numbers.
  const [loyalty, setLoyalty] = useState<{ balance: number; discount: number } | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // behind ProtectedRoute, so a session is there; if the first render beats it, this runs again once `session` shows up
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

  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId) return;
    supabase.rpc('sync_loyalty_decay', { p_customer_id: profileId }).then(({ data, error: rpcError }) => {
      const row = data?.[0];
      if (!rpcError && row) setLoyalty({ balance: row.points_balance, discount: row.discount_percent });
    });
  }, [profileId]);

  const all = projects ?? [];
  const requests = all.filter((p) => p.status !== 'confirmed' && p.status !== 'completed');
  const scheduled = all.filter((p) => p.status === 'confirmed');
  const completed = all.filter((p) => p.status === 'completed');
  const withMessages = scheduled.filter((p) => (unread[p.id] ?? 0) > 0);

  const jobsCompleted = completed.length;
  const reviewsWritten = completed.filter((p) => p.reviewSubmitted).length;
  // booked and finished jobs: a confirmed job's deposit is paid, and a finished one is paid for
  const spent = [...scheduled, ...completed].reduce((sum, p) => sum + (p.price ?? 0), 0);

  const points = loyalty?.balance ?? profile?.loyalty_points_balance ?? 0;
  const discount = loyalty?.discount ?? profile?.loyalty_discount_percent ?? 0;
  const toNext = discount >= 5 ? 0 : 20 - (points % 20);

  const dash = (v: string) => (loading ? '—' : v);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const linkBtn = 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors';

  return (
    <div className="max-w-3xl mx-auto w-full px-3 py-4 sm:px-4">
      <ProfileBlock />

      {/* a few numbers */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Bubble label="Jobs completed" value={dash(stat(jobsCompleted))} tone="text-green-400" />
        <Bubble label="Reviews written" value={dash(stat(reviewsWritten))} tone="text-[var(--accent)]" />
        <Bubble label="Money spent" value={dash(currency(spent))} tone="text-[var(--accent-blue)]" />
      </div>
      {profile && (
        <p className="text-xs text-[var(--text-secondary)] mt-2 px-1">
          <span className="font-semibold text-[var(--text-primary)]">{points} loyalty pts</span>
          {discount > 0
            ? <> · saving <span className="text-[var(--accent-blue)] font-semibold">{discount}%</span> on your next project</>
            : <> · 1 pt per $100 booked, 20 pts = 1% off</>}
          {toNext > 0 && discount > 0 ? <span className="text-[var(--text-faint)]"> · {toNext} to next 1%</span> : null}
        </p>
      )}

      {error && <p className="text-sm text-[var(--danger)] mt-4">{error}</p>}

      {/* requests being arranged and what your painter has said */}
      <Section title="Requests & messages" count={requests.length + withMessages.length}>
        {loading ? (
          <p className="text-xs text-[var(--text-secondary)]">Loading…</p>
        ) : requests.length === 0 && withMessages.length === 0 ? (
          empty('No open requests or new messages. Get a price and your request shows up here.')
        ) : (
          <div className="flex flex-col gap-2.5">
            {withMessages.map((p) => (
              <div key={`msg-${p.id}`} className="bg-[var(--bg-surface)] border border-[var(--accent)] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{p.painter?.company_name ?? 'Your painter'}</span> wrote to you about {p.phaseLabel || 'your project'}
                </p>
                <MessageButton jobId={p.id} role="customer" status={p.status} unread={unread[p.id] ?? 0} onClosed={refreshUnread} />
              </div>
            ))}
            {requests.map((p) => (
              <ProjectCard key={p.id} project={p} variant="request" />
            ))}
          </div>
        )}
      </Section>

      {/* confirmed jobs */}
      <Section title="Scheduled jobs" count={scheduled.length}>
        {loading ? null : scheduled.length === 0 ? (
          empty('Nothing scheduled yet. Once a painter accepts and you confirm, the job shows up here with their contact details and date.')
        ) : (
          <div className="flex flex-col gap-2.5">
            {scheduled.map((p) => (
              <ProjectCard key={p.id} project={p} variant="scheduled" unread={unread[p.id] ?? 0} autoOpenMessages={openThreadFor === p.id} onMessagesClosed={refreshUnread} />
            ))}
          </div>
        )}
      </Section>

      {/* finished jobs, with the painter who did them */}
      <Section title="Completed jobs" count={completed.length}>
        {loading ? null : completed.length === 0 ? (
          empty('Finished jobs show up here once your painter marks the work done.')
        ) : (
          <div className="flex flex-col gap-2.5">
            {completed.map((p) => (
              <ProjectCard key={p.id} project={p} variant="completed" />
            ))}
          </div>
        )}
      </Section>

      {/* settings and the links the old menu had */}
      <Section title="Settings">
        <div className="flex flex-wrap gap-2 mb-3">
          <Link to="/customer/dashboard/notifications" className={linkBtn}>🔔 Notifications</Link>
          <Link to="/#estimator" className={linkBtn}>Get a new price</Link>
          <Link to="/painters-map" className={linkBtn}>Find painters</Link>
          <Link to="/support" className={linkBtn}>Support</Link>
        </div>
        <details className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl group">
          <summary className="cursor-pointer select-none px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)]">Account — email, password, alerts, delete</summary>
          <div className="px-3.5 pt-1 [&>*]:!mb-3">
            <AccountSettings />
          </div>
        </details>
        <FaceIdSettings />
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 w-full px-4 py-2.5 text-sm font-semibold rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
        >
          Sign out
        </button>
      </Section>
    </div>
  );
}
