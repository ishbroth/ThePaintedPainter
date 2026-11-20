import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../lib/auth';
import { MAX_MESSAGE_LENGTH, MAX_REPORT_DETAILS, MessagingError, REPORT_REASONS, loadThread, reportThread, sendMessage, setMessagingBlocked, type ReportReason, type Thread } from '../../lib/jobMessages';

const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * One conversation between a job's customer and painter, as a dialog. Messages are shown as plain text (never as HTML), the
 * thread refreshes while it is open, and Ctrl/Cmd+Enter sends. Whether anyone can write is decided by the server.
 */
export default function MessageThread({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastCount = useRef(0);
  // report / block
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportFor, setReportFor] = useState<{ messageId?: string } | null>(null);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => {
    if (!token) return;
    loadThread(token, jobId)
      .then((t) => { setThread(t); setError(''); setLocked(false); })
      .catch((e) => { setError(e instanceof Error ? e.message : 'Could not load the messages.'); setLocked(e instanceof MessagingError && e.locked); });
  }, [token, jobId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (reportFor) setReportFor(null); else if (menuOpen) setMenuOpen(false); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, reportFor, menuOpen]);

  useEffect(() => {
    if (thread && thread.messages.length !== lastCount.current) {
      lastCount.current = thread.messages.length;
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [thread]);

  useEffect(() => { if (thread?.canSend) inputRef.current?.focus(); }, [thread?.canSend]);

  const send = async () => {
    if (!token || sending || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const { message } = await sendMessage(token, jobId, draft);
      setThread((t) => (t ? { ...t, messages: [...t.messages, message] } : t));
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  };

  const toggleBlock = async () => {
    if (!token || !thread) return;
    setMenuOpen(false);
    const turnOff = !thread.blockedByMe;
    if (turnOff && !window.confirm('Turn off messaging for this job? Neither of you will be able to send messages. The job itself is not affected, and you can turn messaging back on later.')) return;
    try {
      await setMessagingBlocked(token, jobId, turnOff);
      setNotice(turnOff ? 'Messaging is turned off for this job.' : 'Messaging is back on.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change that. Please try again.');
    }
  };

  const openReport = (messageId?: string) => {
    setMenuOpen(false);
    setReason(''); setDetails(''); setAlsoBlock(true); setReportError('');
    setReportFor({ messageId });
  };

  const submitReport = async () => {
    if (!token || reportBusy || !reason) return;
    setReportBusy(true);
    setReportError('');
    try {
      const r = await reportThread(token, jobId, { reason, details: details.trim() || undefined, messageId: reportFor?.messageId, alsoBlock });
      setReportFor(null);
      setNotice(r.blocked ? 'Thank you. We have your report and will look into it. Messaging is turned off for this job.' : 'Thank you. We have your report and will look into it.');
      refresh();
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Could not send your report. Please try again.');
    } finally {
      setReportBusy(false);
    }
  };

  const otherName = thread?.otherName ?? 'them';
  // drawn at the root of the page, so it never inherits alignment or clipping from the project card it was opened from
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Messages with ${otherName}`} className="relative w-full sm:max-w-lg text-left h-[85vh] sm:h-[600px] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{thread ? `Messages with ${otherName}` : 'Messages'}</h2>
          <div className="flex items-center gap-1 relative">
            {thread && (
              <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="More options" aria-haspopup="menu" aria-expanded={menuOpen} className="px-2 py-1 text-xl leading-none text-[var(--text-secondary)] hover:text-[var(--text-primary)]">⋯</button>
            )}
            <button type="button" onClick={onClose} aria-label="Close messages" className="px-2 py-1 text-xl leading-none text-[var(--text-secondary)] hover:text-[var(--text-primary)]">×</button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 z-10 w-56 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg py-1 text-sm">
                <button type="button" role="menuitem" onClick={() => openReport()} className="block w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-page)]">Report {otherName}</button>
                {(!thread?.blocked || thread?.blockedByMe) && (
                  <button type="button" role="menuitem" onClick={() => void toggleBlock()} className="block w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-page)]">
                    {thread?.blockedByMe ? 'Turn messaging back on' : 'Turn off messaging'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!thread && !error && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
          {locked && <p className="text-sm text-[var(--text-secondary)]">{error}</p>}
          {thread && thread.messages.length === 0 && <p className="text-sm text-[var(--text-faint)] text-center py-8">No messages yet. Say hello and share anything that helps the job go smoothly.</p>}
          {thread?.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'bg-[var(--bg-page)] text-[var(--text-primary)] border border-[var(--border)]'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${m.from === 'me' ? 'opacity-70' : 'text-[var(--text-faint)]'}`}>{when(m.createdAt)}{m.from === 'me' ? (m.read ? ' · Seen' : ' · Sent') : ''}{m.from === 'them' && (<> · <button type="button" onClick={() => openReport(m.id)} className="underline hover:text-[var(--text-secondary)]">Report</button></>)}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {notice && <p role="status" className="px-4 py-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)]">{notice}</p>}
        {thread?.blocked && !locked && (
          <p className="px-4 py-2 text-xs text-[var(--text-faint)] border-t border-[var(--border)]">
            Messaging has been turned off for this job, so neither of you can send messages. {thread.blockedByMe ? 'You can turn it back on from the ⋯ menu.' : ''}
          </p>
        )}
        {thread && !thread.canSend && !thread.blocked && !locked && <p className="px-4 py-2 text-xs text-[var(--text-faint)] border-t border-[var(--border)]">This job is finished, so this conversation is read-only.</p>}
        {error && !locked && <p role="alert" className="px-4 pt-2 text-sm text-[var(--danger)]">{error}</p>}
        {thread?.canSend && (
          <div className="p-3 border-t border-[var(--border)]">
            <textarea
              ref={inputRef}
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
              placeholder={`Write to ${otherName}…`}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-page)] p-2 text-sm text-[var(--text-primary)]"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-[var(--text-faint)]">{draft.length}/{MAX_MESSAGE_LENGTH}</span>
              <button type="button" onClick={() => void send()} disabled={sending || !draft.trim()} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-50">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
        {reportFor && (
          <div className="absolute inset-0 z-20 flex flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] p-4 overflow-y-auto" role="group" aria-label="Report">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Report {otherName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{reportFor.messageId ? 'You are reporting the message you chose. ' : ''}We will look at the recent conversation. {otherName} is not told that you reported them.</p>
            <fieldset className="mt-3 space-y-2">
              <legend className="text-sm font-medium text-[var(--text-primary)]">What is wrong?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} /> {r.label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm font-medium text-[var(--text-primary)]">Anything else we should know? (optional)
              <textarea value={details} maxLength={MAX_REPORT_DETAILS} rows={3} onChange={(e) => setDetails(e.target.value)} className="mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-page)] p-2 text-sm font-normal text-[var(--text-primary)]" />
            </label>
            {!thread?.blocked && (
              <label className="mt-3 flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <input type="checkbox" className="mt-1" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
                <span>Also turn off messaging for this job. The job itself is not affected.</span>
              </label>
            )}
            {reportError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{reportError}</p>}
            <div className="mt-auto pt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReportFor(null)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-primary)]">Cancel</button>
              <button type="button" onClick={() => void submitReport()} disabled={reportBusy || !reason} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] disabled:opacity-50">
                {reportBusy ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
