import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PRICING_SCENARIOS, PROJECT_SIZE_OPTIONS, SERVICE_TYPE_OPTIONS } from '../../lib/painterOptions';
import ExternalReviewsFields from '../../components/painter/ExternalReviewsFields';
import { emptyExternalForm, fromExternalForm, toExternalForm, validateExternalForm, type ExternalFormValue } from '../../lib/externalReviews';
import AvailabilityCard from '../../components/painter/AvailabilityCard';
import CredentialsEditor, { CREDENTIAL_COLUMNS, toCredentials } from '../../components/painter/CredentialsEditor';

interface PainterRow {
  id: string;
  company_name: string;
  owner_name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  website: string | null;
  bio: string | null;
  external_reviews: unknown;
  years_in_business: number | null;
  crew_size: number | null;
  service_types: string[] | null;
  service_area_zips: string | null;
  max_project_size: string | null;
  offers_estimates: boolean | null;
  offers_warranty: boolean | null;
  warranty_length: string | null;
  status: string;
  [price: string]: unknown;
}

const COLUMNS =
  'id, company_name, owner_name, phone, street_address, city, state, zip_code, website, bio, external_reviews, years_in_business, crew_size, service_types, service_area_zips, max_project_size, offers_estimates, offers_warranty, warranty_length, status, ' +
  CREDENTIAL_COLUMNS + ', ' +
  PRICING_SCENARIOS.map((p) => p.column).join(', ');

const inputClass =
  'w-full px-3 py-2 bg-[var(--bg-page)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';
const card = 'bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-4';
const label = 'block text-sm text-[var(--text-secondary)] mb-1';

const numberOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export default function PainterProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState<PainterRow | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savedCrew, setSavedCrew] = useState(0);
  const [external, setExternal] = useState<ExternalFormValue>(emptyExternalForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('painters')
      .select(COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setLoadError('We couldn\'t load your company profile.');
        else {
          setForm(data as unknown as PainterRow);
          setSavedCrew((data as unknown as PainterRow).crew_size ?? 0);
          setExternal(toExternalForm((data as unknown as PainterRow).external_reviews));
        }
      });
  }, [user]);

  const set = <K extends keyof PainterRow>(key: K, value: PainterRow[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage(null);
  };

  const toggleService = (service: string) => {
    if (!form) return;
    const current = form.service_types ?? [];
    set('service_types', current.includes(service) ? current.filter((s) => s !== service) : [...current, service]);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (!form.company_name.trim() || !form.owner_name.trim()) return setMessage({ kind: 'error', text: 'Company and owner name are required.' });
    if (!form.phone.trim()) return setMessage({ kind: 'error', text: 'A phone number is required.' });
    if (!/^\d{5}$/.test(form.zip_code.trim())) return setMessage({ kind: 'error', text: 'ZIP code must be 5 digits.' });
    if ((form.service_types ?? []).length === 0) return setMessage({ kind: 'error', text: 'Select at least one service.' });
    const reviewsProblem = validateExternalForm(external);
    if (reviewsProblem) return setMessage({ kind: 'error', text: reviewsProblem });

    setSaving(true);
    setMessage(null);
    const update: Record<string, unknown> = {
      company_name: form.company_name.trim(),
      owner_name: form.owner_name.trim(),
      phone: form.phone.trim(),
      street_address: form.street_address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip_code: form.zip_code.trim(),
      website: form.website?.trim() || null,
      bio: form.bio?.trim() || null,
      external_reviews: fromExternalForm(external),
      years_in_business: form.years_in_business,
      crew_size: form.crew_size,
      service_types: form.service_types,
      service_area_zips: form.service_area_zips?.trim() ?? '',
      max_project_size: form.max_project_size,
      offers_estimates: form.offers_estimates,
      offers_warranty: form.offers_warranty,
      warranty_length: form.offers_warranty ? form.warranty_length?.trim() || null : null,
    };
    for (const p of PRICING_SCENARIOS) update[p.column] = form[p.column];

    const { error } = await supabase.from('painters').update(update).eq('id', form.id);
    setSaving(false);
    if (error) setMessage({ kind: 'error', text: 'We couldn\'t save your changes. Please try again.' });
    else {
      setSavedCrew(form.crew_size ?? 0);
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    }
  };

  if (loadError) return <p className="text-[var(--danger)]">{loadError}</p>;
  if (!form) return <p className="text-[var(--text-secondary)]">Loading your profile…</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Edit Profile</h1>

      <div className="mb-6">
        <AvailabilityCard />
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className={card}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Company information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Company name</label>
              <input className={inputClass} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
            </div>
            <div>
              <label className={label}>Owner name</label>
              <input className={inputClass} value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Phone</label>
              <input type="tel" className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className={label}>Website</label>
              <input className={inputClass} value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div>
            <label className={label}>Street address</label>
            <input className={inputClass} value={form.street_address} onChange={(e) => set('street_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={label}>City</label>
              <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <label className={label}>State</label>
              <input className={inputClass} value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} />
            </div>
            <div>
              <label className={label}>ZIP code</label>
              <input className={inputClass} value={form.zip_code} onChange={(e) => set('zip_code', e.target.value)} inputMode="numeric" maxLength={5} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Years in business</label>
              <input type="number" min={0} className={inputClass} value={form.years_in_business ?? ''} onChange={(e) => set('years_in_business', numberOrNull(e.target.value))} />
            </div>
            <div>
              <label className={label}>Crew size</label>
              <input type="number" min={1} className={inputClass} value={form.crew_size ?? ''} onChange={(e) => set('crew_size', numberOrNull(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={label}>About your company</label>
            <textarea rows={4} className={inputClass + ' resize-y'} value={form.bio ?? ''} onChange={(e) => set('bio', e.target.value)} placeholder="What should customers know about you?" />
          </div>
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Reviews on other sites</h2>
          <ExternalReviewsFields value={external} onChange={(next) => { setExternal(next); setMessage(null); }} inputClass={inputClass} labelClass={label} />
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Services &amp; coverage</h2>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPE_OPTIONS.map((s) => {
              const on = (form.service_types ?? []).includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : 'border-[var(--input-border)] text-[var(--text-secondary)]'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <div>
            <label className={label}>ZIP codes you serve (comma separated)</label>
            <input className={inputClass} value={form.service_area_zips ?? ''} onChange={(e) => set('service_area_zips', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Largest project you take</label>
              <select className={inputClass} value={form.max_project_size ?? ''} onChange={(e) => set('max_project_size', e.target.value)}>
                <option value="">Select…</option>
                {PROJECT_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Warranty length</label>
              <input className={inputClass} disabled={!form.offers_warranty} value={form.warranty_length ?? ''} onChange={(e) => set('warranty_length', e.target.value)} placeholder="e.g. 2 years" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-6">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={!!form.offers_estimates} onChange={(e) => set('offers_estimates', e.target.checked)} /> Offer free estimates
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={!!form.offers_warranty} onChange={(e) => set('offers_warranty', e.target.checked)} /> Offer a warranty
            </label>
          </div>
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Your pricing</h2>
          <p className="text-sm text-[var(--text-faint)]">
            What you'd charge for these reference projects. We use them to estimate where you fall among nearby painters, which sets the price shown next to your name.
          </p>
          {PRICING_SCENARIOS.map((p) => (
            <div key={p.column}>
              <label className={label}>{p.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[var(--text-faint)]">$</span>
                <input
                  type="number"
                  min={0}
                  className={inputClass + ' pl-7'}
                  value={(form[p.column] as number | null) ?? ''}
                  onChange={(e) => set(p.column, numberOrNull(e.target.value))}
                />
              </div>
              <p className="text-xs text-[var(--text-faint)] mt-1">{p.description}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-ink)] font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {message && (
            <span className={`text-sm ${message.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{message.text}</span>
          )}
        </div>
      </form>

      <div className="mt-6">
        <CredentialsEditor
          initial={toCredentials(form)}
          status={form.status}
          compPauses={savedCrew > 1}
        />
      </div>
    </div>
  );
}
