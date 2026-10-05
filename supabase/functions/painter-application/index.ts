// supabase/functions/painter-application/index.ts
//
// Supabase Edge Function: the signed-in painter's own application status
//
// GET                          -> { status, tasks, adminMessage, nextReminderAt, canRemind }
// POST { action: 'remind' }    -> re-sends the application to the admin (only while
//                                 status is 'pending'; at most once per 30 days —
//                                 sign-up counts as the first send)
// POST { action: 'submit_tasks', doneTaskIds: string[] }
//                              -> marks those tasks done, sets status back to
//                                 'pending', emails the admin the checklist plus
//                                 signed links to anything uploaded. No rate limit:
//                                 this is the painter responding to a request.
//
// Deployed WITH JWT verification on.
//
// Deploy:
//   supabase functions deploy painter-application

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { buildReviewUrl, ADMIN_EMAIL } from '../_shared/adminLink.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const REMIND_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

interface Task { id: string; label: string; done: boolean }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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
    const userId = userData.user.id

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: painter } = await supabase
      .from('painters')
      .select('id, company_name, status, application_tasks, admin_message, last_reminder_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (!painter) return json({ error: 'No painter application found for this account' }, 404)

    const tasks = (painter.application_tasks ?? []) as Task[]
    const lastReminder = painter.last_reminder_at ? new Date(painter.last_reminder_at).getTime() : 0
    const nextReminderAt = lastReminder ? new Date(lastReminder + REMIND_INTERVAL_MS).toISOString() : null
    const canRemind = painter.status === 'pending' && (!lastReminder || Date.now() - lastReminder >= REMIND_INTERVAL_MS)

    if (req.method === 'GET') {
      return json({ status: painter.status, tasks, adminMessage: painter.admin_message, nextReminderAt, canRemind })
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const body = await req.json() as { action?: string; doneTaskIds?: string[] }

    const sendAdmin = async (type: string, data: Record<string, unknown>) => {
      const reviewUrl = await buildReviewUrl(painter.id)
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: ADMIN_EMAIL(), type, data: { companyName: painter.company_name, reviewUrl, ...data } }),
      })
    }

    if (body.action === 'remind') {
      if (painter.status !== 'pending') return json({ error: 'Your application isn\'t waiting on review right now.' }, 409)
      if (!canRemind) return json({ error: 'You can send a reminder once a month.', nextReminderAt }, 429)
      await sendAdmin('painter_application_reminder', {})
      await supabase.from('painters').update({ last_reminder_at: new Date().toISOString() }).eq('id', painter.id)
      return json({ success: true, nextReminderAt: new Date(Date.now() + REMIND_INTERVAL_MS).toISOString() })
    }

    if (body.action === 'submit_tasks') {
      if (painter.status !== 'needs_info') return json({ error: 'There are no open tasks on your application.' }, 409)
      const doneIds = new Set(body.doneTaskIds ?? [])
      const updated = tasks.map((t) => ({ ...t, done: t.done || doneIds.has(t.id) }))

      // Signed links to whatever they've uploaded (private bucket), valid 7 days.
      const documents: { name: string; url: string }[] = []
      const { data: files } = await supabase.storage.from('painter-documents').list(userId, { limit: 100 })
      for (const f of files ?? []) {
        const { data: signed } = await supabase.storage.from('painter-documents').createSignedUrl(`${userId}/${f.name}`, 7 * 86400)
        if (signed?.signedUrl) documents.push({ name: f.name, url: signed.signedUrl })
      }

      const { error } = await supabase
        .from('painters')
        .update({ application_tasks: updated, status: 'pending', last_reminder_at: new Date().toISOString() })
        .eq('id', painter.id)
      if (error) throw error

      await sendAdmin('painter_application_updated', {
        completedTasks: updated.filter((t) => t.done).map((t) => t.label),
        openTasks: updated.filter((t) => !t.done).map((t) => t.label),
        documents,
      })
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('Error in painter-application:', error)
    return json({ error: 'Something went wrong' }, 500)
  }
})
