// supabase/functions/job-messages/index.ts
//
// Supabase Edge Function: in-app messages between the customer and the painter of a confirmed job.
//
// Deployed WITH JWT verification on (no --no-verify-jwt flag): the gateway rejects requests without a valid login before this
// code runs, and inside, the caller is read from that same verified token.
//
// job_messages has no row level security policies and no browser privileges, so this function (service role) is the ONLY way to
// reach it. Every action first works out which side of the job the caller is on (the painter who accepted it, or the customer who
// booked it) and answers "not found" to anyone else, then applies the rules in _shared/jobMessages.ts: messages can be sent only
// once both parties have confirmed and the job is on the schedule (status 'confirmed' with a scheduled date).
//
// POST { action, jobId, ... }
//   list    { jobId }          the thread (oldest first); messages from the other person are marked read
//   send    { jobId, body }    add a message; the other person gets a notification (in-app feed + push)
//   unread  {}                 how many unread messages the caller has on each of their jobs: { unread: { [jobId]: n } }
//
// No email is sent for messages (the app's notification feed and push carry them); emails stay for the events that already send them.
//
// Deploy:
//   supabase functions deploy job-messages

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { notify } from '../_shared/notify.ts'
import {
  canReadMessages, canSendMessages, cleanMessageBody, firstName, isRateLimited, participantRole, snippet, threadLink,
  RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS, type CallerIdentity, type JobForMessaging, type MessageRole,
} from '../_shared/jobMessages.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const notFound = () => json({ error: 'That conversation was not found.' }, 404)

const JOB_COLUMNS = 'id, status, scheduled_date, completed_at, customer_id, customer_email, customer_name, accepted_by'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server is not configured' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)
    const user = userData.user
    const caller: CallerIdentity = { userId: user.id, confirmedEmail: user.email_confirmed_at ? (user.email ?? null) : null }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const input = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(input.action ?? '')

    // the caller's painter row, if they are a painter (a customer has none)
    const { data: painterRow } = await supabase.from('painters').select('id, company_name, user_id').eq('user_id', user.id).maybeSingle()

    // ---- unread counts across all of the caller's jobs ----
    if (action === 'unread') {
      const orFilter = [
        painterRow ? `accepted_by.eq.${painterRow.id}` : null,
        `customer_id.eq.${user.id}`,
        caller.confirmedEmail ? `and(customer_id.is.null,customer_email.eq.${caller.confirmedEmail})` : null,
      ].filter(Boolean).join(',')
      const { data: jobs } = await supabase.from('quote_selections').select(JOB_COLUMNS).or(orFilter).in('status', ['confirmed', 'completed'])
      const mine = ((jobs ?? []) as (JobForMessaging & { customer_name: string | null })[])
        .map((j) => ({ j, role: participantRole(j, caller, painterRow) }))
        .filter((x): x is { j: JobForMessaging & { customer_name: string | null }; role: MessageRole } => !!x.role && canReadMessages(x.j))
      const unread: Record<string, number> = {}
      if (mine.length) {
        const { data: rows } = await supabase
          .from('job_messages').select('job_id, sender_role')
          .in('job_id', mine.map((x) => x.j.id)).is('read_at', null)
        for (const r of (rows ?? []) as { job_id: string; sender_role: MessageRole }[]) {
          const role = mine.find((x) => x.j.id === r.job_id)?.role
          if (role && r.sender_role !== role) unread[r.job_id] = (unread[r.job_id] ?? 0) + 1
        }
      }
      return json({ unread })
    }

    if (action !== 'list' && action !== 'send') return json({ error: 'Unknown action' }, 400)
    const jobId = String(input.jobId ?? '')
    if (!UUID.test(jobId)) return notFound()

    const { data: job } = await supabase.from('quote_selections').select(JOB_COLUMNS).eq('id', jobId).maybeSingle()
    if (!job) return notFound()
    const role = participantRole(job as JobForMessaging, caller, painterRow)
    if (!role) return notFound() // not their job: indistinguishable from a job that does not exist
    const otherRole: MessageRole = role === 'painter' ? 'customer' : 'painter'

    if (action === 'list') {
      if (!canReadMessages(job as JobForMessaging)) return json({ error: 'Messaging opens once you and your ' + (role === 'painter' ? 'client' : 'painter') + ' have both confirmed.', locked: true }, 403)
      const { data: rows } = await supabase
        .from('job_messages').select('id, sender_role, body, created_at, read_at')
        .eq('job_id', jobId).order('created_at', { ascending: true }).limit(500)
      const messages = (rows ?? []) as { id: string; sender_role: MessageRole; body: string; created_at: string; read_at: string | null }[]
      const unreadFromOther = messages.filter((m) => m.sender_role === otherRole && !m.read_at).map((m) => m.id)
      if (unreadFromOther.length) {
        const readAt = new Date().toISOString()
        await supabase.from('job_messages').update({ read_at: readAt }).in('id', unreadFromOther)
        // the same notifications in the feed are no longer news
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('type', 'message').eq('link', threadLink(role, jobId)).eq('is_read', false)
      }
      return json({
        role,
        canSend: canSendMessages(job as JobForMessaging),
        otherName: role === 'painter' ? firstName(job.customer_name, 'Your client') : await painterName(supabase, job.accepted_by),
        messages: messages.map((m) => ({ id: m.id, from: m.sender_role === role ? 'me' : 'them', body: m.body, createdAt: m.created_at, read: !!m.read_at || m.sender_role === otherRole })),
      })
    }

    // ---- send ----
    if (!canSendMessages(job as JobForMessaging)) {
      return json({ error: 'Messaging opens once you and your ' + (role === 'painter' ? 'client' : 'painter') + ' have both confirmed and the job is scheduled.', locked: true }, 403)
    }
    const cleaned = cleanMessageBody(input.body)
    if (!cleaned.ok) return json({ error: cleaned.error }, 400)

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const { data: recent } = await supabase
      .from('job_messages').select('created_at').eq('job_id', jobId).eq('sender_role', role).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(RATE_LIMIT_COUNT)
    if (isRateLimited(((recent ?? []) as { created_at: string }[]).map((r) => r.created_at))) {
      return json({ error: 'You are sending messages very quickly. Please wait a few minutes.' }, 429)
    }

    const { data: inserted, error: insertError } = await supabase
      .from('job_messages').insert({ job_id: jobId, sender_user_id: user.id, sender_role: role, body: cleaned.body })
      .select('id, created_at').single()
    if (insertError || !inserted) throw insertError ?? new Error('insert failed')

    // tell the other person, in the feed they already use (and on their phone if push is on)
    const recipientUserId = otherRole === 'painter' ? await painterUserId(supabase, job.accepted_by) : await customerUserId(supabase, job)
    const senderLabel = role === 'painter' ? (painterRow?.company_name ?? 'Your painter') : firstName(job.customer_name, 'Your client')
    await notify(supabase, {
      userId: recipientUserId, type: 'message', title: `New message from ${senderLabel}`, body: snippet(cleaned.body), link: threadLink(otherRole, jobId),
    })

    return json({ success: true, message: { id: inserted.id, from: 'me', body: cleaned.body, createdAt: inserted.created_at, read: false } })
  } catch (error) {
    console.error('Error in job-messages:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
type Db = any

async function painterName(supabase: Db, painterId: string | null): Promise<string> {
  if (!painterId) return 'Your painter'
  const { data } = await supabase.from('painters').select('company_name').eq('id', painterId).maybeSingle()
  return data?.company_name ?? 'Your painter'
}
async function painterUserId(supabase: Db, painterId: string | null): Promise<string | null> {
  if (!painterId) return null
  const { data } = await supabase.from('painters').select('user_id').eq('id', painterId).maybeSingle()
  return data?.user_id ?? null
}
/**
 * The customer's login, when the job records one. A job claimed as a guest has none: that customer still sees the message (and the unread badge)
 * the next time they open My Projects, there is just no feed entry to put it in.
 */
// deno-lint-ignore require-await
async function customerUserId(_supabase: Db, job: { customer_id: string | null }): Promise<string | null> {
  return job.customer_id ?? null
}
