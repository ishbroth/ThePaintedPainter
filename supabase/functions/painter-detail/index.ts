// supabase/functions/painter-detail/index.ts
//
// Supabase Edge Function: the expanded view of one painter in the results
//
// What a customer sees after clicking into a listing: credentials (license,
// insurance, bond — status and providers, but NOT license/policy numbers), crew
// size, jobs per month, services, warranty, the full portfolio, and actual review
// text from The Painted Painter.
//
// Deliberately never returned: email, phone, street address, owner's name, pricing
// answers, license/policy numbers. Contact details are shared only after the
// customer and painter have confirmed the job by email.
//
// POST { painterId }
//
// Deploy:
//   supabase functions deploy painter-detail --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { cleanExternalReviews } from '../_shared/externalReviews.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_REVIEWS = 25
const MAX_PHOTOS = 24

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** "Jane Doe" -> "Jane D." — first name and last initial only. */
function reviewerLabel(name: unknown): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A customer'
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

    const { painterId } = await req.json() as { painterId?: string }
    if (!painterId) return json({ error: 'Missing painterId' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: p } = await supabase
      .from('painters')
      .select('id, user_id, company_name, city, state, bio, years_in_business, crew_size, projects_per_month, max_project_size, service_types, offers_estimates, offers_warranty, warranty_length, has_license, license_state, license_expiration, is_insured, insurance_company, coverage_amount, is_bonded, bonding_company, bond_amount, has_workers_comp, workers_comp_carrier, certifications, other_certification, external_reviews')
      .eq('id', painterId)
      .eq('status', 'approved')
      .eq('verified', true)
      .maybeSingle()
    if (!p) return json({ error: 'Painter not found' }, 404)

    const { data: reviewRows } = p.user_id
      ? await supabase
          .from('reviews')
          .select('rating, title, body, customer_name, created_at')
          .eq('painter_id', p.user_id)
          .order('created_at', { ascending: false })
      : { data: [] as { rating: number; title: string | null; body: string | null; customer_name: string | null; created_at: string }[] }

    const all = reviewRows ?? []
    const average = all.length ? Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10 : null

    const { data: portfolio } = await supabase
      .from('painter_portfolio')
      .select('storage_path, caption')
      .eq('painter_id', p.id)
      .order('created_at', { ascending: false })
      .limit(MAX_PHOTOS)

    return json({
      companyName: p.company_name,
      city: p.city,
      state: p.state,
      bio: p.bio,
      yearsInBusiness: p.years_in_business,
      crewSize: p.crew_size,
      jobsPerMonth: p.projects_per_month,
      maxProjectSize: p.max_project_size,
      services: p.service_types ?? [],
      offersEstimates: p.offers_estimates,
      warranty: p.offers_warranty ? (p.warranty_length || 'Yes') : null,
      credentials: {
        license: { has: !!p.has_license, state: p.license_state, expires: p.license_expiration },
        insurance: { has: !!p.is_insured, company: p.insurance_company, coverage: p.coverage_amount },
        bond: { has: !!p.is_bonded, company: p.bonding_company, amount: p.bond_amount },
        workersComp: { has: !!p.has_workers_comp, carrier: p.workers_comp_carrier },
        certifications: [...(p.certifications ?? []).filter((c: string) => c !== 'Other'), ...(p.other_certification ? [p.other_certification] : [])],
      },
      external: cleanExternalReviews(p.external_reviews),
      photos: (portfolio ?? []).map((row) => ({
        url: `${supabaseUrl}/storage/v1/object/public/painter-portfolio/${row.storage_path}`,
        caption: row.caption,
      })),
      rating: { average, count: all.length },
      reviews: all.slice(0, MAX_REVIEWS).map((r) => ({
        rating: r.rating,
        title: r.title,
        body: r.body,
        reviewer: reviewerLabel(r.customer_name),
        date: String(r.created_at).slice(0, 10),
      })),
    })
  } catch (error) {
    console.error('Error in painter-detail:', error)
    return json({ error: 'Could not load this painter' }, 500)
  }
})
