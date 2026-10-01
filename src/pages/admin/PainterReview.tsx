import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseAnonKey, supabaseUrl } from '../../lib/supabase';

// Opened from the admin email sent when a painter signs up. No login: the URL
// carries a signed, expiring token that the admin-painter-review function
// verifies. Nothing changes until a button here is clicked.

const PRESET_TASKS = [
  'Proof of current contractor license',
  'Proof of general liability insurance',
  'Proof of bond',
  'Proof of workers\' compensation coverage',
  'Verify company information (name, address, phone)',
  'Photos of recent completed work',
];

interface Painter {
  company_name: string;
  owner_name: string;
  email: string;
  phone: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  website: string | null;
  years_in_business: number | null;
  crew_size: number | null;
  has_license: boolean | null;
  license_number: string | null;
  license_state: string | null;
  license_expiration: string | null;
  is_bonded: boolean | null;
  bonding_company: string | null;
  bond_amount: string | null;
  is_insured: boolean | null;
  insurance_company: string | null;
  policy_number: string | null;
  coverage_amount: string | null;
  has_workers_comp: boolean | null;
  workers_comp_carrier: string | null;
  service_types: string[] | null;
  service_area_zips: string | null;
  status: string;
  application_tasks: { id: string; label: string; done: boolean }[];
  admin_message: string | null;
}

const yesNo = (v: boolean | null) => (v ? 'Yes' : 'No');

export default function PainterReview() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const exp = params.get('exp');
  const sig = params.get('sig');

  const [painter, setPainter] = useState<Painter | null>(null);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const endpoint = `${supabaseUrl}/functions/v1/admin-painter-review`;
  const headers = { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` };

  useEffect(() => {
    if (!id || !exp || !sig) {
      setError('This review link is incomplete.');
      return;
    }
    fetch(`${endpoint}?id=${encodeURIComponent(id)}&exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`, { headers })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load application');
        setPainter(json.painter);
        setTasks((json.painter.application_tasks ?? []).map((t: { label: string }) => t.label));
        setMessage(json.painter.admin_message ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load application'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, exp, sig]);

  const act = async (action: 'approve' | 'request_info' | 'reject') => {
    if (action === 'reject' && !window.confirm('Decline this application? The painter will be emailed.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ id, exp, sig, action, tasks, message }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong');
      setDone(
        action === 'approve'
          ? 'Approved — the painter has been emailed and can start receiving jobs.'
          : action === 'request_info'
          ? 'Sent — the painter was emailed and sees these as tasks on their profile.'
          : 'Declined — the painter has been emailed.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (label: string) =>
    setTasks((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]));

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 };
  const btn = (bg: string): React.CSSProperties => ({
    padding: '10px 18px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
  });

  if (error && !painter) return <div className="max-w-2xl mx-auto p-6"><p style={{ color: 'var(--danger)' }}>{error}</p></div>;
  if (!painter) return <div className="max-w-2xl mx-auto p-6"><p style={{ color: 'var(--text-secondary)' }}>Loading application…</p></div>;

  const allTasks = [...PRESET_TASKS, ...tasks.filter((t) => !PRESET_TASKS.includes(t))];

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }}>Painter application</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        {painter.company_name} · current status: <strong>{painter.status}</strong>
      </p>

      {done ? (
        <div style={card}><p style={{ color: 'var(--text-primary)', margin: 0 }}>{done}</p></div>
      ) : (
        <>
          <div style={card}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
              <div><strong>{painter.owner_name}</strong> · {painter.email} · {painter.phone}</div>
              <div>{[painter.street_address, painter.city, painter.state, painter.zip_code].filter(Boolean).join(', ')}</div>
              {painter.website && <div>{painter.website}</div>}
              <div>{painter.years_in_business ?? '?'} yrs in business · crew of {painter.crew_size ?? '?'}</div>
              <div>Services: {(painter.service_types ?? []).join(', ') || 'N/A'}</div>
              <div>Service-area ZIPs: {painter.service_area_zips || 'N/A'}</div>
              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '10px 0' }} />
              <div>Licensed: {yesNo(painter.has_license)}{painter.license_number ? ` — #${painter.license_number}` : ''}{painter.license_state ? ` (${painter.license_state})` : ''}{painter.license_expiration ? `, exp ${painter.license_expiration}` : ''}</div>
              <div>Insured: {yesNo(painter.is_insured)}{painter.insurance_company ? ` — ${painter.insurance_company}` : ''}{painter.policy_number ? `, policy ${painter.policy_number}` : ''}{painter.coverage_amount ? `, ${painter.coverage_amount}` : ''}</div>
              <div>Bonded: {yesNo(painter.is_bonded)}{painter.bonding_company ? ` — ${painter.bonding_company}` : ''}{painter.bond_amount ? `, ${painter.bond_amount}` : ''}</div>
              <div>Workers' comp: {yesNo(painter.has_workers_comp)}{painter.workers_comp_carrier ? ` — ${painter.workers_comp_carrier}` : ''}</div>
            </div>
          </div>

          <div style={card}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, margin: '0 0 10px' }}>What else do they need to provide?</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {allTasks.map((label) => (
                <label key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={tasks.includes(label)} onChange={() => toggle(label)} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Add your own task…"
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => {
                  const label = custom.trim();
                  if (label && !tasks.includes(label)) setTasks((prev) => [...prev, label]);
                  setCustom('');
                }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)' }}
              >
                Add
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional note to the painter (shown on their profile and in the email). Required reason if you decline."
              rows={3}
              style={{ width: '100%', marginTop: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={btn('var(--success)')} disabled={busy} onClick={() => act('approve')}>Approve</button>
            <button style={btn('var(--accent-blue)')} disabled={busy || (tasks.length === 0 && !message.trim())} onClick={() => act('request_info')}>
              Request these items
            </button>
            <button style={btn('var(--danger)')} disabled={busy || !message.trim()} onClick={() => act('reject')}>Decline</button>
          </div>
        </>
      )}
    </div>
  );
}
