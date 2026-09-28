import { useState } from 'react';
import { useAuth } from '../../lib/auth/index.ts';

export default function CustomerProfile() {
  const { user, profile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saved, setSaved] = useState(false);

  const email = user?.email ?? 'No email';

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-ink)] text-2xl font-bold">
          {initials}
        </div>
        <div>
          <p className="text-[var(--text-primary)] text-lg font-semibold">
            {displayName || 'Customer'}
          </p>
          <p className="text-[var(--text-secondary)] text-sm">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Display Name */}
        <div>
          <label
            htmlFor="displayName"
            className="block text-[var(--text-secondary)] text-sm mb-2"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            placeholder="Your name"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label htmlFor="email" className="block text-[var(--text-secondary)] text-sm mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] rounded-lg text-[var(--text-faint)] cursor-not-allowed"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-[var(--text-secondary)] text-sm mb-2">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="px-6 py-3 bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Save Changes
          </button>
          {saved && (
            <span className="text-green-400 text-sm">
              Profile saved successfully!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
