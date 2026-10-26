import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

// The contract between a customer and the painter who confirmed their job. Everything goes through the `contract` edge function, which
// decides who is asking (a signed-in painter or customer, or a guest holding the job's confirm token).

export interface ChangeOrder {
  description: string;
  amount: number;
}

export interface PainterTerms {
  scopeNotes?: string;
  specialTerms?: string;
  warranty?: string;
  changeOrders?: ChangeOrder[];
}

export interface ContractSection {
  heading: string;
  paragraphs: string[];
}

export interface ContractTerms {
  textVersion: string;
  customerFirstName: string;
  painterCompany: string;
  project: { label: string; city: string | null; state: string | null; zip: string | null };
  price: { lines: { description: string; amount: number }[]; base: number; deposit: number };
  schedule: { start: string | null; end: string | null; estimatedDays: number | null };
  sections: ContractSection[];
}

export type VersionStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'superseded';

export interface ContractVersion {
  id: string;
  version: number;
  status: VersionStatus;
  sentAt: string | null;
  respondedAt: string | null;
  changeSummary: string | null;
  acceptedName: string | null;
  customerNote: string | null;
  document: { name: string | null; size: number | null } | null;
  painterTerms: PainterTerms;
  totals: { base: number; changes: number; total: number; deposit: number; balance: number };
  terms: ContractTerms;
}

export interface ContractView {
  role: 'painter' | 'customer';
  job: { id: string; status: string; phaseLabel: string | null; paid: boolean; dateState: string; depositAmount: number | null };
  parties: {
    customer: { name: string | null; address: string | null; email: string | null; phone: string | null };
    painter: { companyName: string; ownerName: string | null; email: string | null; phone: string | null };
  };
  versions: ContractVersion[];
  inForceVersionId: string | null;
  pendingVersionId: string | null;
  draftVersionId: string | null;
  canSend: boolean;
  canEdit: boolean;
}

/** Who is calling: a guest with the email-link token, or a signed-in user (the function works out which side they are). */
export type ContractAuth = { kind: 'token'; token: string } | { kind: 'session'; jobId: string };

async function headersFor(auth: ContractAuth): Promise<Record<string, string>> {
  let bearer = supabaseAnonKey;
  if (auth.kind === 'session') {
    const { data } = await supabase.auth.getSession();
    bearer = data.session?.access_token ?? supabaseAnonKey;
  }
  return { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${bearer}` };
}

export async function contractCall<T = ContractView>(auth: ContractAuth, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${supabaseUrl}/functions/v1/contract`, {
    method: 'POST',
    headers: await headersFor(auth),
    body: JSON.stringify({ ...body, ...(auth.kind === 'token' ? { token: auth.token } : { jobId: auth.jobId }) }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Something went wrong.');
  return json as T;
}

export async function openContractDocument(auth: ContractAuth, versionId: string): Promise<void> {
  const { url } = await contractCall<{ url: string }>(auth, { action: 'document_url', versionId });
  window.open(url, '_blank', 'noopener');
}

/** Uploads the painter's own contract document (PDF or Word, up to 10 MB) and returns what to save on the draft. */
export async function uploadContractDocument(auth: ContractAuth, file: File): Promise<{ documentPath: string; documentName: string; documentSize: number }> {
  const slot = await contractCall<{ path: string; token: string; bucket: string }>(auth, { action: 'upload_url', filename: file.name, size: file.size });
  const { error } = await supabase.storage.from(slot.bucket).uploadToSignedUrl(slot.path, slot.token, file);
  if (error) throw new Error('The document could not be uploaded. Please try again.');
  return { documentPath: slot.path, documentName: file.name, documentSize: file.size };
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
