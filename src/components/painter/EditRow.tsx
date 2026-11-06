import { useState, type ReactNode } from 'react';

export const editInput =
  'w-full px-2.5 py-1 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-[13px] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

function Pencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * One line of the profile: the label, the value, and a little pencil. Tapping the pencil swaps the value for the editor right there, with Save and
 * Cancel. `onSave` returns an error message to show (and stay open), or null when it has saved.
 */
export default function EditRow({ label, value, editor, onSave, onOpen, block = false }: {
  label: string;
  value: ReactNode;
  editor: ReactNode;
  onSave: () => Promise<string | null>;
  /** Called when the editor opens, so the caller can reset its draft to the saved value. */
  onOpen?: () => void;
  /** Put the value under the label instead of beside it (long text). */
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    const problem = await onSave();
    setBusy(false);
    if (problem) setError(problem);
    else setOpen(false);
  };

  if (open) {
    return (
      <div className="py-1.5 border-b border-[var(--border)] last:border-b-0">
        <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] mb-1">{label}</p>
        {editor}
        {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
        <div className="flex gap-2 mt-2">
          <button type="button" disabled={busy} onClick={save} className="px-2.5 py-0.5 rounded-md bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(''); }} className="px-2.5 py-0.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`py-1.5 border-b border-[var(--border)] last:border-b-0 flex gap-3 min-w-0 ${block ? 'flex-col' : 'items-center justify-between'}`}>
      <div className={`flex ${block ? 'items-center justify-between' : 'items-center justify-between w-full'} gap-3 min-w-0`}>
        <p className={`text-[10px] uppercase tracking-wide text-[var(--text-faint)] min-w-0 ${block ? '' : 'flex-1'}`}>{label}</p>
        {!block && <div className="text-[13px] text-[var(--text-primary)] text-right break-words shrink-0 max-w-[60%]">{value}</div>}
        <button
          type="button"
          onClick={() => { onOpen?.(); setOpen(true); }}
          aria-label={`Edit ${label}`}
          className="text-[var(--text-faint)] hover:text-[var(--accent)] p-1 -m-1 shrink-0"
        >
          <Pencil />
        </button>
      </div>
      {block && <div className="text-[13px] text-[var(--text-primary)] min-w-0 w-full [overflow-wrap:anywhere]">{value}</div>}
    </div>
  );
}
