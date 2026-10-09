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
import { notify } from '../_shared/notify.ts'
import { zipDistanceMiles } from '../_shared/geo.ts'
import { verifyPrice } from '../_shared/priceToken.ts'
import { evaluateAvailability, isIsoDate } from '../_shared/availability.ts'
import { estimateWorkingDays } from '../_shared/duration.ts'
import { describeTiming } from '../_shared/offers.ts'
import { cleanConversation, conversationRejected, conversationNote } from '../_shared/conversationLog.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SERVICE_RADIUS_MILES = 50
const MYSTERY_BROADCAST_CAP = 25
const COMMISSION_RATE = 0.10
const MAX_GUARANTEED_PRICE = 250000

interface ResponseQA {
  question: string
  answer: string
}

interface QuotePhoto {
  url: string
  description: string
  label: string
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
  /** Everything the customer typed in the chat, in order, so painters can read it. */
  conversation?: string[]
  /** Optional — a request, not a commitment. The painter sets the actual scheduled_date when accepting. */
  preferredDate?: string
  /** Set when the customer was logged in at claim time, so My Projects can find this row without relying on email matching. */
  customerId?: string
  /** When a customer splits one estimate into multiple independently-scheduled
   * phases (see the chat estimator's phase detection), each phase is submitted
   * as its own claim sharing a parentQuoteId, with its own phaseLabel. */
  parentQuoteId?: string
  phaseLabel?: string
  /** Photos the customer uploaded during the chat estimate — forwarded to the painter. */
  photos?: QuotePhoto[]
  /** Signed proof the price came from painter-results (painter id, or 'mystery'). Required. */
  priceToken?: string
  /** What the customer said about timing in the chat. */
  timing?: { startDate?: string | null; endDate?: string | null; flexible?: boolean; timeline?: string | null }
  /** Set when this claim is made from a reloaded search after a painter declined; the old request is closed. */
  resumeToken?: string
  /** The estimate + context behind this search, kept so the results can be reloaded if the painter declines. */
  resumeState?: unknown
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
    const {
      selectionType, selectedPainterId, guaranteedPrice, quoteZip, customer, timeline, timelineLabel, qa,
      preferredDate, parentQuoteId, phaseLabel, photos, priceToken, timing, resumeState, resumeToken,
    } = body

    const conversation = cleanConversation(body.conversation)
    if (conversationRejected(conversation)) {
      return new Response(
        JSON.stringify({ error: "Hmm… we can't send this one to painters. Please start over and tell us about your painting project.", code: 'conversation_rejected' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

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

    // The price is computed client-side (the estimate engine only exists in
    // the browser), so the best we can do server-side is reject absurd values.
    if (typeof guaranteedPrice !== 'number' || !isFinite(guaranteedPrice) || guaranteedPrice < 100 || guaranteedPrice > MAX_GUARANTEED_PRICE) {
      return new Response(
        JSON.stringify({ error: 'Invalid price' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // The price must be one painter-results produced, for this painter (or the Mystery baseline) and ZIP,
    // and still within its hold time. Prices can't be edited, swapped between painters, or used late.
    const priceCheck = await verifyPrice(selectionType === 'specific_painter' ? String(selectedPainterId) : 'mystery', guaranteedPrice, String(quoteZip ?? ''), priceToken)
    if (priceCheck === 'expired') {
      return new Response(
        JSON.stringify({ error: 'This price has expired. Please refresh your results to see current prices.', code: 'price_expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (priceCheck !== 'ok') {
      return new Response(
        JSON.stringify({ error: 'We couldn\'t verify that price. Please refresh your results and try again.', code: 'price_invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Link the job to an account only if the caller is actually logged in as
    // that user. Never trust a customerId from the request body: it drives
    // loyalty points, so a spoofed id would credit someone else's account.
    let verifiedCustomerId: string | null = null
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (bearer && bearer !== anonKey) {
      const { data: userData } = await supabase.auth.getUser(bearer)
      verifiedCustomerId = userData?.user?.id ?? null
    }

    // --------------------------------------------------------------------
    // Determine which painter(s) to notify
    // --------------------------------------------------------------------
    const claimTiming = {
      startDate: isIsoDate(timing?.startDate) ? timing!.startDate : null,
      endDate: isIsoDate(timing?.endDate) ? timing!.endDate : null,
      flexible: timing?.flexible === true,
      timeline: typeof timing?.timeline === 'string' ? timing!.timeline : (typeof timeline === 'string' ? timeline : null),
    }
    const durationDays = estimateWorkingDays(guaranteedPrice)
    const resumeJson = resumeState && JSON.stringify(resumeState).length < 200_000 ? resumeState : null

    type PainterRow = { id: string; user_id: string | null; email: string; company_name: string; owner_name: string; phone: string; zip_code: string; leads_paused: boolean | null; paused_until: string | null; blackout_dates: unknown }

    let notifiedPainters: PainterRow[] = []

    if (selectionType === 'specific_painter') {
      const { data: painter, error: painterError } = await supabase
        .from('painters')
        .select('id, user_id, email, company_name, owner_name, phone, zip_code, leads_paused, paused_until, blackout_dates')
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
      if (!evaluateAvailability(painter, claimTiming, durationDays).show) {
        return new Response(
          JSON.stringify({ error: 'That painter isn\'t available for your dates. Please pick another painter or adjust your dates.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      notifiedPainters = [painter]
    } else {
      const { data: painters, error: paintersError } = await supabase
        .from('painters')
        .select('id, user_id, email, company_name, owner_name, phone, zip_code, leads_paused, paused_until, blackout_dates')
        .eq('verified', true)
        .eq('status', 'approved')

      if (paintersError) throw paintersError

      notifiedPainters = (painters ?? [])
        .map((p) => ({ ...p, distance: quoteZip ? zipDistanceMiles(quoteZip, p.zip_code) : null }))
        .filter((p) => p.distance !== null && p.distance <= SERVICE_RADIUS_MILES)
        .filter((p) => evaluateAvailability(p, claimTiming, durationDays).show)
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
        project_summary: { qa, timeline, timelineLabel, conversation },
        photos: photos ?? [],
        notified_painters: notifiedPainters.map((p) => p.id),
        status: 'offer_sent',
        offer_sent_at: new Date().toISOString(),
        commission_rate: COMMISSION_RATE,
        painter_payout_amount: painterPayoutAmount,
        deposit_amount: depositAmount,
        customer_preferred_date: preferredDate || claimTiming.startDate || null,
        customer_start_date: claimTiming.startDate,
        customer_end_date: claimTiming.endDate,
        dates_flexible: claimTiming.flexible,
        timeline: claimTiming.timeline,
        estimated_days: durationDays,
        resume_state: resumeJson,
        customer_id: verifiedCustomerId,
        parent_quote_id: parentQuoteId || null,
        phase_label: phaseLabel || null,
      })
      .select('id, claim_token')
      .single()

    if (insertError || !inserted) throw insertError ?? new Error('Failed to create job record')

    // A claim made from a reloaded search replaces the request the declined painter left open.
    if (resumeToken) {
      await supabase
        .from('quote_selections')
        .update({ status: 'cancelled', fallback_token: null, fallback_expires_at: null, fallback_suggestions: null })
        .eq('fallback_token', resumeToken)
        .eq('status', 'needs_new_painter')
    }

    // --------------------------------------------------------------------
    // Email each notified painter the masked job offer
    // --------------------------------------------------------------------
    const customerFirstName = customer.name.trim().split(/\s+/)[0] || 'A customer'

    const emailResults = await Promise.allSettled(
      notifiedPainters.map(async (painter) => {
        await notify(supabase, {
          userId: painter.user_id, type: 'new_offer', title: 'New job offer in your area',
          body: `Payout ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(painterPayoutAmount)} · ZIP ${quoteZip}`,
          link: '/painter/projects',
        })
        const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
        // The app page (not the function) so merely opening the link in an email scanner can't accept the job.
        const acceptUrl = `${frontendUrl}/painter/accept-job?token=${inserted.claim_token}&painter_id=${painter.id}`
        return fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: painter.email,
            type: 'job_offer_available',
            data: {
              customerFirstName,
              zipCode: quoteZip,
              timelineLabel,
              datesText: describeTiming({ customer_start_date: claimTiming.startDate, customer_end_date: claimTiming.endDate, dates_flexible: claimTiming.flexible, timeline: claimTiming.timeline, customer_preferred_date: preferredDate || null }),
              estimatedDays: durationDays,
              customerPreferredDate: preferredDate || null,
              payoutAmount: painterPayoutAmount,
              acceptUrl,
              qa,
              conversation,
              conversationNote: conversationNote(conversation),
              photos: photos ?? [],
            },
          }),
        })
      }),
    )

    // Confirm to the customer what they requested, the price, and what happens next.
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: customer.email,
        type: 'claim_received',
        data: {
          customerName: customer.name.trim().split(/\s+/)[0],
          guaranteedPrice,
          depositAmount,
          painterName: selectionType === 'specific_painter' ? notifiedPainters[0]?.company_name : null,
          preferredDate: preferredDate || null,
          projectsUrl: verifiedCustomerId ? `${Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'}/customer/dashboard/projects` : null,
        },
      }),
    }).catch((err) => console.error('claim_received email failed:', err))

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
