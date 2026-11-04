import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/index.ts';
import { supabase } from '../../lib/supabase';
import AccountSettings from '../../components/account/AccountSettings';
import AddressField from '../../components/AddressField';

export default function CustomerProfile() {
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [zip, setZip] = useState(profile?.zip_code ?? '');
  const [street, setStreet] = useState(profile?.street_address ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [stateCode, setStateCode] = useState(profile?.state ?? '');
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
    const zipClean = zip.trim();
    if (zipClean && !/^\d{5}$/.test(zipClean)) return setMessage({ kind: 'error', text: 'Please enter a 5-digit ZIP code.' });
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), phone: phone.trim() || null, zip_code: zipClean || null, street_address: street.trim() || null, city: city.trim() || null, state: stateCode.trim().toUpperCase() || null })
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

        <div>
          <label htmlFor="street" className="block text-[var(--text-secondary)] text-sm mb-2">Your address</label>
          <AddressField
            id="street"
            value={street}
            onChange={(t) => { setStreet(t); setMessage(null); }}
            onPick={(p) => { setCity(p.city); setStateCode(p.state); setZip(p.zip.slice(0, 5)); setMessage(null); }}
            placeholder="Start typing your street address"
            className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 mt-3">
            <input type="text" aria-label="City" value={city} onChange={(e) => { setCity(e.target.value); setMessage(null); }} className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors" placeholder="City" autoComplete="address-level2" />
            <input type="text" aria-label="State" maxLength={2} value={stateCode} onChange={(e) => { setStateCode(e.target.value.toUpperCase()); setMessage(null); }} className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors" placeholder="CA" autoComplete="address-level1" />
            <input id="zip" type="text" aria-label="ZIP code" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, '')); setMessage(null); }} className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors" placeholder="91941" autoComplete="postal-code" />
          </div>
          <p className="text-xs text-[var(--text-faint)] mt-1">Fills in the form when you claim a price (you can change it there if the job is at a different address), and the painters map opens on your area.</p>
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
