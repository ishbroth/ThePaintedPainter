import { useCallback, useEffect, useRef, useState } from 'react';
import ContractDocument from './ContractDocument';
import {
  contractCall, money, openContractDocument, uploadContractDocument,
  type ChangeOrder, type ContractAuth, type ContractVersion, type ContractView, type PainterTerms,
} from '../../lib/contracts';

const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 };
const input: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--bg-page)', color: 'var(--text-primary)', width: '100%' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 };
const primary: React.CSSProperties = { padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, cursor: 'pointer' };
const secondary: React.CSSProperties = { padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft (only you can see it)', sent: 'Waiting for the customer', accepted: 'Accepted', declined: 'Declined', superseded: 'Replaced by a later version',
};

/**
 * The contract for one job, for either side. The customer reads it and accepts (typed name) or declines; the painter edits their working
 * copy (scope notes, special terms, warranty, change orders, their own PDF/Word document) and sends updates for the customer to accept.
 * `onChange` fires after anything that can change what the customer may do next (accepting, sending), so a page around it can refresh.
 */
export default function ContractWorkspace({ auth, onChange, compact = false }: { auth: ContractAuth; onChange?: () => void; compact?: boolean }) {
  const [view, setView] = useState<ContractView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const authKey = auth.kind === 'token' ? `t:${auth.token}` : `s:${auth.jobId}`;
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const apply = useCallback((v: ContractView) => {
    setView(v);
    setViewing((current) => (current && v.versions.some((x) => x.id === current) ? current : v.pendingVersionId ?? v.inForceVersionId ?? v.draftVersionId ?? v.versions[v.versions.length - 1]?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    contractCall(authRef.current, { action: 'get' })
      .then((v) => { if (!cancelled) apply(v); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the contract.'); });
    return () => { cancelled = true; };
  }, [authKey, apply]);

  const run = async (body: Record<string, unknown>, jumpTo?: 'pending' | 'draft') => {
    setBusy(true);
    setError('');
    try {
      const v = await contractCall(authRef.current, body);
      apply(v);
      if (jumpTo === 'pending' && v.pendingVersionId) setViewing(v.pendingVersionId);
      if (jumpTo === 'draft' && v.draftVersionId) setViewing(v.draftVersionId);
      onChange?.();
      return v;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (error && !view) return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!view) return <p style={{ color: 'var(--text-secondary)' }}>Loading the contract…</p>;

  const current = view.versions.find((v) => v.id === viewing) ?? view.versions[view.versions.length - 1];
  const pending = view.versions.find((v) => v.id === view.pendingVersionId);
  const draft = view.versions.find((v) => v.id === view.draftVersionId);
  const inForce = view.versions.find((v) => v.id === view.inForceVersionId);
  const waitingOnCustomer = pending && view.role === 'customer';

  return (
    <div>
      {/* where things stand */}
      <div style={card}>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
          {waitingOnCustomer
            ? (pending.version > 1 ? 'Your painter sent a change to your contract. Please review it.' : 'Please review and accept your contract.')
            : pending && view.role === 'painter'
              ? `Version ${pending.version} is waiting for the customer to accept.`
              : inForce
                ? `Version ${inForce.version} is in force: accepted by ${inForce.acceptedName}.`
                : view.role === 'painter'
                  ? 'Prepare your contract below. It goes to the customer automatically once you agree on dates.'
                  : 'Your painter is preparing your contract.'}
        </p>
        {pending && pending.changeSummary && <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>What changed: {pending.changeSummary}</p>}
        {!compact && (
          <p style={{ margin: '8px 0 0', color: 'var(--text-faint)', fontSize: '0.82rem' }}>
            This contract is between the customer and the painter. The Painted Painter is a marketplace and is not a party to it or the work.
          </p>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {/* customer: accept or decline the version waiting for them */}
      {waitingOnCustomer && <AcceptPanel version={pending} busy={busy} onAccept={(name) => run({ action: 'accept', versionId: pending.id, name, agree: true })} onDecline={(note) => run({ action: 'decline', versionId: pending.id, note })} />}

      {/* history */}
      {view.versions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {view.versions.map((v) => (
            <button key={v.id} onClick={() => setViewing(v.id)} style={{ ...secondary, padding: '6px 12px', fontSize: '0.8rem', ...(current?.id === v.id ? { background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', border: 'none' } : {}) }}>
              Version {v.version} · {STATUS_LABEL[v.status] ?? v.status}
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button style={secondary} onClick={() => window.print()}>Print or save as PDF</button>
            {current.document && (
              <button style={secondary} onClick={() => openContractDocument(authRef.current, current.id).catch((e) => setError(e instanceof Error ? e.message : 'Could not open the document.'))}>
                Open the painter's own document ({current.document.name})
              </button>
            )}
          </div>
          <ContractDocument view={view} version={current} />
        </>
      )}

      {/* painter: edit and send */}
      {view.role === 'painter' && view.canEdit && (
        <Editor
          key={draft?.id ?? 'no-draft'}
          view={view}
          draft={draft ?? null}
          base={draft ?? inForce ?? pending ?? null}
          busy={busy}
          onSave={(body) => run({ action: 'save_draft', ...body }, 'draft')}
          onSend={(summary) => run({ action: 'send', changeSummary: summary }, 'pending')}
          upload={(file) => uploadContractDocument(authRef.current, file)}
          setError={setError}
        />
      )}
    </div>
  );
}

function AcceptPanel({ version, busy, onAccept, onDecline }: { version: ContractVersion; busy: boolean; onAccept: (name: string) => void; onDecline: (note: string) => void }) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div style={{ ...card, borderColor: 'var(--accent-blue)' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
        Contract price {money(version.totals.total)} · deposit {money(version.totals.deposit)} · balance to your painter {money(version.totals.balance)}
      </p>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 4 }} />
        <span>I have read this contract below. I understand it is an agreement with the painter, and that The Painted Painter is a marketplace and not a contractor or a party to it.</span>
      </label>
      <label style={label}>Type your full name to sign</label>
      <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button style={{ ...primary, opacity: busy || !agree || name.trim().length < 3 ? 0.6 : 1 }} disabled={busy || !agree || name.trim().length < 3} onClick={() => onAccept(name.trim())}>
          I accept
        </button>
        {!declining && <button style={secondary} onClick={() => setDeclining(true)}>I don't accept this</button>}
      </div>
      {declining && (
        <div style={{ marginTop: 12 }}>
          <label style={label}>Tell your painter what you'd like changed (optional)</label>
          <textarea style={input} rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...secondary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => onDecline(note)}>Send to my painter</button>
            <button style={secondary} onClick={() => setDeclining(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Editor({ view, draft, base, busy, onSave, onSend, upload, setError }: {
  view: ContractView;
  draft: ContractVersion | null;
  base: ContractVersion | null;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<unknown>;
  onSend: (summary: string) => Promise<unknown>;
  upload: (file: File) => Promise<{ documentPath: string; documentName: string; documentSize: number }>;
  setError: (m: string) => void;
}) {
  const start: PainterTerms = base?.painterTerms ?? {};
  const [scopeNotes, setScopeNotes] = useState(start.scopeNotes ?? '');
  const [specialTerms, setSpecialTerms] = useState(start.specialTerms ?? '');
  const [warranty, setWarranty] = useState(start.warranty ?? '');
  const [orders, setOrders] = useState<{ description: string; amount: string }[]>((start.changeOrders ?? []).map((c) => ({ description: c.description, amount: String(c.amount) })));
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cleaned = (): ChangeOrder[] =>
    orders.map((o) => ({ description: o.description.trim(), amount: Number(o.amount) })).filter((o) => o.description && isFinite(o.amount) && o.amount !== 0);
  const body = () => ({ scopeNotes, specialTerms, warranty, changeOrders: cleaned() });
  const attached = draft?.document ?? base?.document ?? null;
  // once any version has gone to the customer, the next one is a change notice that needs a summary
  const isChange = view.versions.some((v) => v.status !== 'draft');

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const doc = await upload(file);
      await onSave({ ...body(), ...doc });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The document could not be uploaded.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ ...card, marginTop: 20 }}>
      <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>{isChange ? 'Change this contract' : 'Your contract'}</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        The standard contract is filled in from the customer's request and the price they agreed. Add what you need on top of it.
        {isChange ? ' A change only takes effect once the customer accepts it; until then the last accepted version stays in force.' : ''}
      </p>

      <label style={label}>Extra scope notes (what's included or not, access, prep you'll do)</label>
      <textarea style={input} rows={3} maxLength={4000} value={scopeNotes} onChange={(e) => setScopeNotes(e.target.value)} />

      <label style={{ ...label, marginTop: 12 }}>Warranty wording (leave empty to use the standard one)</label>
      <textarea style={input} rows={2} maxLength={1500} value={warranty} onChange={(e) => setWarranty(e.target.value)} />

      <label style={{ ...label, marginTop: 12 }}>Your own terms (optional)</label>
      <textarea style={input} rows={4} maxLength={6000} value={specialTerms} onChange={(e) => setSpecialTerms(e.target.value)} placeholder="Anything else you want the customer to agree to. The marketplace disclosures and indemnification in the standard contract always apply." />

      <p style={{ margin: '14px 0 6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Changes to the price (change orders)</p>
      {orders.map((o, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, marginBottom: 8 }}>
          <input style={input} placeholder="What changed (e.g. add the garage doors)" value={o.description} onChange={(e) => setOrders((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
          <input style={input} placeholder="$ amount" inputMode="decimal" value={o.amount} onChange={(e) => setOrders((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^0-9.-]/g, '') } : x)))} />
          <button type="button" style={{ ...secondary, padding: '8px 12px' }} onClick={() => setOrders((p) => p.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
        </div>
      ))}
      <button type="button" style={{ ...secondary, padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setOrders((p) => [...p, { description: '', amount: '' }])}>+ Add a change</button>
      <p style={{ margin: '6px 0 0', color: 'var(--text-faint)', fontSize: '0.8rem' }}>Use a negative amount for a credit. Extra amounts are paid to you directly by the customer.</p>

      <p style={{ margin: '16px 0 6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Your own contract document (PDF or Word)</p>
      <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Attach your company's contract and the customer accepts it together with the contract above, in the same step. If it conflicts with the marketplace disclosures or the indemnification, those control.
      </p>
      {attached && <p style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Attached: {attached.name} {draft && <button type="button" style={{ ...secondary, padding: '4px 10px', fontSize: '0.8rem', marginLeft: 8 }} onClick={() => onSave({ ...body(), removeDocument: true })}>Remove</button>}</p>}
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => pickFile(e.target.files?.[0])} disabled={uploading || busy} />
      {uploading && <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>Uploading…</span>}

      {isChange && (
        <>
          <label style={{ ...label, marginTop: 16 }}>What changed? (the customer sees this)</label>
          <textarea style={input} rows={2} maxLength={1500} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Added the garage doors for $450 and moved the end date to Friday." />
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button style={{ ...secondary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => onSave(body())}>Save</button>
        <button
          style={{ ...primary, opacity: busy || !view.canSend || (isChange && !summary.trim()) ? 0.6 : 1 }}
          disabled={busy || !view.canSend || (isChange && !summary.trim())}
          onClick={async () => { await onSave(body()); await onSend(summary.trim()); setSummary(''); }}
        >
          {isChange ? 'Send the update to the customer' : 'Send to the customer now'}
        </button>
      </div>
      {!view.canSend && <p style={{ margin: '8px 0 0', color: 'var(--text-faint)', fontSize: '0.82rem' }}>It goes to the customer automatically once you agree on dates, so you can keep adding to it until then.</p>}
    </div>
  );
}
