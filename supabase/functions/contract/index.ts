// supabase/functions/contract/index.ts
//
// Supabase Edge Function: the contract between a customer and the painter who confirmed their job.
//
// Who is asking is decided here, never taken from the request:
//   painter   a signed-in painter who is the job's accepted painter (JWT)
//   customer  the job's customer, either signed in (their account owns the job, or its email matches) or holding the job's confirm
//             token from the email link (guests)
//
// POST { action, jobId? | token?, ... }
//   get                                          the versions, with the viewer's role and what they may do
//   document_url   { versionId }                 short-lived link to the painter's own attached document
//   upload_url     { filename, size }           (painter) a signed upload slot for their own contract document
//   save_draft     { scopeNotes, specialTerms, warranty, changeOrders, documentPath?, documentName?, documentSize?, removeDocument? }
//                                                (painter) edit the working copy
//   send           { changeSummary }            (painter) send the working copy to the customer
//   accept         { versionId, name, agree }   (customer) accept a version they were sent
//   decline        { versionId, note? }         (customer) decline it
//
// Before the deposit is paid the painter sees the customer's first name only, and the customer sees the painter's company name and
// credentials only; full details appear once the deposit is paid (the same rule as everywhere else on the site).
//
// Deploy:
//   supabase functions deploy contract --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { cleanPainterTerms, contractTotals, type PainterTerms } from '../_shared/contract.ts'
import { ensureDraft, loadJob, loadPainter, sendDraft, termsFor, versionsFor, type ContractRow } from '../_shared/contractStore.ts'
import { notify } from '../_shared/notify.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const BUCKET = 'contract-documents'
const MAX_DOC_BYTES = 10 * 1024 * 1024
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx']
const OPEN_STATUSES = ['painter_accepted', 'confirmed', 'completed']

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server is not configured' }, 500)
    const env = { supabaseUrl, serviceRoleKey }
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const body = await req.json() as Record<string, unknown>
    const action = String(body.action ?? '')

    // ---- which job, and who is asking ----
    let job = null
    const token = typeof body.token === 'string' ? body.token : ''
    if (token) {
      const { data } = await supabase.from('quote_selections').select('id').eq('customer_confirm_token', token).maybeSingle()
      if (data) job = await loadJob(supabase, data.id)
    } else if (typeof body.jobId === 'string') {
      job = await loadJob(supabase, body.jobId)
    }
    if (!job) return json({ error: 'We couldn\'t find that project.' }, 404)
    if (!job.accepted_by || !OPEN_STATUSES.includes(job.status)) return json({ error: 'This project has no contract yet.' }, 404)

    const painter = await loadPainter(supabase, job.accepted_by)
    if (!painter) return json({ error: 'We couldn\'t find that project.' }, 404)

    let role: 'painter' | 'customer' | null = null
    if (token && job.customer_confirm_token === token) {
      role = 'customer'
    } else {
      const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (bearer && bearer !== anonKey) {
        const { data: userData } = await supabase.auth.getUser(bearer)
        const user = userData?.user
        if (user) {
          if (painter.user_id && painter.user_id === user.id) role = 'painter'
          else if (job.customer_id === user.id || (user.email && String(job.customer_email ?? '').toLowerCase() === user.email.toLowerCase())) role = 'customer'
        }
      }
    }
    if (!role) return json({ error: 'You don\'t have access to this contract.' }, 403)

    const paid = job.deposit_status === 'paid' || job.status === 'confirmed' || job.status === 'completed'
    const first = String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'The customer'
    const contractUrlFor = (r: 'painter' | 'customer') => (r === 'painter' ? `${frontendUrl}/painter/dashboard/contract/${job.id}` : `${frontendUrl}/confirm-job?token=${job.customer_confirm_token}`)

    // ---- reading ----
    const view = async () => {
      const all = await versionsFor(supabase, job.id)
      const visible = role === 'painter' ? all : all.filter((v) => v.status !== 'draft')
      const shaped = visible.map((v) => shapeVersion(v))
      const inForce = [...all].reverse().find((v) => v.status === 'accepted')
      const pending = [...all].reverse().find((v) => v.status === 'sent')
      const draft = all.find((v) => v.status === 'draft')
      return {
        role,
        job: { id: job.id, status: job.status, phaseLabel: job.phase_label, paid, dateState: job.date_state, depositAmount: job.deposit_amount },
        // who the parties are: full details only to the party they belong to, or once the deposit is paid
        parties: {
          customer: {
            name: role === 'customer' || paid ? job.customer_name : first,
            address: role === 'customer' || paid ? [job.customer_street_address, job.customer_city, job.customer_state].filter(Boolean).join(', ') || null : null,
            email: role === 'customer' || paid ? job.customer_email : null,
            phone: role === 'customer' || paid ? job.customer_phone : null,
          },
          painter: {
            companyName: painter.company_name,
            ownerName: role === 'painter' || paid ? painter.owner_name : null,
            email: role === 'painter' || paid ? painter.email : null,
            phone: role === 'painter' || paid ? painter.phone : null,
          },
        },
        versions: shaped,
        inForceVersionId: inForce?.id ?? null,
        pendingVersionId: pending?.id ?? null,
        draftVersionId: role === 'painter' ? draft?.id ?? null : null,
        // a painter can send once the dates are agreed (the first version also goes out by itself then)
        canSend: role === 'painter' && (job.date_state === 'agreed' || paid) && job.status !== 'completed',
        canEdit: role === 'painter' && job.status !== 'completed',
      }
    }

    const shapeVersion = (v: ContractRow) => {
      // versions still open to change are shown as they would read today; answered ones keep the exact text that was accepted or declined
      const live = v.status === 'draft' || v.status === 'sent'
      const painterTerms = cleanPainterTerms(v.painter_terms)
      const terms = live ? termsFor(job, painter, painterTerms, v.document_name) : v.terms
      return {
        id: v.id,
        version: v.version,
        status: v.status,
        sentAt: v.sent_at,
        respondedAt: v.responded_at,
        changeSummary: v.change_summary,
        acceptedName: v.accepted_name,
        customerNote: v.customer_note,
        document: v.document_path ? { name: v.document_name, size: v.document_size } : null,
        painterTerms,
        totals: contractTotals(terms, painterTerms),
        terms,
      }
    }

    if (action === 'get') {
      // a job that reached the deposit step before contracts existed gets its contract now
      const all = await versionsFor(supabase, job.id)
      if (all.length === 0 && role === 'painter') await ensureDraft(supabase, job.id)
      if (all.length === 0 && role === 'customer' && job.date_state === 'agreed' && job.status === 'painter_accepted') await sendDraft(supabase, env, job.id, null)
      return json(await view())
    }

    // ---- document links ----
    if (action === 'document_url') {
      const all = await versionsFor(supabase, job.id)
      const v = all.find((x) => x.id === body.versionId)
      if (!v || !v.document_path) return json({ error: 'No document attached.' }, 404)
      if (role === 'customer' && v.status === 'draft') return json({ error: 'No document attached.' }, 404)
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(v.document_path, 120, { download: v.document_name ?? true })
      if (error || !data) return json({ error: 'Could not open the document.' }, 500)
      return json({ url: data.signedUrl })
    }

    // everything below changes something
    if (action === 'upload_url' || action === 'save_draft' || action === 'send') {
      if (role !== 'painter') return json({ error: 'Only the painter can edit or send the contract.' }, 403)
      if (job.status === 'completed') return json({ error: 'This job is completed, so the contract can no longer be changed.' }, 409)
    }

    if (action === 'upload_url') {
      const filename = String(body.filename ?? '')
      const size = Number(body.size)
      const ext = filename.split('.').pop()?.toLowerCase() ?? ''
      if (!DOC_EXTENSIONS.includes(ext)) return json({ error: 'Attach a PDF or Word document (.pdf, .doc or .docx).' }, 400)
      if (!isFinite(size) || size <= 0 || size > MAX_DOC_BYTES) return json({ error: 'The document must be 10 MB or smaller.' }, 400)
      const safe = filename.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)
      const path = `${job.id}/${crypto.randomUUID()}-${safe}`
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data) return json({ error: 'Could not start the upload.' }, 500)
      return json({ path: data.path, token: data.token, bucket: BUCKET })
    }

    if (action === 'save_draft') {
      const draft = await ensureDraft(supabase, job.id)
      if (!draft) return json({ error: 'Could not open the contract.' }, 500)
      const painterTerms: PainterTerms = cleanPainterTerms(body)
      const update: Record<string, unknown> = { painter_terms: painterTerms, updated_at: new Date().toISOString() }
      if (body.removeDocument === true) {
        update.document_path = null
        update.document_name = null
        update.document_size = null
      } else if (typeof body.documentPath === 'string' && body.documentPath) {
        if (!body.documentPath.startsWith(`${job.id}/`)) return json({ error: 'That document doesn\'t belong to this project.' }, 400)
        update.document_path = body.documentPath
        update.document_name = String(body.documentName ?? 'Contract document').slice(0, 200)
        update.document_size = Number(body.documentSize) || null
      }
      const documentName = (update.document_name as string | null | undefined) === undefined ? draft.document_name : (update.document_name as string | null)
      update.terms = termsFor(job, painter, painterTerms, documentName)
      const { error } = await supabase.from('job_contracts').update(update).eq('id', draft.id).eq('status', 'draft')
      if (error) throw error
      return json(await view())
    }

    if (action === 'send') {
      if (!(job.date_state === 'agreed' || paid)) return json({ error: 'Your contract goes to the customer automatically once you agree on dates. Until then you can keep editing it.' }, 409)
      const all = await versionsFor(supabase, job.id)
      const draft = all.find((v) => v.status === 'draft')
      if (!draft) return json({ error: 'There is nothing new to send. Make a change first.' }, 409)
      const summary = String(body.changeSummary ?? '').trim().slice(0, 1500)
      if (draft.version > 1 && !summary) return json({ error: 'Describe what changed so the customer knows what they are accepting.' }, 400)
      await sendDraft(supabase, env, job.id, summary || null)
      return json(await view())
    }

    if (action === 'accept' || action === 'decline') {
      if (role !== 'customer') return json({ error: 'Only the customer can respond to the contract.' }, 403)
      const all = await versionsFor(supabase, job.id)
      const v = all.find((x) => x.id === body.versionId)
      if (!v || v.status !== 'sent') return json({ error: 'That version isn\'t waiting for your answer any more. Reload the page.' }, 409)
      const now = new Date().toISOString()

      if (action === 'accept') {
        const name = String(body.name ?? '').trim().replace(/\s+/g, ' ')
        if (body.agree !== true || name.length < 3) return json({ error: 'Type your full name and tick the box to accept.' }, 400)
        // the version that was shown is what is recorded: rebuilt one last time so the dates are the agreed ones
        const painterTerms = cleanPainterTerms(v.painter_terms)
        await supabase.from('job_contracts').update({ status: 'superseded', updated_at: now }).eq('job_id', job.id).eq('status', 'accepted')
        const { error } = await supabase
          .from('job_contracts')
          .update({
            status: 'accepted',
            responded_at: now,
            updated_at: now,
            accepted_name: name.slice(0, 120),
            accepted_ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64) || null,
            accepted_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
            terms: termsFor(job, painter, painterTerms, v.document_name),
          })
          .eq('id', v.id)
          .eq('status', 'sent')
        if (error) throw error
      } else {
        const note = String(body.note ?? '').trim().slice(0, 1500)
        const { error } = await supabase.from('job_contracts').update({ status: 'declined', responded_at: now, updated_at: now, customer_note: note || null }).eq('id', v.id).eq('status', 'sent')
        if (error) throw error
        body.note = note
      }

      const accepted = action === 'accept'
      await notify(supabase, {
        userId: painter.user_id,
        type: accepted ? 'contract_accepted' : 'contract_declined',
        title: accepted ? `${first} accepted ${v.version > 1 ? 'your contract update' : 'the contract'}` : `${first} declined ${v.version > 1 ? 'your contract update' : 'the contract'}`,
        body: accepted ? 'It is now in force.' : (String(body.note ?? '') || 'Open the contract to see their note.'),
        link: `/painter/dashboard/contract/${job.id}`,
      })
      if (painter.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: painter.email,
            type: 'contract_response',
            data: { customerFirstName: first, outcome: accepted ? 'accepted' : 'declined', note: String(body.note ?? ''), isUpdate: v.version > 1, link: contractUrlFor('painter') },
          }),
        }).catch((err) => console.error('contract response email failed:', err))
      }
      return json(await view())
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('Error in contract:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
