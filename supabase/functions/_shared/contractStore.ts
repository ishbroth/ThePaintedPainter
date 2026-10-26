// Contract versions in the database: creating the first draft, sending it, and checking whether the customer may pay yet.
// The edge function `contract` is the only thing that lets people read or change them; claim-job, customer-dates and
// create-checkout-session call the helpers here at the right moments in the flow.

import { buildTerms, cleanPainterTerms, type PainterTerms, type ContractTerms } from './contract.ts'
import { notify } from './notify.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any

export interface ContractRow {
  id: string
  job_id: string
  version: number
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'superseded'
  terms: ContractTerms
  painter_terms: PainterTerms
  document_path: string | null
  document_name: string | null
  document_size: number | null
  change_summary: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  responded_at: string | null
  accepted_name: string | null
  customer_note: string | null
}

export const JOB_COLUMNS = 'id, status, accepted_by, customer_id, customer_email, customer_name, customer_phone, customer_street_address, customer_city, customer_state, quote_zip, phase_label, guaranteed_price, deposit_amount, deposit_status, scheduled_date, scheduled_end_date, date_state, estimated_days, project_summary, customer_confirm_token, claim_token'
export const PAINTER_COLUMNS = 'id, user_id, company_name, owner_name, email, phone, has_license, license_state, is_insured, is_bonded, offers_warranty, warranty_length'

export async function loadJob(supabase: Supabase, jobId: string) {
  const { data } = await supabase.from('quote_selections').select(JOB_COLUMNS).eq('id', jobId).maybeSingle()
  return data
}

export async function loadPainter(supabase: Supabase, painterId: string) {
  const { data } = await supabase.from('painters').select(PAINTER_COLUMNS).eq('id', painterId).maybeSingle()
  return data
}

export async function versionsFor(supabase: Supabase, jobId: string): Promise<ContractRow[]> {
  const { data } = await supabase.from('job_contracts').select('*').eq('job_id', jobId).order('version', { ascending: true })
  return (data ?? []) as ContractRow[]
}

/** The contract text for this job and painter, with the painter's additions. */
// deno-lint-ignore no-explicit-any
export function termsFor(job: any, painter: any, painterTerms: PainterTerms, documentName: string | null): ContractTerms {
  return buildTerms({ job, painter, painterTerms, documentName })
}

/**
 * The painter's working copy: the existing draft, or a new one started from the latest version (so a change notice begins from what is
 * already in force). The first draft is created when the painter accepts the job.
 */
export async function ensureDraft(supabase: Supabase, jobId: string): Promise<ContractRow | null> {
  const job = await loadJob(supabase, jobId)
  if (!job?.accepted_by) return null
  const painter = await loadPainter(supabase, job.accepted_by)
  if (!painter) return null

  const versions = await versionsFor(supabase, jobId)
  const draft = versions.find((v) => v.status === 'draft')
  if (draft) return draft

  const last = versions[versions.length - 1]
  const painterTerms = cleanPainterTerms(last?.painter_terms)
  const documentName = last?.document_name ?? null
  const { data, error } = await supabase
    .from('job_contracts')
    .insert({
      job_id: jobId,
      version: (last?.version ?? 0) + 1,
      status: 'draft',
      terms: termsFor(job, painter, painterTerms, documentName),
      painter_terms: painterTerms,
      document_path: last?.document_path ?? null,
      document_name: documentName,
      document_size: last?.document_size ?? null,
    })
    .select('*')
    .single()
  if (error) {
    // two requests creating the same version at once: the other one won, use its draft
    const again = (await versionsFor(supabase, jobId)).find((v) => v.status === 'draft')
    if (again) return again
    throw error
  }
  return data as ContractRow
}

/**
 * Sends a draft to the customer: the terms are rebuilt from the job as it is right now (dates, price), earlier unanswered versions are
 * marked superseded, and the customer is told. Used for the first version (when the dates are agreed) and for the painter's change notices.
 */
export async function sendDraft(
  supabase: Supabase,
  env: { supabaseUrl: string; serviceRoleKey: string },
  jobId: string,
  changeSummary: string | null,
): Promise<ContractRow | null> {
  const draft = await ensureDraft(supabase, jobId)
  if (!draft) return null
  const job = await loadJob(supabase, jobId)
  const painter = await loadPainter(supabase, job.accepted_by)
  const now = new Date().toISOString()

  await supabase.from('job_contracts').update({ status: 'superseded', updated_at: now }).eq('job_id', jobId).eq('status', 'sent')
  const { data: sent, error } = await supabase
    .from('job_contracts')
    .update({
      status: 'sent',
      sent_at: now,
      updated_at: now,
      change_summary: changeSummary,
      terms: termsFor(job, painter, cleanPainterTerms(draft.painter_terms), draft.document_name),
    })
    .eq('id', draft.id)
    .eq('status', 'draft')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!sent) return null

  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
  const isUpdate = sent.version > 1
  await notify(supabase, {
    userId: job.customer_id,
    type: 'contract_sent',
    title: isUpdate ? `${painter.company_name} sent a contract update` : 'Your contract is ready to review',
    body: isUpdate ? (changeSummary ?? 'Review and accept the change.') : 'Review and accept it to continue to your deposit.',
    link: `/customer/dashboard/contract/${jobId}`,
  })
  // The first version is read on the confirm page the customer is already looking at; only a change notice needs an email.
  if (isUpdate && job.customer_email) {
    await fetch(`${env.supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: job.customer_email,
        type: 'contract_update',
        data: {
          customerFirstName: String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'there',
          painterCompanyName: painter.company_name,
          changeSummary,
          reviewUrl: `${frontendUrl}/confirm-job?token=${job.customer_confirm_token}`,
        },
      }),
    }).catch((err) => console.error('contract update email failed:', err))
  }
  return sent as ContractRow
}

/** When the customer and painter agree on dates: the first contract goes to the customer (created now if the painter never opened it). */
export async function sendInitialContract(supabase: Supabase, env: { supabaseUrl: string; serviceRoleKey: string }, jobId: string): Promise<void> {
  const versions = await versionsFor(supabase, jobId)
  if (versions.some((v) => v.status === 'sent' || v.status === 'accepted')) return // already out, or in force
  await sendDraft(supabase, env, jobId, null)
}

export interface ContractGate {
  /** The customer may pay the deposit. */
  ok: boolean
  /** A version is waiting for the customer's answer. */
  pending: boolean
  /** Some version has been accepted. */
  accepted: boolean
  reason?: string
}

/** May the customer pay the deposit yet? Only once a contract version has been accepted and nothing newer is waiting for them. */
export async function contractGate(supabase: Supabase, jobId: string): Promise<ContractGate> {
  const versions = await versionsFor(supabase, jobId)
  const pending = versions.some((v) => v.status === 'sent')
  const accepted = versions.some((v) => v.status === 'accepted')
  if (!accepted) return { ok: false, pending, accepted, reason: 'Please review and accept your contract before paying the deposit.' }
  if (pending) return { ok: false, pending, accepted, reason: 'Your painter sent an update to your contract. Please review and accept it first.' }
  return { ok: true, pending, accepted }
}
