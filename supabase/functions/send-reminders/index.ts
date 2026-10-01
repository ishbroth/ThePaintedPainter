// supabase/functions/send-reminders/index.ts
//
// Supabase Edge Function: the daily reminder sweep (push + in-app + email)
//
// Called once a day by pg_cron (see the cron setup note in the notifications
// migration). Guarded by a shared secret in the x-cron-secret header — it is
// not callable by users. Each reminder is recorded in job_reminders so a re-run
// or a late retry never double-sends.
//
//   week_before     confirmed job starts in 7 days            -> both (push/in-app)
//   day_before      confirmed job starts tomorrow             -> both (push/in-app + email)
//   deposit_nudge   date set, deposit unpaid after 24h        -> customer
//   date_nudge      painter accepted, no date after 24h       -> painter
//   complete_nudge  confirmed job started 2+ days ago         -> painter ("mark completed")
//
// Deploy:
//   supabase functions deploy send-reminders --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { notify } from '../_shared/notify.ts'

const DAY = 24 * 60 * 60 * 1000

const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)

serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return new Response('Server is not configured', { status: 500 })
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'

  const email = (to: string | null | undefined, type: string, data: Record<string, unknown>) =>
    to
      ? fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, type, data }),
        }).catch((err) => console.error('reminder email failed:', err))
      : Promise.resolve()

  const counts: Record<string, number> = {}

  // deno-lint-ignore no-explicit-any
  const claim = async (jobId: string, kind: string): Promise<boolean> => {
    // The primary key makes this an atomic "first one wins".
    const { error } = await supabase.from('job_reminders').insert({ job_id: jobId, kind })
    return !error
  }

  const painterUser = async (painterId: string | null) => {
    if (!painterId) return { userId: null as string | null, email: null as string | null }
    const { data } = await supabase.from('painters').select('user_id, email').eq('id', painterId).maybeSingle()
    return { userId: data?.user_id ?? null, email: data?.email ?? null }
  }

  const where = (j: { customer_street_address: string | null; customer_city: string | null }) =>
    [j.customer_street_address, j.customer_city].filter(Boolean).join(', ') || 'your project'

  const cols = 'id, accepted_by, customer_id, customer_name, customer_email, customer_street_address, customer_city, scheduled_date'

  // ---- week_before / day_before ----
  for (const [kind, offset] of [['week_before', 7], ['day_before', 1]] as const) {
    const { data: jobs } = await supabase.from('quote_selections').select(cols).eq('status', 'confirmed').eq('scheduled_date', isoDate(offset))
    for (const j of jobs ?? []) {
      if (!(await claim(j.id, kind))) continue
      const when = kind === 'day_before' ? 'tomorrow' : 'in one week'
      const painter = await painterUser(j.accepted_by)
      await notify(supabase, {
        userId: j.customer_id, type: 'project_reminder', title: `Your painting project starts ${when}`,
        body: `${where(j)} · ${j.scheduled_date}`, link: '/customer/projects',
      })
      await notify(supabase, {
        userId: painter.userId, type: 'project_reminder', title: `Job starts ${when}`,
        body: `${where(j)} · ${j.scheduled_date}`, link: '/painter/projects',
      })
      if (kind === 'day_before') {
        await email(j.customer_email, 'project_reminder', {
          customerName: j.customer_name, projectName: where(j), scheduledDate: j.scheduled_date,
        })
        await email(painter.email, 'new_notification', {
          title: 'A job starts tomorrow', body: `${where(j)} · ${j.scheduled_date}`, link: `${frontendUrl}/painter/projects`,
        })
      }
      counts[kind] = (counts[kind] ?? 0) + 1
    }
  }

  // ---- deposit_nudge: date set, unpaid for 24h+ ----
  {
    const { data: jobs } = await supabase
      .from('quote_selections').select(cols)
      .eq('status', 'painter_accepted').not('scheduled_date', 'is', null)
      .lt('date_confirmed_at', new Date(Date.now() - DAY).toISOString())
    for (const j of jobs ?? []) {
      if (!(await claim(j.id, 'deposit_nudge'))) continue
      await notify(supabase, {
        userId: j.customer_id, type: 'deposit_reminder', title: 'Confirm your start date',
        body: `Pay your deposit to lock in ${j.scheduled_date}.`, link: '/customer/projects',
      })
      await email(j.customer_email, 'new_notification', {
        title: 'Your painter is waiting on your deposit', body: `Pay your deposit to lock in ${j.scheduled_date}.`, link: `${frontendUrl}/customer/projects`,
      })
      counts.deposit_nudge = (counts.deposit_nudge ?? 0) + 1
    }
  }

  // ---- date_nudge: accepted, no date after 24h ----
  {
    const { data: jobs } = await supabase
      .from('quote_selections').select(`${cols}, claim_token`)
      .eq('status', 'painter_accepted').is('scheduled_date', null)
      .lt('accepted_at', new Date(Date.now() - DAY).toISOString())
    for (const j of jobs ?? []) {
      if (!(await claim(j.id, 'date_nudge'))) continue
      const painter = await painterUser(j.accepted_by)
      await notify(supabase, {
        userId: painter.userId, type: 'date_reminder', title: 'Choose a start date',
        body: 'The customer can\'t pay their deposit until you set one.', link: '/painter/projects',
      })
      await email(painter.email, 'new_notification', {
        title: 'Choose a start date', body: 'The customer can\'t pay their deposit until you set one.', link: `${frontendUrl}/painter/projects`,
      })
      counts.date_nudge = (counts.date_nudge ?? 0) + 1
    }
  }

  // ---- complete_nudge: started 2+ days ago, still 'confirmed' ----
  {
    const { data: jobs } = await supabase
      .from('quote_selections').select(cols)
      .eq('status', 'confirmed').lte('scheduled_date', isoDate(-2))
    for (const j of jobs ?? []) {
      if (!(await claim(j.id, 'complete_nudge'))) continue
      const painter = await painterUser(j.accepted_by)
      await notify(supabase, {
        userId: painter.userId, type: 'complete_reminder', title: 'Finished the job?',
        body: `Mark ${where(j)} completed so the customer can leave a review.`, link: '/painter/projects',
      })
      counts.complete_nudge = (counts.complete_nudge ?? 0) + 1
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: counts }), { headers: { 'Content-Type': 'application/json' } })
})
