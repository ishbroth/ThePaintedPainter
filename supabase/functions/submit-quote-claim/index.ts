// supabase/functions/submit-quote-claim/index.ts
//
// Supabase Edge Function: Submit a "claim your price" request
//
// Called when a customer finishes the AI quote and picks a specific painter
// or "mystery painter" (fan out to every eligible painter in the area).
// Creates the quote_selections row, determines which painter(s) to notify,
// and emails each of them a masked job offer with an Accept link.
//
// Environment variables required:
//   SUPABASE_URL              - auto-injected
//   SUPABASE_SERVICE_ROLE_KEY - auto-injected
//   SUPABASE_ANON_KEY         - auto-injected (used for the internal send-email call)
//
// Deploy:
//   supabase functions deploy submit-quote-claim --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { ZIP3_CENTROIDS } from './zip3Centroids.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SERVICE_RADIUS_MILES = 50
const MYSTERY_BROADCAST_CAP = 25
const COMMISSION_RATE = 0.10

interface ResponseQA {
  question: string
  answer: string
}

interface ClaimRequest {
  selectionType: 'specific_painter' | 'guaranteed'
  selectedPainterId?: string
  guaranteedPrice: number
  quoteZip: string
  customer: {
    name: string
    email: string
    phone: string
    streetAddress: string
    city: string
    state: string
  }
  timeline: string
  timelineLabel: string
  qa: ResponseQA[]
}

function coordsForZip(zip: string): [number, number] | null {
  if (!/^\d{5}$/.test(zip)) return null
  return ZIP3_CENTROIDS[zip.slice(0, 3)] ?? null
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

function zipDistanceMiles(zipA: string, zipB: string): number | null {
  const a = coordsForZip(zipA)
  const b = coordsForZip(zipB)
  if (!a || !b) return null
  return haversineMiles(a, b)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const body = await req.json() as ClaimRequest
    const { selectionType, selectedPainterId, guaranteedPrice, quoteZip, customer, timeline, timelineLabel, qa } = body

    if (!selectionType || !guaranteedPrice || !customer?.name || !customer?.email || !customer?.phone || !customer?.streetAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (selectionType === 'specific_painter' && !selectedPainterId) {
      return new Response(
        JSON.stringify({ error: 'selectedPainterId is required for selectionType "specific_painter"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // --------------------------------------------------------------------
    // Determine which painter(s) to notify
    // --------------------------------------------------------------------
    type PainterRow = { id: string; email: string; company_name: string; owner_name: string; phone: string; zip_code: string }

    let notifiedPainters: PainterRow[] = []

    if (selectionType === 'specific_painter') {
      const { data: painter, error: painterError } = await supabase
        .from('painters')
        .select('id, email, company_name, owner_name, phone, zip_code')
        .eq('id', selectedPainterId)
        .eq('verified', true)
        .eq('status', 'approved')
        .maybeSingle()

      if (painterError || !painter) {
        return new Response(
          JSON.stringify({ error: 'Selected painter is not available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      notifiedPainters = [painter]
    } else {
      const { data: painters, error: paintersError } = await supabase
        .from('painters')
        .select('id, email, company_name, owner_name, phone, zip_code')
        .eq('verified', true)
        .eq('status', 'approved')

      if (paintersError) throw paintersError

      notifiedPainters = (painters ?? [])
        .map((p) => ({ ...p, distance: quoteZip ? zipDistanceMiles(quoteZip, p.zip_code) : null }))
        .filter((p) => p.distance !== null && p.distance <= SERVICE_RADIUS_MILES)
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
        .slice(0, MYSTERY_BROADCAST_CAP)
    }

    if (notifiedPainters.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No eligible painters found in your area yet. We’ll reach out as soon as one joins.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // --------------------------------------------------------------------
    // Create the job record
    // --------------------------------------------------------------------
    const painterPayoutAmount = Math.round(guaranteedPrice * (1 - COMMISSION_RATE) * 100) / 100
    const depositAmount = Math.round(guaranteedPrice * 0.10 * 100) / 100

    const { data: inserted, error: insertError } = await supabase
      .from('quote_selections')
      .insert({
        quote_zip: quoteZip,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_street_address: customer.streetAddress,
        customer_city: customer.city,
        customer_state: customer.state,
        selection_type: selectionType,
        guaranteed_price: guaranteedPrice,
        selected_painter_id: selectionType === 'specific_painter' ? selectedPainterId : null,
        selected_painter_price: guaranteedPrice,
        project_summary: { qa, timeline, timelineLabel },
        notified_painters: notifiedPainters.map((p) => p.id),
        status: 'offer_sent',
        offer_sent_at: new Date().toISOString(),
        commission_rate: COMMISSION_RATE,
        painter_payout_amount: painterPayoutAmount,
        deposit_amount: depositAmount,
      })
      .select('id, claim_token')
      .single()

    if (insertError || !inserted) throw insertError ?? new Error('Failed to create job record')

    // --------------------------------------------------------------------
    // Email each notified painter the masked job offer
    // --------------------------------------------------------------------
    const customerFirstName = customer.name.trim().split(/\s+/)[0] || 'A customer'

    const emailResults = await Promise.allSettled(
      notifiedPainters.map((painter) => {
        const acceptUrl = `${supabaseUrl}/functions/v1/claim-job?token=${inserted.claim_token}&painter_id=${painter.id}`
        return fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: painter.email,
            type: 'job_offer_available',
            data: {
              customerFirstName,
              zipCode: quoteZip,
              timelineLabel,
              payoutAmount: painterPayoutAmount,
              acceptUrl,
              qa,
            },
          }),
        })
      }),
    )

    const notifiedCount = emailResults.filter((r) => r.status === 'fulfilled').length

    return new Response(
      JSON.stringify({ success: true, quoteSelectionId: inserted.id, notifiedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error submitting quote claim:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
