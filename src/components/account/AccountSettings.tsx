import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase, supabaseUrl } from '../../lib/supabase';

const inputClass =
  'w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors text-sm';
const primaryBtn =
  'px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-ink)] font-semibold rounded-lg transition-colors text-sm whitespace-nowrap';
const card = 'bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 mb-6';

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onChange}
      className={`w-12 h-6 rounded-full relative transition-colors disabled:opacity-50 ${enabled ? 'bg-[var(--accent)]' : 'bg-[var(--input-border)]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  );
}

type Message = { kind: 'ok' | 'error'; text: string } | null;

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  const ok = message.kind === 'ok';
  return (
    <p className={`text-sm mt-3 ${ok ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</p>
  );
}

/**
 * Account controls shared by customers and painters: email, password,
 * notification preferences, and account deletion. Everything here goes to the
 * real backend; a message only says "updated" after the server confirmed it.
 */
export default function AccountSettings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // Email
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Message>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Message>(null);

  // Notifications
  const prefs = profile?.notification_prefs ?? { email: true, push: true };
  const [prefBusy, setPrefBusy] = useState(false);
  const [prefMsg, setPrefMsg] = useState<Message>(null);

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<Message>(null);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      return setEmailMsg({ kind: 'error', text: 'That\'s already your email.' });
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailBusy(false);
    if (error) return setEmailMsg({ kind: 'error', text: error.message });
    setNewEmail('');
    setEmailMsg({ kind: 'ok', text: `We sent a confirmation link to ${newEmail.trim()}. Your email changes once you click it — until then you still sign in with ${user?.email}.` });
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) return setPwMsg({ kind: 'error', text: 'New password must be at least 8 characters.' });
    if (newPassword !== confirmPassword) return setPwMsg({ kind: 'error', text: 'New passwords don\'t match.' });
    if (!user?.email) return;
    setPwBusy(true);
    // Prove it's really them before changing it.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) {
      setPwBusy(false);
      return setPwMsg({ kind: 'error', text: 'Your current password isn\'t correct.' });
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (error) return setPwMsg({ kind: 'error', text: error.message });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwMsg({ kind: 'ok', text: 'Password updated.' });
  };

  const setPref = async (key: 'email' | 'push') => {
    if (!user) return;
    setPrefBusy(true);
    setPrefMsg(null);
    const next = { ...prefs, [key]: !prefs[key] };
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id);
    if (error) setPrefMsg({ kind: 'error', text: 'Couldn\'t save that. Please try again.' });
    else await refreshProfile();
    setPrefBusy(false);
  };

  const handleDelete = async () => {
    setDeleteMsg(null);
    setDeleteBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not delete your account.');
      await signOut();
      navigate('/');
    } catch (err) {
      setDeleteMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not delete your account.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleEmail} className={card}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Email address</h2>
        <p className="text-sm text-[var(--text-faint)] mb-4">Current: {user?.email}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className={inputClass + ' flex-1'} />
          <button type="submit" disabled={emailBusy} className={primaryBtn}>{emailBusy ? 'Sending…' : 'Change email'}</button>
        </div>
        <Notice message={emailMsg} />
      </form>

      <form onSubmit={handlePassword} className={card + ' space-y-4'}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change password</h2>
        <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className={inputClass} />
        <input type="password" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className={inputClass} />
        <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className={inputClass} />
        <button type="submit" disabled={pwBusy} className={primaryBtn}>{pwBusy ? 'Updating…' : 'Update password'}</button>
        <Notice message={pwMsg} />
      </form>

      <div className={card}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Notification preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">Email updates</p>
              <p className="text-xs text-[var(--text-faint)]">Job offers, reminders and progress updates. Receipts and confirmations are always sent.</p>
            </div>
            <Toggle enabled={prefs.email} onChange={() => setPref('email')} disabled={prefBusy} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">Push notifications</p>
              <p className="text-xs text-[var(--text-faint)]">Alerts on your phone or browser. Turn them on per device from the Notifications page.</p>
            </div>
            <Toggle enabled={prefs.push} onChange={() => setPref('push')} disabled={prefBusy} />
          </div>
        </div>
        <Notice message={prefMsg} />
      </div>

      <div className="bg-[var(--bg-surface)] border border-red-900/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--danger)] mb-2">Delete account</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          This permanently deletes your login and profile. Records of completed, paid jobs are kept for both sides' history. You can't delete while a job is in progress.
        </p>
        {showDelete ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 space-y-3">
            <p className="text-sm text-[var(--danger)]">Enter your password to confirm. This can't be undone.</p>
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Your password" className={inputClass} />
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={!deletePassword || deleteBusy}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {deleteBusy ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button
                onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteMsg(null); }}
                className="px-4 py-2 border border-[var(--input-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            <Notice message={deleteMsg} />
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="px-5 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 text-sm font-semibold rounded-lg transition-colors">
            Delete account
          </button>
        )}
      </div>
    </div>
  );
}
