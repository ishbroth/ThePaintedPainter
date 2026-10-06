import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabaseUrl } from '../../lib/supabase';
import { CERTIFICATION_OPTIONS } from '../../lib/painterOptions';

export interface Credentials {
  has_license: boolean;
  license_number: string;
  license_state: string;
  license_expiration: string;
  is_insured: boolean;
  insurance_company: string;
  policy_number: string;
  coverage_amount: string;
  is_bonded: boolean;
  bonding_company: string;
  bond_amount: string;
  has_workers_comp: boolean;
  workers_comp_carrier: string;
  certifications: string[];
  other_certification: string;
}

export const CREDENTIAL_COLUMNS =
  'has_license, license_number, license_state, license_expiration, is_insured, insurance_company, policy_number, coverage_amount, is_bonded, bonding_company, bond_amount, has_workers_comp, workers_comp_carrier, certifications, other_certification';

/** Normalize a row from the painters table into editable form values. */
export function toCredentials(row: Record<string, unknown>): Credentials {
  const s = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '');
  const b = (k: string) => row[k] === true;
  return {
    has_license: b('has_license'), license_number: s('license_number'), license_state: s('license_state'), license_expiration: s('license_expiration'),
    is_insured: b('is_insured'), insurance_company: s('insurance_company'), policy_number: s('policy_number'), coverage_amount: s('coverage_amount'),
    is_bonded: b('is_bonded'), bonding_company: s('bonding_company'), bond_amount: s('bond_amount'),
    has_workers_comp: b('has_workers_comp'), workers_comp_carrier: s('workers_comp_carrier'),
    certifications: Array.isArray(row.certifications) ? (row.certifications as string[]) : [],
    other_certification: s('other_certification'),
  };
}

const inputClass =
  'w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50';
const labelClass = 'block text-sm text-[var(--text-secondary)] mb-1';

function Group({ title, enabled, onToggle, toggleLabel, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; toggleLabel: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} /> {toggleLabel}
        </label>
      </div>
      {enabled && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

/**
 * License / insurance / bond / workers' comp / certifications. These were
 * vetted at approval, so they save through the update-credentials function,
 * which validates them and emails our team what changed.
 */
export default function CredentialsEditor({ initial, status, compPauses }: { initial: Credentials; status: string; compPauses: boolean }) {
  const { session } = useAuth();
  const [c, setC] = useState<Credentials>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const set = <K extends keyof Credentials>(key: K, value: Credentials[K]) => {
    setC((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  // Switching off a license / insurance / bond you had pauses new leads until we re-verify you.
  const toggleFlag = (key: 'has_license' | 'is_insured' | 'is_bonded' | 'has_workers_comp', value: boolean, what: string) => {
    // Workers' comp only pauses leads for painters who reported more than one person on their crew.
    const pauses = key !== 'has_workers_comp' || compPauses;
    if (!value && initial[key] && status === 'approved' && pauses) {
      const ok = window.confirm(`If you save with your ${what} turned off, new leads will be paused until we re-verify you (usually 1–3 days). Jobs you've already accepted aren't affected.\n\nNothing changes until you press "Save credentials". Turn it off?`);
      if (!ok) return;
    }
    set(key, value);
  };

  const text = (key: keyof Credentials, label: string, placeholder = '', type = 'text') => (
    <div>
      <label className={labelClass}>{label}</label>
      <input type={type} className={inputClass} value={c[key] as string} onChange={(e) => set(key, e.target.value as never)} placeholder={placeholder} />
    </div>
  );

  const save = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/update-credentials`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: c }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save your credentials.');
      if (json.suspended) {
        setMessage({ kind: 'ok', text: `Saved. Because you turned off your ${json.turnedOff.join(' and ')}, new leads are paused until we re-verify you (usually 1–3 days). See the notice at the top of the page.` });
        window.dispatchEvent(new Event('painter-application-changed'));
      } else {
        setMessage({ kind: 'ok', text: json.changed > 0 ? 'Saved.' : 'Nothing changed.' });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save your credentials.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Credentials</h2>
        <p className="text-xs text-[var(--text-faint)] mt-1">
          Keep these current — a renewed license number or a new insurance or bond provider goes here and saves right away. Turning off licensed, insured or bonded pauses new leads until we re-verify you (usually 1–3 days){compPauses ? ", and so does turning off workers' comp" : ''}.
        </p>
      </div>

      <Group title="Contractor license" enabled={c.has_license} onToggle={(v) => toggleFlag('has_license', v, 'contractor license')} toggleLabel="I'm licensed">
        {text('license_number', 'License number')}
        {text('license_state', 'License state', 'e.g. CA')}
        {text('license_expiration', 'License expires', '', 'date')}
      </Group>

      <Group title="Liability insurance" enabled={c.is_insured} onToggle={(v) => toggleFlag('is_insured', v, 'liability insurance')} toggleLabel="I'm insured">
        {text('insurance_company', 'Insurance company')}
        {text('policy_number', 'Policy number')}
        {text('coverage_amount', 'Coverage amount', 'e.g. $1,000,000')}
      </Group>

      <Group title="Bond" enabled={c.is_bonded} onToggle={(v) => toggleFlag('is_bonded', v, 'bond')} toggleLabel="I'm bonded">
        {text('bonding_company', 'Bonding company')}
        {text('bond_amount', 'Bond amount', 'e.g. $25,000')}
      </Group>

      <Group title="Workers' compensation" enabled={c.has_workers_comp} onToggle={(v) => toggleFlag('has_workers_comp', v, "workers' compensation coverage")} toggleLabel="I carry workers' comp">
        {text('workers_comp_carrier', 'Carrier')}
      </Group>

      <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Certifications</h3>
        <div className="flex flex-wrap gap-4">
          {CERTIFICATION_OPTIONS.map((cert) => (
            <label key={cert} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={c.certifications.includes(cert)}
                onChange={() => set('certifications', c.certifications.includes(cert) ? c.certifications.filter((x) => x !== cert) : [...c.certifications, cert])}
              />
              {cert}
            </label>
          ))}
        </div>
        {c.certifications.includes('Other') && text('other_certification', 'Other certification')}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-ink)] font-semibold rounded-lg transition-colors text-sm"
        >
          {saving ? 'Saving…' : 'Save credentials'}
        </button>
        {message && <span className={`text-sm ${message.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</span>}
      </div>
    </div>
  );
}
