import { useEffect, useState } from 'react';
import MessageThread from './MessageThread';

const LOCKED_HINT = 'Available once both of you have confirmed';

function BubbleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 21l1.9-5.1A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
    </svg>
  );
}

/**
 * The speech-bubble button on a project: "Message client" for the painter, "Message painter" for the customer. It is live once the job
 * is confirmed (both sides have said yes and it is on the schedule) and shown disabled, with a hint, while it is only accepted.
 * `unread` is the number of messages waiting; `autoOpen` opens the thread straight away (a notification's link).
 */
export default function MessageButton({ jobId, role, status, unread = 0, autoOpen = false, onClosed }: {
  jobId: string;
  role: 'customer' | 'painter';
  status: string;
  unread?: number;
  autoOpen?: boolean;
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const enabled = status === 'confirmed';
  const label = role === 'painter' ? 'Message client' : 'Message painter';

  useEffect(() => { if (autoOpen && enabled) setOpen(true); }, [autoOpen, enabled]);

  return (
    <>
      <button
        type="button"
        disabled={!enabled}
        title={enabled ? label : LOCKED_HINT}
        aria-label={enabled && unread > 0 ? `${label} (${unread} unread)` : label}
        onClick={() => setOpen(true)}
        className={`relative inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${enabled ? 'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]' : 'border-[var(--border)] text-[var(--text-faint)] cursor-not-allowed opacity-70'}`}
      >
        <BubbleIcon />
        {label}
        {enabled && unread > 0 && (
          <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-xs font-bold leading-5 text-center">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {!enabled && <p className="mt-1 text-xs text-[var(--text-faint)]">{LOCKED_HINT}.</p>}
      {open && enabled && <MessageThread jobId={jobId} onClose={() => { setOpen(false); onClosed?.(); }} />}
    </>
  );
}
