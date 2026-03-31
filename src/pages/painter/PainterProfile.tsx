import { useState } from 'react';

interface ProfileForm {
  companyName: string;
  ownerName: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  bio: string;
  licenseNumber: string;
  insured: boolean;
  bonded: boolean;
}

const initialProfile: ProfileForm = {
  companyName: 'Pro Painters Co.',
  ownerName: 'John Smith',
  phone: '(555) 123-4567',
  city: 'Dallas',
  state: 'TX',
  zip: '75201',
  bio: 'Professional painting company with over 15 years of experience serving the Dallas-Fort Worth area. We specialize in interior and exterior residential and commercial painting.',
  licenseNumber: 'TX-PAINT-2024-0042',
  insured: true,
  bonded: true,
};

export default function PainterProfile() {
  const [form, setForm] = useState<ProfileForm>(initialProfile);
  const [saved, setSaved] = useState(false);

  const update = (field: keyof ProfileForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputClass =
    'w-full px-3 py-2 bg-[#1a1a1a] border border-[#555] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#f5a623] transition-colors';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Edit Profile</h1>

      {saved && (
        <div className="bg-green-900/30 border border-green-600 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
          Profile saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company info */}
        <div className="bg-[#222] border border-[#333] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-2">Company Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Owner Name</label>
              <input
                type="text"
                value={form.ownerName}
                onChange={(e) => update('ownerName', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">ZIP Code</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => update('zip', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
              rows={4}
              className={inputClass + ' resize-vertical'}
            />
          </div>
        </div>

        {/* License & credentials */}
        <div className="bg-[#222] border border-[#333] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-2">Credentials</h2>

          <div>
            <label className="block text-sm text-gray-300 mb-1">License Number</label>
            <input
              type="text"
              value={form.licenseNumber}
              onChange={(e) => update('licenseNumber', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  form.insured ? 'bg-[#f5a623]' : 'bg-[#555]'
                }`}
                onClick={() => update('insured', !form.insured)}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    form.insured ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-sm text-gray-300">Insured</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  form.bonded ? 'bg-[#f5a623]' : 'bg-[#555]'
                }`}
                onClick={() => update('bonded', !form.bonded)}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    form.bonded ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-sm text-gray-300">Bonded</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-8 py-3 bg-[#f5a623] hover:bg-[#e09500] text-black font-semibold rounded-lg transition-colors"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}
