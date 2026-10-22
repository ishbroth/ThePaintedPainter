// supabase/functions/get-painter-business/index.ts
//
// Supabase Edge Function: the painter's business view (schedule, customers,
// income) and rewards (achievements + progress).
//
// Deployed WITH JWT verification on; the painter is resolved from the JWT.
// Only confirmed/completed jobs are used, since those are the ones where the
// customer's contact details have been released to the painter.
//
// Deploy:
//   supabase functions deploy get-painter-business

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { awardAchievements, JOB_MILESTONES, REVIEW_MILESTONES, LOW_REVIEW_MAX_RATING } from '../_shared/achievements.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return jsonError('Method not allowed', 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Missing Supabase environment variables')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Missing Authorization header', 401)

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return jsonError('Not authenticated', 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: painter } = await supabase
      .from('painters')
      .select('id, user_id, company_name')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!painter) return jsonError('No painter profile found for this account', 403)

    // Backfill anything earned before the rewards program existed (no-op once caught up).
    await awardAchievements(supabase, painter).catch((e) => console.error('award backfill failed', e))

    const [jobsRes, reviewsRes, achRes] = await Promise.all([
      supabase
        .from('quote_selections')
        .select(`id, status, customer_id, customer_name, customer_email, customer_phone,
          customer_street_address, customer_city, customer_state, quote_zip, phase_label,
          painter_payout_amount, scheduled_date, scheduled_end_date, completed_at, confirmed_at`)
        .eq('accepted_by', painter.id)
        .in('status', ['confirmed', 'completed']),
      supabase.from('reviews').select('project_id, rating').eq('painter_id', painter.user_id),
      supabase.from('painter_achievements').select('kind, threshold, earned_at').eq('painter_id', painter.id),
    ])
    if (jobsRes.error) throw jobsRes.error

    const ratingByJob = new Map<string, number>()
    let countedReviews = 0
    for (const r of (reviewsRes.data ?? []) as { project_id: string | null; rating: number }[]) {
      if (r.project_id) ratingByJob.set(r.project_id, r.rating)
      if (r.rating > LOW_REVIEW_MAX_RATING) countedReviews++
    }

    // deno-lint-ignore no-explicit-any
    const jobs = (jobsRes.data ?? []) as any[]
    const payout = (j: { painter_payout_amount: number | null }) => Number(j.painter_payout_amount) || 0
    const address = (j: Record<string, string | null>) =>
      [j.customer_street_address, j.customer_city, j.customer_state].filter(Boolean).join(', ') || j.quote_zip

    const completed = jobs.filter((j) => j.status === 'completed')
    const upcoming = jobs.filter((j) => j.status === 'confirmed')

    // Income: completed payouts, bucketed by the month the job was marked done.
    const byMonth = new Map<string, { earned: number; jobs: number }>()
    for (const j of completed) {
      const key = String(j.completed_at ?? '').slice(0, 7)
      if (!key) continue
      const m = byMonth.get(key) ?? { earned: 0, jobs: 0 }
      m.earned += payout(j)
      m.jobs += 1
      byMonth.set(key, m)
    }
    const months: { month: string; earned: number; jobs: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const key = d.toISOString().slice(0, 7)
      months.push({ month: key, ...(byMonth.get(key) ?? { earned: 0, jobs: 0 }) })
    }
    const thisMonth = months[months.length - 1]
    const yearStart = `${now.getUTCFullYear()}-01`
    const yearToDate = completed
      .filter((j) => String(j.completed_at ?? '').slice(0, 7) >= yearStart)
      .reduce((s, j) => s + payout(j), 0)
    const totalEarned = completed.reduce((s, j) => s + payout(j), 0)
    const pipeline = upcoming.reduce((s, j) => s + payout(j), 0)

    // Customers: one row per person (account id, else email, else name).
    const customerMap = new Map<string, {
      name: string | null; email: string | null; phone: string | null; address: string | null
      jobs: number; completedJobs: number; totalPaid: number; lastJobAt: string | null; lowestRating: number | null
      projects: { id: string; label: string | null; status: string; amount: number; date: string | null; rating: number | null }[]
    }>()
    for (const j of jobs) {
      const key = j.customer_id ?? (j.customer_email ? String(j.customer_email).toLowerCase() : `name:${j.customer_name ?? j.id}`)
      const c = customerMap.get(key) ?? {
        name: j.customer_name, email: j.customer_email, phone: j.customer_phone, address: address(j),
        jobs: 0, completedJobs: 0, totalPaid: 0, lastJobAt: null, lowestRating: null, projects: [],
      }
      const when = j.completed_at ?? j.scheduled_date ?? j.confirmed_at ?? null
      const rating = ratingByJob.get(j.id) ?? null
      c.jobs += 1
      if (j.status === 'completed') { c.completedJobs += 1; c.totalPaid += payout(j) }
      if (when && (!c.lastJobAt || when > c.lastJobAt)) c.lastJobAt = when
      if (rating != null && (c.lowestRating == null || rating < c.lowestRating)) c.lowestRating = rating
      c.projects.push({ id: j.id, label: j.phase_label, status: j.status, amount: payout(j), date: when, rating })
      customerMap.set(key, c)
    }
    const customers = [...customerMap.values()].sort((a, b) => (b.lastJobAt ?? '').localeCompare(a.lastJobAt ?? ''))

    const schedule = upcoming
      .map((j) => ({
        id: j.id,
        label: j.phase_label,
        customerName: j.customer_name,
        customerPhone: j.customer_phone,
        address: address(j),
        scheduledDate: j.scheduled_date,
        scheduledEndDate: j.scheduled_end_date,
        amount: payout(j),
      }))
      .sort((a, b) => (a.scheduledDate ?? '9999').localeCompare(b.scheduledDate ?? '9999'))

    return new Response(
      JSON.stringify({
        companyName: painter.company_name,
        income: {
          totalEarned, thisMonth: thisMonth.earned, yearToDate, pipeline,
          completedJobs: completed.length,
          averageJob: completed.length ? Math.round(totalEarned / completed.length) : 0,
          months,
        },
        schedule,
        customers,
        rewards: {
          completedJobs: completed.length,
          countedReviews,
          jobMilestones: JOB_MILESTONES,
          reviewMilestones: REVIEW_MILESTONES,
          earned: achRes.data ?? [],
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in get-painter-business:', error)
    return jsonError(error instanceof Error ? error.message : 'Internal server error', 500)
  }
})
