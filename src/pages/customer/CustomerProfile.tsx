import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/index.ts';
import { supabase } from '../../lib/supabase';
import AccountSettings from '../../components/account/AccountSettings';

export default function CustomerProfile() {
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const email = user?.email ?? 'No email';

  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) return setMessage({ kind: 'error', text: 'Please enter your name.' });
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), phone: phone.trim() || null })
      .eq('id', user.id);
    if (error) {
      setMessage({ kind: 'error', text: 'We couldn\'t save your changes. Please try again.' });
    } else {
      await refreshProfile();
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Profile</h1>

      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-ink)] text-2xl font-bold">
          {initials}
        </div>
        <div>
          <p className="text-[var(--text-primary)] text-lg font-semibold">{profile?.display_name || 'Customer'}</p>
          <p className="text-[var(--text-secondary)] text-sm">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 mb-12">
        <div>
          <label htmlFor="displayName" className="block text-[var(--text-secondary)] text-sm mb-2">Display name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setMessage(null); }}
            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-[var(--text-secondary)] text-sm mb-2">Phone</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setMessage(null); }}
            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            placeholder="(555) 123-4567"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {message && (
            <span className={`text-sm ${message.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</span>
          )}
        </div>
      </form>

      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Account</h2>
      <AccountSettings />
    </div>
  );
}
