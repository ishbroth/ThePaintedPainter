import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/index.ts';
import { supabase } from '../../lib/supabase';
import AddressField from '../AddressField';

const input = 'w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';

/** A head-and-shoulders silhouette for a customer with no picture. */
function Silhouette() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
      <rect width="64" height="64" fill="var(--bg-chrome)" />
      <circle cx="32" cy="24" r="11" fill="var(--text-faint)" />
      <path d="M10 64c1-15 10-23 22-23s21 8 22 23Z" fill="var(--text-faint)" />
    </svg>
  );
}

/**
 * The top of the customer dashboard: picture (or silhouette), name, email, phone and address, with an Edit button that opens the form
 * the old Profile page had (name, phone, address with Google suggestions, city, state, ZIP).
 */
export default function ProfileBlock() {
  const { user, profile, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [zip, setZip] = useState(profile?.zip_code ?? '');
  const [street, setStreet] = useState(profile?.street_address ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [stateCode, setStateCode] = useState(profile?.state ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const email = user?.email ?? 'No email';
  const cityLine = [profile?.city, [profile?.state, profile?.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const addressLine = [profile?.street_address, cityLine].filter(Boolean).join(', ');

  const open = () => {
    // start from what is saved, not from an earlier unsaved edit
    setDisplayName(profile?.display_name ?? '');
    setPhone(profile?.phone ?? '');
    setZip(profile?.zip_code ?? '');
    setStreet(profile?.street_address ?? '');
    setCity(profile?.city ?? '');
    setStateCode(profile?.state ?? '');
    setMessage(null);
    setEditing(true);
  };

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
      setMessage({ kind: 'error', text: "We couldn't save your changes. Please try again." });
    } else {
      await refreshProfile();
      setEditing(false);
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    }
    setSaving(false);
  };

  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3.5">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden border border-[var(--border-strong)]">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <Silhouette />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[var(--text-primary)] text-lg font-bold leading-tight truncate">{profile?.display_name || 'Customer'}</p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{email}</p>
          {profile?.phone && <p className="text-xs text-[var(--text-secondary)] truncate">{profile.phone}</p>}
          {addressLine ? (
            <p className="text-xs text-[var(--text-faint)] truncate">{addressLine}</p>
          ) : (
            <p className="text-xs text-[var(--text-faint)]">No address yet — add one to speed up your next price.</p>
          )}
        </div>
        {!editing && (
          <button type="button" onClick={open} className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors" aria-label="Edit profile">
            ✎ Edit
          </button>
        )}
      </div>

      {message && !editing && (
        <p className={`text-xs mt-2 ${message.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</p>
      )}

      {editing && (
        <form onSubmit={handleSave} className="mt-3 pt-3 border-t border-[var(--border)] space-y-2.5">
          <div>
            <label htmlFor="displayName" className="block text-xs text-[var(--text-secondary)] mb-1">Name</label>
            <input id="displayName" type="text" value={displayName} onChange={(e) => { setDisplayName(e.target.value); setMessage(null); }} className={input} placeholder="Your name" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs text-[var(--text-secondary)] mb-1">Phone</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setMessage(null); }} className={input} placeholder="(555) 123-4567" autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="street" className="block text-xs text-[var(--text-secondary)] mb-1">Address</label>
            <AddressField
              id="street"
              value={street}
              onChange={(t) => { setStreet(t); setMessage(null); }}
              onPick={(p) => { setCity(p.city); setStateCode(p.state); setZip(p.zip.slice(0, 5)); setMessage(null); }}
              placeholder="Start typing your street address"
              className={input}
            />
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 mt-2">
              <input type="text" aria-label="City" value={city} onChange={(e) => { setCity(e.target.value); setMessage(null); }} className={input} placeholder="City" autoComplete="address-level2" />
              <input type="text" aria-label="State" maxLength={2} value={stateCode} onChange={(e) => { setStateCode(e.target.value.toUpperCase()); setMessage(null); }} className={input} placeholder="CA" autoComplete="address-level1" />
              <input id="zip" type="text" aria-label="ZIP code" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => { setZip(e.target.value.replace(/\D/g, '')); setMessage(null); }} className={input} placeholder="91941" autoComplete="postal-code" />
            </div>
            <p className="text-[11px] text-[var(--text-faint)] mt-1">Pre-fills your next price (change it there for a different address) and centers the painters map on you.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setMessage(null); }} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)]">Cancel</button>
            {message && <span className={`text-xs ${message.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
