import FaceIdSettings from '../../components/FaceIdSettings';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PRICING_SCENARIOS, PROJECT_SIZE_OPTIONS, SERVICE_TYPE_OPTIONS } from '../../lib/painterOptions';
import ExternalReviewsFields from '../../components/painter/ExternalReviewsFields';
import { EXTERNAL_SOURCES, emptyExternalForm, fromExternalForm, toExternalForm, validateExternalForm, type ExternalFormValue } from '../../lib/externalReviews';
import CredentialsEditor, { CREDENTIAL_COLUMNS, toCredentials } from '../../components/painter/CredentialsEditor';
import PortfolioStrip from '../../components/painter/PortfolioStrip';
import BookedPreference from '../../components/painter/BookedPreference';
import EditRow, { editInput } from '../../components/painter/EditRow';

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

const numberOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const dash = <span className="text-[var(--text-faint)]">—</span>;

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 pt-2.5 pb-1">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {note && <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{note}</p>}
      <div className="mt-1">{children}</div>
    </section>
  );
}

type Save = (patch: Record<string, unknown>, opts?: { geocode?: boolean }) => Promise<string | null>;

/** A one-value row: text, phone, link, number or paragraph, edited in place. */
function FieldRow({ label, field, row, save, kind = 'text', validate, placeholder, prefix, suffix, block }: {
  label: string;
  field: string;
  row: PainterRow;
  save: Save;
  kind?: 'text' | 'tel' | 'url' | 'number' | 'textarea';
  validate?: (v: string) => string | null;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  block?: boolean;
}) {
  const stored = row[field];
  const text = stored == null ? '' : String(stored);
  const [draft, setDraft] = useState(text);
  const money = kind === 'number' && prefix === '$';
  const shown = text === '' ? dash : <span className={money ? 'whitespace-nowrap' : undefined}>{prefix}{money ? Number(text).toLocaleString('en-US') : text}{suffix}</span>;
  return (
    <EditRow
      label={label}
      block={block}
      value={shown}
      onOpen={() => setDraft(text)}
      editor={kind === 'textarea'
        ? <textarea rows={4} className={editInput + ' resize-y'} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
        : <input type={kind === 'number' ? 'number' : kind} min={kind === 'number' ? 0 : undefined} inputMode={kind === 'number' ? 'numeric' : undefined} className={editInput} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />}
      onSave={async () => {
        const problem = validate?.(draft) ?? null;
        if (problem) return problem;
        const value = kind === 'number' ? numberOrNull(draft) : draft.trim() === '' && (kind === 'url' || kind === 'textarea') ? null : draft.trim();
        return save({ [field]: value }, { geocode: false });
      }}
    />
  );
}

export default function PainterProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<PainterRow | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('painters')
      .select(COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setLoadError('We couldn\'t load your company profile.');
        else setRow(data as unknown as PainterRow);
      });
  }, [user]);

  // saves some columns of the painter's own row and shows the new values at once
  const save: Save = async (patch, opts) => {
    if (!row) return 'Not loaded yet.';
    const { error } = await supabase.from('painters').update(patch).eq('id', row.id);
    if (error) return 'We couldn\'t save that. Please try again.';
    setRow((prev) => (prev ? { ...prev, ...patch } : prev));
    // keep the map position in step with the address (best effort)
    if (opts?.geocode) supabase.functions.invoke('geocode-painter', { body: {} }).catch(() => {});
    return null;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // drafts for the rows that edit more than one value
  const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '' });
  const [services, setServices] = useState<string[]>([]);
  const [warranty, setWarranty] = useState({ estimates: false, has: false, length: '' });
  const [external, setExternal] = useState<ExternalFormValue>(emptyExternalForm());

  if (loadError) return <p className="p-4 text-sm text-[var(--danger)]">{loadError}</p>;
  if (!row) return <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>;

  const place = [row.city, row.state].filter(Boolean).join(', ');
  const externalLinks = EXTERNAL_SOURCES.map((s) => ({ s, entry: toExternalForm(row.external_reviews)[s.key] })).filter((x) => x.entry.url);

  const links: { to: string; label: string; hint: string }[] = [
    { to: '/painter/dashboard/business', label: 'My business', hint: 'Income, schedule, customers' },
    { to: '/painter/dashboard/reviews', label: 'Reviews', hint: 'What customers said' },
    { to: '/painter/dashboard/rewards', label: 'Rewards', hint: 'Your perks' },
    { to: '/painter/dashboard/notifications', label: 'Notifications', hint: 'Everything we sent you' },
    { to: '/painter/dashboard/settings', label: 'Account settings', hint: 'Email, password, preferences' },
    { to: `/painters/${row.id}`, label: 'My public listing', hint: 'What customers see' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-3 py-3 space-y-3">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{row.company_name}</h1>
        <p className="text-xs text-[var(--text-secondary)]">{[row.owner_name, place].filter(Boolean).join(' · ')}</p>
      </div>

      <PortfolioStrip />

      <Card title="Business details">
        <FieldRow label="Company" field="company_name" row={row} save={save} validate={(v) => (v.trim() ? null : 'Company name is required.')} />
        <FieldRow label="Owner" field="owner_name" row={row} save={save} validate={(v) => (v.trim() ? null : 'Owner name is required.')} />
        <FieldRow label="Phone" field="phone" row={row} save={save} kind="tel" validate={(v) => (v.trim() ? null : 'A phone number is required.')} />
        <FieldRow label="Website" field="website" row={row} save={save} kind="url" placeholder="https://" block />
        <EditRow
          label="Address"
          value={row.street_address || place ? `${[row.street_address, row.city].filter(Boolean).join(', ')}${row.state ? `, ${row.state}` : ''} ${row.zip_code ?? ''}` : dash}
          onOpen={() => setAddress({ street: row.street_address ?? '', city: row.city ?? '', state: row.state ?? '', zip: row.zip_code ?? '' })}
          editor={(
            <div className="grid grid-cols-6 gap-2">
              <input className={editInput + ' col-span-6'} placeholder="Street" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
              <input className={editInput + ' col-span-3'} placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              <input className={editInput + ' col-span-1'} placeholder="ST" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
              <input className={editInput + ' col-span-2'} placeholder="ZIP" inputMode="numeric" maxLength={5} value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
            </div>
          )}
          onSave={async () => {
            if (!/^\d{5}$/.test(address.zip.trim())) return 'ZIP code must be 5 digits.';
            return save({ street_address: address.street.trim(), city: address.city.trim(), state: address.state.trim(), zip_code: address.zip.trim() }, { geocode: true });
          }}
        />
        <FieldRow label="Years in business" field="years_in_business" row={row} save={save} kind="number" />
        <FieldRow label="Crew size" field="crew_size" row={row} save={save} kind="number" />
        <FieldRow label="About" field="bio" row={row} save={save} kind="textarea" block placeholder="What should customers know about you?" />
      </Card>

      <Card title="Services & coverage">
        <EditRow
          label="Services"
          block
          value={(row.service_types ?? []).length ? (
            <span className="flex flex-wrap gap-1.5">
              {(row.service_types ?? []).map((s) => <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-[var(--border)] text-[var(--text-primary)]">{s}</span>)}
            </span>
          ) : dash}
          onOpen={() => setServices(row.service_types ?? [])}
          editor={(
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_TYPE_OPTIONS.map((s) => {
                const on = services.includes(s);
                return (
                  <button key={s} type="button" onClick={() => setServices(on ? services.filter((x) => x !== s) : [...services, s])}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${on ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : 'border-[var(--input-border)] text-[var(--text-secondary)]'}`}>
                    {s}
                  </button>
                );
              })}
            </div>
          )}
          onSave={async () => (services.length === 0 ? 'Pick at least one service.' : save({ service_types: services }))}
        />
        <FieldRow label="ZIPs you serve" field="service_area_zips" row={row} save={save} placeholder="Comma separated" block />
        <EditRow
          label="Largest project"
          value={PROJECT_SIZE_OPTIONS.find((o) => o.value === row.max_project_size)?.label ?? dash}
          editor={<MaxSizeEditor row={row} save={save} />}
          onSave={async () => null}
        />
        <EditRow
          label="Estimates & warranty"
          value={<span>{row.offers_estimates ? 'Free estimates' : 'No free estimates'} · {row.offers_warranty ? `Warranty${row.warranty_length ? ` ${row.warranty_length}` : ''}` : 'No warranty'}</span>}
          onOpen={() => setWarranty({ estimates: !!row.offers_estimates, has: !!row.offers_warranty, length: row.warranty_length ?? '' })}
          editor={(
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={warranty.estimates} onChange={(e) => setWarranty({ ...warranty, estimates: e.target.checked })} /> Free estimates
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={warranty.has} onChange={(e) => setWarranty({ ...warranty, has: e.target.checked })} /> Offer a warranty
              </label>
              {warranty.has && <input className={editInput} placeholder="e.g. 2 years" value={warranty.length} onChange={(e) => setWarranty({ ...warranty, length: e.target.value })} />}
            </div>
          )}
          onSave={() => save({ offers_estimates: warranty.estimates, offers_warranty: warranty.has, warranty_length: warranty.has ? warranty.length.trim() || null : null })}
        />
        <EditRow
          label="Reviews elsewhere"
          block
          value={externalLinks.length ? (
            <span className="flex flex-col gap-0.5">
              {externalLinks.map(({ s, entry }) => <span key={s.key} className="text-xs">{s.label}: {entry.rating ? `${entry.rating}★` : ''}{entry.count ? ` (${entry.count})` : ''}</span>)}
            </span>
          ) : dash}
          onOpen={() => setExternal(toExternalForm(row.external_reviews))}
          editor={<ExternalReviewsFields value={external} onChange={setExternal} inputClass={editInput} labelClass="block text-xs text-[var(--text-secondary)] mb-1" />}
          onSave={async () => {
            const problem = validateExternalForm(external);
            return problem ?? save({ external_reviews: fromExternalForm(external) });
          }}
        />
      </Card>

      <Card
        title="Your pricing answers"
        note="Private: only you and our system see these. Customers and other painters never do. They set where you land among nearby painters."
      >
        {PRICING_SCENARIOS.map((p) => (
          <div key={p.column}>
            <FieldRow label={p.label} field={p.column} row={row} save={save} kind="number" prefix="$" />
          </div>
        ))}
      </Card>

      <details className="group">
        <summary className="list-none cursor-pointer bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span>
            <span className="block text-sm font-semibold text-[var(--text-primary)]">License, insurance &amp; credentials</span>
            <span className="block text-[11px] text-[var(--text-faint)]">Keep these current so customers can trust your listing</span>
          </span>
          <span className="text-[var(--text-faint)] transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-2">
          <CredentialsEditor initial={toCredentials(row)} status={row.status} compPauses={(row.crew_size ?? 0) > 1} />
        </div>
      </details>

      <BookedPreference />

      <Card title="More">
        <ul>
          {links.map((l) => (
            <li key={l.to} className="border-b border-[var(--border)] last:border-b-0">
              <Link to={l.to} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="block text-sm text-[var(--text-primary)]">{l.label}</span>
                  <span className="block text-[11px] text-[var(--text-faint)]">{l.hint}</span>
                </span>
                <span className="text-[var(--text-faint)]">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <FaceIdSettings />
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full py-2.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] text-sm uppercase tracking-wide"
      >
        Sign out
      </button>
    </div>
  );
}

/** The "largest project" picker: it saves as soon as a size is chosen, so the row's own Save has nothing left to do. */
function MaxSizeEditor({ row, save }: { row: PainterRow; save: Save }) {
  return (
    <select
      className={editInput}
      value={row.max_project_size ?? ''}
      onChange={(e) => { void save({ max_project_size: e.target.value || null }); }}
    >
      <option value="">Select…</option>
      {PROJECT_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
