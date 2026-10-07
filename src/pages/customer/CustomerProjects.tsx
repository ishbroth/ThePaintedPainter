import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase, supabaseUrl } from '../../lib/supabase';
import AddToCalendar from '../../components/AddToCalendar';
import { fmtRange } from '../../lib/dates';

interface Project {
  id: string;
  status: string;
  price: number | null;
  address: string;
  scheduledDate: string | null;
  scheduledEndDate?: string | null;
  dateState?: 'awaiting_painter_dates' | 'painter_offered' | 'customer_countered' | 'agreed';
  needsNewPainter?: { expiresAt: string; resumeUrl: string } | null;
  preferredDate: string | null;
  phaseLabel: string | null;
  parentQuoteId: string | null;
  offerSentAt: string | null;
  acceptedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  confirmUrl: string | null;
  reviewToken: string | null;
  reviewSubmitted: boolean;
  // email/phone/owner_name arrive only once the deposit is paid
  painter: { company_name: string; owner_name?: string; email?: string; phone?: string } | null;
}

const currency = (n: number | null) =>
  n == null ? 'Pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const statusLabels: Record<string, string> = {
  needs_new_painter: 'Pick Another Painter',
  cancelled: 'Cancelled',
  expired: 'Expired',
  offer_sent: 'Finding a Painter',
  painter_accepted: 'Awaiting Deposit',
  confirmed: 'Confirmed',
  completed: 'Completed',
};

const statusColors: Record<string, string> = {
  needs_new_painter: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  offer_sent: 'bg-gray-500/20 text-[var(--text-secondary)] border-gray-500/40',
  painter_accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/40',
  completed: 'bg-blue-500/20 text-[var(--accent-blue)] border-blue-500/40',
};

const STEPS = ['Offer sent', 'Painter accepted', 'Deposit paid', 'Completed'];
const STEP_INDEX: Record<string, number> = { offer_sent: 0, painter_accepted: 1, confirmed: 2, completed: 3 };

function ProgressSteps({ status }: { status: string }) {
  const current = STEP_INDEX[status] ?? 0;
  return (
    <ol className="flex items-center gap-2 mb-4 text-xs">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-semibold ${
              i <= current ? 'bg-[var(--accent-blue)] text-white' : 'border border-[var(--border)] text-[var(--text-faint)]'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={`truncate ${i <= current ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function RescheduleRequest({ projectId }: { projectId: string }) {
  const { session } = useAuth();
  const [date, setDate] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async () => {
    if (!session?.access_token || !date) return;
    setState('sending');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/reschedule-job`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: projectId, newDate: date }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return <p className="text-sm text-[var(--text-faint)]">✓ Request sent — your painter will confirm the new date.</p>;
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-[var(--text-faint)]">Need a different start date?</span>
      <input
        type="date"
        value={date}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)}
        className="px-2 py-1 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!date || state === 'sending'}
        className="px-3 py-1 text-sm rounded-lg border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Request change'}
      </button>
      {state === 'error' && <span className="text-sm text-[var(--danger)]">Couldn't send — try again.</span>}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-[var(--text-primary)] font-semibold text-lg">
          {project.phaseLabel || 'Painting Project'}
        </h3>
        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[project.status] ?? statusColors.confirmed}`}>
          {statusLabels[project.status] ?? project.status}
        </span>
      </div>
      <ProgressSteps status={project.status} />
      <div className="space-y-2 text-sm text-[var(--text-secondary)]">
        {project.address && (
          <p><span className="text-[var(--text-faint)]">Location:</span> {project.address}</p>
        )}
        {project.painter && (
          <p>
            <span className="text-[var(--text-faint)]">Painter:</span> {project.painter.company_name}
            {project.painter.email ? (
              <>
                {' — '}
                <a href={`mailto:${project.painter.email}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)]">{project.painter.email}</a>
                {' · '}
                <a href={`tel:${project.painter.phone}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)]">{project.painter.phone}</a>
              </>
            ) : (
              <span className="text-[var(--text-faint)]"> (contact details are shared once your deposit is paid)</span>
            )}
          </p>
        )}
        <p><span className="text-[var(--text-faint)]">Price:</span> <span className="text-[var(--text-primary)]">{currency(project.price)}</span></p>
        <p>
          <span className="text-[var(--text-faint)]">
            {project.status === 'completed' ? 'Completed:' : project.scheduledDate ? 'Scheduled:' : 'Requested date:'}
          </span>{' '}
          {project.status === 'completed'
            ? (project.completedAt ? new Date(project.completedAt).toLocaleDateString() : 'Recently')
            : (project.scheduledDate ? fmtRange(project.scheduledDate, project.scheduledEndDate) : project.preferredDate || 'Not yet set')}
        </p>
      </div>

      {project.status === 'offer_sent' && (
        <p className="mt-4 pt-4 border-t border-[var(--border)] text-sm text-[var(--text-faint)]">
          We've sent your job to painters{project.offerSentAt ? ` on ${new Date(project.offerSentAt).toLocaleDateString()}` : ''}. You'll get an email as soon as one accepts.
        </p>
      )}

      {project.status === 'needs_new_painter' && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {project.needsNewPainter ? (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Your painter couldn't take this job. Pick another from your matches before {new Date(project.needsNewPainter.expiresAt).toLocaleString()}.
              </p>
              <a
                href={project.needsNewPainter.resumeUrl}
                className="inline-block px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                See my matching painters
              </a>
            </>
          ) : (
            <p className="text-sm text-[var(--text-faint)]">The window to pick another painter has ended.</p>
          )}
        </div>
      )}

      {project.status === 'painter_accepted' && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {project.confirmUrl ? (
            <a
              href={project.confirmUrl}
              className="inline-block px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              {project.dateState === 'agreed' ? 'Pay deposit & confirm' : project.dateState === 'customer_countered' ? 'View your dates' : 'Confirm dates & pay deposit'}
            </a>
          ) : (
            <p className="text-sm text-[var(--text-faint)]">
              Your painter is choosing when they can start. We'll email you when their dates are ready.
            </p>
          )}
        </div>
      )}

      {project.status === 'confirmed' && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
          {project.scheduledDate && (
            <AddToCalendar
              event={{
                uid: project.id,
                title: `Painting project${project.painter ? ` — ${project.painter.company_name}` : ''}`,
                date: project.scheduledDate,
                endDate: project.scheduledEndDate,
                location: project.address,
              }}
            />
          )}
          <RescheduleRequest projectId={project.id} />
        </div>
      )}

      {project.status === 'completed' && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
          {project.reviewSubmitted ? (
            <span className="text-sm text-[var(--text-faint)]">✓ You reviewed this painter — thanks for the feedback!</span>
          ) : project.reviewToken ? (
            <Link
              to={`/leave-review?token=${project.reviewToken}`}
              className="inline-block px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              Rate this painter
            </Link>
          ) : null}
          {project.price != null && Math.floor(project.price / 100) > 0 && (
            <span className="text-sm text-[var(--accent-blue)]">
              +{Math.floor(project.price / 100)} loyalty point{Math.floor(project.price / 100) === 1 ? '' : 's'} earned
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LoyaltyBanner({ balance, discount }: { balance: number; discount: number }) {
  const pointsToNextTier = discount >= 5 ? 0 : 20 - (balance % 20);

  return (
    <div className="mb-8 p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between flex-wrap gap-4">
      <div>
        <p className="text-sm text-[var(--text-faint)] mb-1">Loyalty Points</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{balance} pts</p>
      </div>
      <div className="text-sm text-[var(--text-secondary)] text-right">
        {discount > 0 ? (
          <p>
            You're saving <span className="text-[var(--accent-blue)] font-semibold">{discount}%</span> on your next
            project.
          </p>
        ) : (
          <p>Earn 1 point per $100 booked — 20 points = 1% off.</p>
        )}
        {pointsToNextTier > 0 && (
          <p className="text-[var(--text-faint)]">{pointsToNextTier} more points to your next 1% off</p>
        )}
      </div>
    </div>
  );
}

export default function CustomerProjects() {
  const { session, profile } = useAuth();
  // The profile in auth context is loaded once at login, so a discount that has
  // since lapsed would still show. sync_loyalty_decay applies any due decay and
  // returns the current numbers.
  const [loyalty, setLoyalty] = useState<{ balance: number; discount: number } | null>(null);
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

  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId) return;
    supabase.rpc('sync_loyalty_decay', { p_customer_id: profileId }).then(({ data, error: rpcError }) => {
      const row = data?.[0];
      if (!rpcError && row) setLoyalty({ balance: row.points_balance, discount: row.discount_percent });
    });
  }, [profileId]);

  const upcoming = (projects ?? []).filter((p) => p.status !== 'completed');
  const completed = (projects ?? []).filter((p) => p.status === 'completed');

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Projects</h1>

      {profile && (
        <LoyaltyBanner
          balance={loyalty?.balance ?? profile.loyalty_points_balance ?? 0}
          discount={loyalty?.discount ?? profile.loyalty_discount_percent ?? 0}
        />
      )}

      {loading && <p className="text-[var(--text-secondary)]">Loading your projects…</p>}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      {!loading && !error && (
        <>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Upcoming &amp; In Progress</h2>
          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-faint)] mb-10">
              <p className="text-lg mb-2">No upcoming projects yet</p>
              <p className="text-sm">
                Once a painter accepts a job and you confirm it, it'll show up here with their contact info and your
                scheduled date.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 mb-10">
              {upcoming.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Completed</h2>
          {completed.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-faint)]">
              <p className="text-sm">Completed projects will show up here once your painter marks the work done.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {completed.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
