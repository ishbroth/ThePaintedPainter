// supabase/functions/reschedule-job/index.ts
//
// Supabase Edge Function: change the start date of a paid (confirmed) job
//
// Both sides read the same quote_selections.scheduled_date, so a reschedule is
// one column update plus an email to the other party.
//   - Painter: the date changes immediately; the customer is emailed.
//   - Customer: can only REQUEST a new date (the painter owns their calendar);
//     the date is unchanged and the painter is emailed the proposed date.
//
// Deployed WITH JWT verification on — caller must be signed in.
//
// POST { jobId, newDate: 'YYYY-MM-DD' }
//
// Deploy:
//   supabase functions deploy reschedule-job

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { notify } from '../_shared/notify.ts'
import { buildIcs, toBase64 } from '../_shared/ics.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Missing Supabase environment variables' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)
    const userId = userData.user.id
    const userEmail = userData.user.email

    const { jobId, newDate } = await req.json() as { jobId?: string; newDate?: string }
    if (!jobId || !newDate) return json({ error: 'Missing jobId or newDate' }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return json({ error: 'newDate must be YYYY-MM-DD' }, 400)
    if (newDate < new Date().toISOString().slice(0, 10)) return json({ error: 'Date cannot be in the past' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: job } = await supabase
      .from('quote_selections')
      .select('id, status, accepted_by, customer_id, customer_email, customer_street_address, customer_city, scheduled_date')
      .eq('id', jobId)
      .maybeSingle()
    if (!job) return json({ error: 'Job not found' }, 404)
    if (job.status !== 'confirmed') return json({ error: 'Only confirmed jobs can be rescheduled' }, 409)

    const { data: painter } = await supabase
      .from('painters')
      .select('id, user_id, email, company_name')
      .eq('id', job.accepted_by)
      .maybeSingle()

    const isPainter = !!painter && painter.user_id === userId
    const isCustomer = job.customer_id === userId || (!!userEmail && job.customer_email === userEmail)
    if (!isPainter && !isCustomer) return json({ error: 'Not your job' }, 403)

    const send = (to: string, type: string, data: Record<string, unknown>, attachments?: unknown[]) =>
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, type, data, attachments }),
      }).catch((err) => console.error('reschedule email failed:', err))

    const location = [job.customer_street_address, job.customer_city].filter(Boolean).join(', ')

    if (isPainter) {
      const { error } = await supabase
        .from('quote_selections')
        .update({ scheduled_date: newDate, date_confirmed_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'confirmed')
      if (error) throw error
      if (job.customer_email) {
        const ics = buildIcs({ uid: job.id, title: 'Painting project starts', date: newDate, location })
        await send(job.customer_email, 'job_rescheduled', {
          location, oldDate: job.scheduled_date, newDate, changedBy: painter?.company_name ?? 'your painter',
        }, [{ filename: 'painting-project.ics', content: toBase64(ics) }])
      }
      await notify(supabase, {
        userId: job.customer_id, type: 'rescheduled', title: 'Your start date changed',
        body: `New start date: ${newDate}`, link: '/customer/projects',
      })
      return json({ success: true, applied: true })
    }

    // Customer: request only.
    await notify(supabase, {
      userId: painter?.user_id, type: 'reschedule_request', title: 'Customer asked for a new start date',
      body: `Requested: ${newDate}`, link: '/painter/projects',
    })
    if (painter?.email) {
      await send(painter.email, 'job_rescheduled', {
        location, oldDate: job.scheduled_date, newDate, changedBy: 'the customer (a request — update the date in your dashboard to accept)',
      })
    }
    return json({ success: true, applied: false })
  } catch (error) {
    console.error('Error in reschedule-job:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
