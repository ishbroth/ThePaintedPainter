import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../lib/auth';
import { MAX_MESSAGE_LENGTH, MessagingError, loadThread, sendMessage, type Thread } from '../../lib/jobMessages';

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const otherName = thread?.otherName ?? 'them';
  // drawn at the root of the page, so it never inherits alignment or clipping from the project card it was opened from
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Messages with ${otherName}`} className="w-full sm:max-w-lg text-left h-[85vh] sm:h-[600px] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{thread ? `Messages with ${otherName}` : 'Messages'}</h2>
          <button type="button" onClick={onClose} aria-label="Close messages" className="px-2 py-1 text-xl leading-none text-[var(--text-secondary)] hover:text-[var(--text-primary)]">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!thread && !error && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
          {locked && <p className="text-sm text-[var(--text-secondary)]">{error}</p>}
          {thread && thread.messages.length === 0 && <p className="text-sm text-[var(--text-faint)] text-center py-8">No messages yet. Say hello and share anything that helps the job go smoothly.</p>}
          {thread?.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'bg-[var(--bg-page)] text-[var(--text-primary)] border border-[var(--border)]'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${m.from === 'me' ? 'opacity-70' : 'text-[var(--text-faint)]'}`}>{when(m.createdAt)}{m.from === 'me' ? (m.read ? ' · Seen' : ' · Sent') : ''}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {thread && !thread.canSend && !locked && <p className="px-4 py-2 text-xs text-[var(--text-faint)] border-t border-[var(--border)]">This job is finished, so this conversation is read-only.</p>}
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
      </div>
    </div>,
    document.body,
  );
}
