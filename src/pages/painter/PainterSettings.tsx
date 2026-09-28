import { useState } from 'react';

export default function PainterSettings() {
  const [email, setEmail] = useState('john@propaintersco.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [dealAlerts, setDealAlerts] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleEmailSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Email updated successfully.');
  };

  const handlePasswordSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }
    showToast('Password updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const inputClass =
    'w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors text-sm';

  function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
    return (
      <div
        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
          enabled ? 'bg-[var(--accent)]' : 'bg-[var(--input-border)]'
        }`}
        onClick={onChange}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Settings</h1>

      {toast && (
        <div className="bg-[var(--tint-success-bg)] border border-[var(--tint-success-border)] text-[var(--success)] px-4 py-3 rounded-lg mb-6 text-sm">
          {toast}
        </div>
      )}

      {/* Email */}
      <form onSubmit={handleEmailSave} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Email Address</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass + ' flex-1'}
          />
          <button
            type="submit"
            className="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-ink)] font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Update Email
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={handlePasswordSave} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Change Password</h2>
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-1">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-1">New Password</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-1">Confirm New Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-ink)] font-semibold rounded-lg transition-colors text-sm"
        >
          Update Password
        </button>
      </form>

      {/* Notification preferences */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Notification Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">Email Notifications</p>
              <p className="text-xs text-[var(--text-faint)]">Receive job offers and updates via email</p>
            </div>
            <Toggle enabled={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">SMS Notifications</p>
              <p className="text-xs text-[var(--text-faint)]">Receive urgent alerts via text message</p>
            </div>
            <Toggle enabled={smsNotifications} onChange={() => setSmsNotifications(!smsNotifications)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">Deal Alerts</p>
              <p className="text-xs text-[var(--text-faint)]">Get notified when customers interact with your deals</p>
            </div>
            <Toggle enabled={dealAlerts} onChange={() => setDealAlerts(!dealAlerts)} />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-[var(--bg-surface)] border border-red-900/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--danger)] mb-2">Danger Zone</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Once you delete your account, there is no going back. All your data, deals, and reviews will be permanently removed.
        </p>
        {showDeleteConfirm ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <p className="text-sm text-[var(--danger)] mb-3">
              Are you sure you want to delete your account? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  showToast('Account deletion is not available in this demo.');
                }}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-[var(--text-primary)] text-sm font-semibold rounded-lg transition-colors"
              >
                Yes, Delete My Account
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-[var(--input-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-5 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 text-sm font-semibold rounded-lg transition-colors"
          >
            Delete Account
          </button>
        )}
      </div>
    </div>
  );
}
