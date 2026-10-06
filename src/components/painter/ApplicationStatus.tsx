import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase, supabaseUrl } from '../../lib/supabase';

interface Task {
  id: string;
  label: string;
  done: boolean;
}

interface ApplicationData {
  status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
  tasks: Task[];
  adminMessage: string | null;
  nextReminderAt: string | null;
  canRemind: boolean;
}

const BUCKET = 'painter-documents';

/**
 * Shown at the top of every painter page until the application is approved:
 * pending (with a once-a-month "remind" button), needs_info (a task checklist
 * with document upload), or rejected (with the reason).
 */
export default function ApplicationStatus() {
  const { session, user } = useAuth();
  const [data, setData] = useState<ApplicationData | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const token = session?.access_token;

  const call = useCallback(
    async (method: 'GET' | 'POST', body?: unknown) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/painter-application`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      return { ok: res.ok, json };
    },
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const { ok, json } = await call('GET');
    if (ok) {
      setData(json);
      setChecked(new Set((json.tasks as Task[]).filter((t) => t.done).map((t) => t.id)));
    }
  }, [call, token]);

  const refreshUploads = useCallback(async () => {
    if (!user) return;
    const { data: files } = await supabase.storage.from(BUCKET).list(user.id, { limit: 100 });
    const byTask: Record<string, string[]> = {};
    for (const f of files ?? []) {
      const taskId = f.name.split('__')[0];
      (byTask[taskId] ??= []).push(f.name.split('__').slice(1).join('__'));
    }
    setUploads(byTask);
  }, [user]);

  useEffect(() => {
    refresh();
    refreshUploads();
  }, [refresh, refreshUploads]);

  // The profile's credentials editor fires this after a save that may have paused the account.
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('painter-application-changed', onChange);
    return () => window.removeEventListener('painter-application-changed', onChange);
  }, [refresh]);

  if (!data || data.status === 'approved') return null;

  const remind = async () => {
    setBusy(true);
    setMessage('');
    const { ok, json } = await call('POST', { action: 'remind' });
    setMessage(ok ? 'Reminder sent — thanks for your patience.' : json.error || 'Could not send reminder.');
    await refresh();
    setBusy(false);
  };

  const upload = async (task: Task, file: File | undefined) => {
    if (!file || !user) return;
    setBusy(true);
    setMessage('');
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const { error } = await supabase.storage.from(BUCKET).upload(`${user.id}/${task.id}__${safeName}`, file, { upsert: true });
    if (error) setMessage(`Upload failed: ${error.message}`);
    else setChecked((prev) => new Set(prev).add(task.id));
    await refreshUploads();
    setBusy(false);
  };

  const submitTasks = async () => {
    setBusy(true);
    setMessage('');
    const { ok, json } = await call('POST', { action: 'submit_tasks', doneTaskIds: [...checked] });
    setMessage(ok ? 'Sent for review — we\'ll email you once it\'s been looked at.' : json.error || 'Could not submit.');
    await refresh();
    setBusy(false);
  };

  const box: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  };
  const badge = (text: string, tint: string) => (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: tint, color: 'var(--text-primary)' }}>
      {text}
    </span>
  );
  const button: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-ink)',
    fontWeight: 700,
    fontSize: '0.85rem',
  };

  return (
    <div style={box}>
      {data.status === 'pending' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            {badge('Pending approval', 'var(--tint-warning-bg)')}
            <strong style={{ color: 'var(--text-primary)' }}>We're reviewing your application</strong>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 12px' }}>
            You'll start receiving job offers once you're approved. If we need anything else from you, it'll show up here as tasks.
          </p>
          <button
            style={{ ...button, opacity: data.canRemind && !busy ? 1 : 0.5, cursor: data.canRemind && !busy ? 'pointer' : 'not-allowed' }}
            disabled={!data.canRemind || busy}
            onClick={remind}
          >
            Send a reminder
          </button>
          {!data.canRemind && data.nextReminderAt && (
            <span style={{ marginLeft: 10, color: 'var(--text-faint)', fontSize: '0.8rem' }}>
              Available again {new Date(data.nextReminderAt).toLocaleDateString()}
            </span>
          )}
        </>
      )}

      {(data.status === 'needs_info' || data.status === 'suspended') && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            {badge(data.status === 'suspended' ? 'Leads paused' : 'Action needed', 'var(--tint-warning-bg)')}
            <strong style={{ color: 'var(--text-primary)' }}>
              {data.status === 'suspended' ? 'We\'re re-verifying your account (usually 1–3 days)' : 'Complete these to finish your application'}
            </strong>
          </div>
          {data.adminMessage && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 12px' }}>{data.adminMessage}</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'grid', gap: 10 }}>
            {data.tasks.map((t) => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={checked.has(t.id)}
                    onChange={(e) =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(t.id);
                        else next.delete(t.id);
                        return next;
                      })
                    }
                  />
                  {t.label}
                </label>
                <label style={{ color: 'var(--accent-blue)', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Upload document / photo
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => upload(t, e.target.files?.[0])} />
                </label>
                {(uploads[t.id] ?? []).map((name) => (
                  <span key={name} style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>✓ {name}</span>
                ))}
              </li>
            ))}
          </ul>
          <button style={{ ...button, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={submitTasks}>
            Submit for review
          </button>
        </>
      )}

      {data.status === 'rejected' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            {badge('Not approved', 'var(--tint-warning-bg)')}
            <strong style={{ color: 'var(--text-primary)' }}>Your application wasn't approved</strong>
          </div>
          {data.adminMessage && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>{data.adminMessage}</p>}
        </>
      )}

      {message && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '10px 0 0' }}>{message}</p>}
    </div>
  );
}
