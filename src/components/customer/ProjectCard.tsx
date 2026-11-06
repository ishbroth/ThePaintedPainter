import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabaseUrl } from '../../lib/supabase';
import AddToCalendar from '../AddToCalendar';
import MessageButton from '../messaging/MessageButton';
import { fmtRange } from '../../lib/dates';
import { currency } from './money';
import { WORK_WITH_KEY, clearEstimatorSession } from '../../lib/chatEstimator/persistence';
import { deleteAccountChatState } from '../../lib/chatEstimator/accountPersistence';

export interface Project {
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
  contract?: { pending: boolean; accepted: boolean };
  reviewToken: string | null;
  reviewSubmitted: boolean;
  /** Finished jobs only: the painter's id and the ZIP of the job, for "Work with again". */
  painterId?: string | null;
  zip?: string | null;
  // email/phone/owner_name arrive only once the deposit is paid
  painter: { company_name: string; owner_name?: string; email?: string; phone?: string } | null;
}

const statusLabels: Record<string, string> = {
  needs_new_painter: 'Pick another painter',
  cancelled: 'Cancelled',
  expired: 'Expired',
  offer_sent: 'Finding a painter',
  searching_painter: 'Finding a painter',
  painter_accepted: 'Awaiting deposit',
  confirmed: 'Confirmed',
  completed: 'Completed',
};

const statusColors: Record<string, string> = {
  needs_new_painter: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  offer_sent: 'bg-gray-500/20 text-[var(--text-secondary)] border-gray-500/40',
  searching_painter: 'bg-gray-500/20 text-[var(--text-secondary)] border-gray-500/40',
  painter_accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/40',
  completed: 'bg-blue-500/20 text-[var(--accent-blue)] border-blue-500/40',
};

const STEPS = ['Sent', 'Accepted', 'Deposit', 'Done'];
const STEP_INDEX: Record<string, number> = { offer_sent: 0, searching_painter: 0, painter_accepted: 1, confirmed: 2, completed: 3 };

function ProgressSteps({ status }: { status: string }) {
  const current = STEP_INDEX[status] ?? 0;
  return (
    <ol className="flex items-center gap-1.5 mb-2 text-[11px]">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-1 flex-1 min-w-0">
          <span
            className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center font-semibold text-[10px] ${
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
    return <p className="text-xs text-[var(--text-faint)]">✓ Request sent — your painter will confirm the new date.</p>;
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-[var(--text-faint)]">Different start date?</span>
      <input
        type="date"
        value={date}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)}
        className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!date || state === 'sending'}
        className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Request change'}
      </button>
      {state === 'error' && <span className="text-xs text-[var(--danger)]">Couldn't send — try again.</span>}
    </div>
  );
}

/** "Cancel request" for a request still waiting for a painter. Asks first; the server refuses if a painter accepted in the meantime. */
function CancelRequest({ projectId, onCancelled }: { projectId: string; onCancelled?: (id: string) => void }) {
  const { session } = useAuth();
  const [state, setState] = useState<'idle' | 'confirm' | 'sending'>('idle');
  const [error, setError] = useState('');

  const cancel = async () => {
    if (!session?.access_token) return;
    setState('sending');
    setError('');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/cancel-my-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data.code === 'already_cancelled') {
        onCancelled?.(projectId);
        return;
      }
      setError(data.error || "Couldn't cancel. Please try again.");
    } catch {
      setError("Couldn't cancel. Please try again.");
    }
    setState('idle');
  };

  return (
    <div className="mt-2.5">
      {state === 'idle' ? (
        <button
          type="button"
          onClick={() => setState('confirm')}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
        >
          Cancel request
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-secondary)]">Cancel this request? Painters will no longer be able to accept it.</span>
          <button
            type="button"
            onClick={cancel}
            disabled={state === 'sending'}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--danger)] text-[var(--danger)] disabled:opacity-50"
          >
            {state === 'sending' ? 'Cancelling…' : 'Yes, cancel it'}
          </button>
          <button
            type="button"
            onClick={() => setState('idle')}
            disabled={state === 'sending'}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-strong)] text-[var(--text-primary)] disabled:opacity-50"
          >
            Keep it
          </button>
        </div>
      )}
      {error && <p className="text-xs text-[var(--danger)] mt-1.5">{error}</p>}
    </div>
  );
}

const solidBtn ='inline-block px-3 py-1.5 bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors';
const outlineBtn = 'inline-block px-3 py-1.5 border border-[var(--accent-blue)] text-[var(--accent-blue)] text-xs font-semibold rounded-lg hover:bg-[var(--accent-blue)] hover:text-white transition-colors';
const rule = 'mt-2.5 pt-2.5 border-t border-[var(--border)]';

/**
 * One project on the dashboard, compact. `variant` says which section it is in: a request still being arranged, a scheduled (confirmed) job, or a finished job.
 * Everything the old My Projects cards could do is here: dates and deposit, contract, messages, calendar, reschedule, rating, work with again.
 */
export default function ProjectCard({ project, variant, unread = 0, autoOpenMessages = false, onMessagesClosed, onCancelled }: {
  project: Project;
  variant: 'request' | 'scheduled' | 'completed';
  unread?: number;
  autoOpenMessages?: boolean;
  onMessagesClosed?: () => void;
  /** A request waiting for a painter was cancelled from its card. */
  onCancelled?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  /** Start a new price for the painter who did this job: their ZIP is known and they come first in the results. */
  function workWithAgain() {
    if (!project.painterId || !project.painter) return;
    // a new estimate replaces anything half-finished, here and on the account
    clearEstimatorSession();
    if (user) void deleteAccountChatState(user.id);
    try {
      sessionStorage.setItem(WORK_WITH_KEY, JSON.stringify({ id: project.painterId, companyName: project.painter.company_name, zip: project.zip ?? '' }));
    } catch {
      // storage unavailable: the estimator just starts as usual
    }
    navigate('/#estimator');
  }

  const when = project.status === 'completed'
    ? (project.completedAt ? new Date(project.completedAt).toLocaleDateString() : 'Recently')
    : (project.scheduledDate ? fmtRange(project.scheduledDate, project.scheduledEndDate) : project.preferredDate ? `wants ${project.preferredDate}` : 'date not set');

  const loyalty = project.price != null ? Math.floor(project.price / 100) : 0;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3.5 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[var(--text-primary)] font-semibold text-[15px] leading-tight">{project.phaseLabel || 'Painting project'}</h3>
        <span className={`shrink-0 inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${statusColors[project.status] ?? statusColors.confirmed}`}>
          {statusLabels[project.status] ?? project.status}
        </span>
      </div>

      <p className="text-xs text-[var(--text-secondary)] mb-1.5">
        {project.painter && (
          <>
            {variant === 'completed' && project.painterId ? (
              <Link to={`/painters/${project.painterId}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] font-semibold">{project.painter.company_name}</Link>
            ) : (
              <span className="text-[var(--text-primary)] font-semibold">{project.painter.company_name}</span>
            )}
            {' · '}
          </>
        )}
        <span className="text-[var(--text-primary)]">{currency(project.price)}</span>
        {' · '}
        {when}
      </p>
      {project.address && <p className="text-xs text-[var(--text-faint)] mb-1.5 truncate">{project.address}</p>}

      {variant === 'request' && <ProgressSteps status={project.status} />}

      {project.painter?.email && variant !== 'completed' && (
        <p className="text-xs text-[var(--text-secondary)]">
          <a href={`mailto:${project.painter.email}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)]">{project.painter.email}</a>
          {' · '}
          <a href={`tel:${project.painter.phone}`} className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)]">{project.painter.phone}</a>
        </p>
      )}
      {project.painter && !project.painter.email && variant !== 'completed' && (
        <p className="text-xs text-[var(--text-faint)]">Contact details are shared once your deposit is paid.</p>
      )}

      {project.status === 'searching_painter' && (
        <p className={`${rule} text-xs text-[var(--text-faint)]`}>
          No painter is featured in your area yet, so we're finding one for you, within 48 hours. You'll get an email when one accepts. You haven't been charged.
        </p>
      )}

      {project.status === 'offer_sent' && (
        <p className={`${rule} text-xs text-[var(--text-faint)]`}>
          Sent to painters{project.offerSentAt ? ` on ${new Date(project.offerSentAt).toLocaleDateString()}` : ''}. You'll get an email when one accepts.
        </p>
      )}

      {variant === 'request' && (project.status === 'offer_sent' || project.status === 'searching_painter') && (
        <CancelRequest projectId={project.id} onCancelled={onCancelled} />
      )}

      {project.status === 'needs_new_painter' && (
        <div className={rule}>
          {project.needsNewPainter ? (
            <>
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                Your painter couldn't take this job. Pick another before {new Date(project.needsNewPainter.expiresAt).toLocaleString()}.
              </p>
              <a href={project.needsNewPainter.resumeUrl} className={solidBtn}>See my matching painters</a>
            </>
          ) : (
            <p className="text-xs text-[var(--text-faint)]">The window to pick another painter has ended.</p>
          )}
        </div>
      )}

      {(project.contract?.pending || project.contract?.accepted) && (
        <div className={`${rule} flex items-center gap-3 flex-wrap`}>
          <Link to={`/customer/dashboard/contract/${project.id}`} className={outlineBtn}>
            {project.contract.pending ? 'Review your contract' : 'View your contract'}
          </Link>
          {project.contract.pending && <span className="text-xs text-[var(--accent)]">Waiting for your answer</span>}
        </div>
      )}

      {project.status === 'painter_accepted' && (
        <div className={rule}>
          {project.confirmUrl ? (
            <a href={project.confirmUrl} className={solidBtn}>
              {project.dateState === 'agreed' ? 'Pay deposit & confirm' : project.dateState === 'customer_countered' ? 'View your dates' : 'Confirm dates & pay deposit'}
            </a>
          ) : (
            <p className="text-xs text-[var(--text-faint)]">Your painter is choosing a start date. We'll email you when their dates are ready.</p>
          )}
          <div className="mt-2">
            <MessageButton jobId={project.id} role="customer" status={project.status} />
          </div>
        </div>
      )}

      {project.status === 'confirmed' && (
        <div className={`${rule} space-y-2.5`}>
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
          <MessageButton jobId={project.id} role="customer" status={project.status} unread={unread} autoOpen={autoOpenMessages} onClosed={onMessagesClosed} />
          <RescheduleRequest projectId={project.id} />
        </div>
      )}

      {project.status === 'completed' && (
        <div className={`${rule} flex items-center justify-between flex-wrap gap-2`}>
          {project.reviewSubmitted ? (
            <span className="text-xs text-[var(--text-faint)]">✓ You reviewed this painter — thanks!</span>
          ) : project.reviewToken ? (
            <Link to={`/leave-review?token=${project.reviewToken}`} className={solidBtn}>Rate this painter</Link>
          ) : null}
          {project.painterId && project.painter?.company_name && (
            <button type="button" onClick={workWithAgain} className={outlineBtn}>Work with again</button>
          )}
          {loyalty > 0 && (
            <span className="text-xs text-[var(--accent-blue)]">+{loyalty} loyalty point{loyalty === 1 ? '' : 's'}</span>
          )}
        </div>
      )}
    </div>
  );
}
