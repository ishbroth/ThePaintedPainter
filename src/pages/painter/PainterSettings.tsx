import AccountSettings from '../../components/account/AccountSettings';

export default function PainterSettings() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Settings</h1>
      <AccountSettings />
    </div>
  );
}
