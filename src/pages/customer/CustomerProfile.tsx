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
      <h1 className="text-3xl font-bold text-white mb-8">My Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-[#f5a623] flex items-center justify-center text-black text-2xl font-bold">
          {initials}
        </div>
        <div>
          <p className="text-white text-lg font-semibold">
            {displayName || 'Customer'}
          </p>
          <p className="text-gray-400 text-sm">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Display Name */}
        <div>
          <label
            htmlFor="displayName"
            className="block text-gray-400 text-sm mb-2"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#f5a623] transition-colors"
            placeholder="Your name"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label htmlFor="email" className="block text-gray-400 text-sm mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-gray-400 text-sm mb-2">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#f5a623] transition-colors"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="px-6 py-3 bg-[#f5a623] text-black font-semibold rounded-lg hover:bg-[#e09510] transition-colors"
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
