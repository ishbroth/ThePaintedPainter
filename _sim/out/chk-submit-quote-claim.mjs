// supabase/functions/submit-quote-claim/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { notify } from "../_shared/notify.ts";
import { zipDistanceMiles } from "../_shared/geo.ts";
import { verifyPrice } from "../_shared/priceToken.ts";
import { evaluateAvailability, isIsoDate } from "../_shared/availability.ts";
import { estimateWorkingDays } from "../_shared/duration.ts";
import { describeTiming } from "../_shared/offers.ts";
import { cleanConversation, conversationRejected, conversationNote } from "../_shared/conversationLog.ts";
import { painterBreakdown } from "../_shared/priceBreakdown.ts";
import { ADMIN_EMAIL } from "../_shared/adminLink.ts";
var formatUsd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var SERVICE_RADIUS_MILES = 50;
var MYSTERY_BROADCAST_CAP = 25;
var COMMISSION_RATE = 0.1;
var MAX_GUARANTEED_PRICE = 25e4;
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  try {
    const body = await req.json();
    const {
      selectionType,
      selectedPainterId,
      guaranteedPrice,
      quoteZip,
      customer,
      timeline,
      timelineLabel,
      qa,
      preferredDate,
      parentQuoteId,
      phaseLabel,
      photos,
      priceToken,
      timing,
      resumeState,
      resumeToken
    } = body;
    const conversation = cleanConversation(body.conversation);
    if (conversationRejected(conversation)) {
      return new Response(
        JSON.stringify({ error: "Hmm\u2026 we can't send this one to painters. Please start over and tell us about your painting project.", code: "conversation_rejected" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!selectionType || !guaranteedPrice || !customer?.name || !customer?.email || !customer?.phone || !customer?.streetAddress) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (selectionType === "specific_painter" && !selectedPainterId) {
      return new Response(
        JSON.stringify({ error: 'selectedPainterId is required for selectionType "specific_painter"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment variables");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    if (typeof guaranteedPrice !== "number" || !isFinite(guaranteedPrice) || guaranteedPrice < 100 || guaranteedPrice > MAX_GUARANTEED_PRICE) {
      return new Response(
        JSON.stringify({ error: "Invalid price" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const priceCheck = await verifyPrice(selectionType === "specific_painter" ? String(selectedPainterId) : "mystery", guaranteedPrice, String(quoteZip ?? ""), priceToken);
    if (priceCheck === "expired") {
      return new Response(
        JSON.stringify({ error: "This price has expired. Please refresh your results to see current prices.", code: "price_expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (priceCheck !== "ok") {
      return new Response(
        JSON.stringify({ error: "We couldn't verify that price. Please refresh your results and try again.", code: "price_invalid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let verifiedCustomerId = null;
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (bearer && bearer !== anonKey) {
      const { data: userData } = await supabase.auth.getUser(bearer);
      verifiedCustomerId = userData?.user?.id ?? null;
    }
    const claimTiming = {
      startDate: isIsoDate(timing?.startDate) ? timing.startDate : null,
      endDate: isIsoDate(timing?.endDate) ? timing.endDate : null,
      flexible: timing?.flexible === true,
      timeline: typeof timing?.timeline === "string" ? timing.timeline : typeof timeline === "string" ? timeline : null
    };
    const durationDays = estimateWorkingDays(guaranteedPrice);
    const resumeJson = resumeState && JSON.stringify(resumeState).length < 2e5 ? resumeState : null;
    let notifiedPainters = [];
    if (selectionType === "specific_painter") {
      const { data: painter, error: painterError } = await supabase.from("painters").select("id, user_id, email, company_name, owner_name, phone, zip_code, leads_paused, paused_until, blackout_dates").eq("id", selectedPainterId).eq("verified", true).eq("status", "approved").maybeSingle();
      if (painterError || !painter) {
        return new Response(
          JSON.stringify({ error: "Selected painter is not available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!evaluateAvailability(painter, claimTiming, durationDays).show) {
        return new Response(
          JSON.stringify({ error: "That painter isn't available for your dates. Please pick another painter or adjust your dates." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      notifiedPainters = [painter];
    } else {
      const { data: painters, error: paintersError } = await supabase.from("painters").select("id, user_id, email, company_name, owner_name, phone, zip_code, leads_paused, paused_until, blackout_dates").eq("verified", true).eq("status", "approved");
      if (paintersError) throw paintersError;
      notifiedPainters = (painters ?? []).map((p) => ({ ...p, distance: quoteZip ? zipDistanceMiles(quoteZip, p.zip_code) : null })).filter((p) => p.distance !== null && p.distance <= SERVICE_RADIUS_MILES).filter((p) => evaluateAvailability(p, claimTiming, durationDays).show).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)).slice(0, MYSTERY_BROADCAST_CAP);
    }
    const searching = notifiedPainters.length === 0;
    const painterPayoutAmount = Math.round(guaranteedPrice * (1 - COMMISSION_RATE) * 100) / 100;
    const breakdown = painterBreakdown(body.breakdown, painterPayoutAmount);
    const depositAmount = Math.round(guaranteedPrice * 0.1 * 100) / 100;
    const { data: inserted, error: insertError } = await supabase.from("quote_selections").insert({
      quote_zip: quoteZip,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_street_address: customer.streetAddress,
      customer_city: customer.city,
      customer_state: customer.state,
      selection_type: selectionType,
      guaranteed_price: guaranteedPrice,
      selected_painter_id: selectionType === "specific_painter" ? selectedPainterId : null,
      selected_painter_price: guaranteedPrice,
      project_summary: { qa, timeline, timelineLabel, conversation, breakdown },
      photos: photos ?? [],
      notified_painters: notifiedPainters.map((p) => p.id),
      status: searching ? "searching_painter" : "offer_sent",
      offer_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
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
      phase_label: phaseLabel || null
    }).select("id, claim_token").single();
    if (insertError || !inserted) throw insertError ?? new Error("Failed to create job record");
    if (resumeToken) {
      await supabase.from("quote_selections").update({ status: "cancelled", fallback_token: null, fallback_expires_at: null, fallback_suggestions: null }).eq("fallback_token", resumeToken).eq("status", "needs_new_painter");
    }
    if (searching) {
      const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "https://thepaintedpainter.com";
      const sendMail = (to, type, data) => fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, type, data })
      }).catch((err) => console.error(`${type} email failed:`, err));
      const ownerBreakdown = Array.isArray(body.breakdown) ? body.breakdown.slice(0, 60).filter((l) => l && typeof l.description === "string" && typeof l.amount === "number") : [];
      await Promise.allSettled([
        sendMail(ADMIN_EMAIL(), "no_painter_alert", {
          subject: `No painter in ZIP ${quoteZip}: ${formatUsd(guaranteedPrice)} job needs one`,
          jobId: inserted.id,
          zipCode: quoteZip,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerAddress: [customer.streetAddress, customer.city, customer.state].filter(Boolean).join(", "),
          guaranteedPrice,
          payoutAmount: painterPayoutAmount,
          timelineLabel,
          datesText: describeTiming({ customer_start_date: claimTiming.startDate, customer_end_date: claimTiming.endDate, dates_flexible: claimTiming.flexible, timeline: claimTiming.timeline, customer_preferred_date: preferredDate || null }),
          preferredDate: preferredDate || null,
          qa,
          breakdown: ownerBreakdown,
          conversation,
          photos: photos ?? []
        }),
        sendMail(customer.email, "claim_searching", {
          customerName: customer.name.trim().split(/\s+/)[0],
          guaranteedPrice,
          zipCode: quoteZip,
          preferredDate: preferredDate || null
        }),
        // Invite local painting companies (best effort: this does nothing until the discovery keys are set up)
        fetch(`${supabaseUrl}/functions/v1/outreach-painters`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: inserted.id })
        }).catch((err) => console.error("outreach failed:", err))
      ]);
      return new Response(
        JSON.stringify({ success: true, noPainters: true, quoteSelectionId: inserted.id, notifiedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const customerFirstName = customer.name.trim().split(/\s+/)[0] || "A customer";
    const emailResults = await Promise.allSettled(
      notifiedPainters.map(async (painter) => {
        await notify(supabase, {
          userId: painter.user_id,
          type: "new_offer",
          title: "New job offer in your area",
          body: `Payout ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(painterPayoutAmount)} \xB7 ZIP ${quoteZip}`,
          link: "/painter/projects"
        });
        const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "https://thepaintedpainter.com";
        const acceptUrl = `${frontendUrl}/painter/accept-job?token=${inserted.claim_token}&painter_id=${painter.id}`;
        return fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: painter.email,
            type: "job_offer_available",
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
              breakdown,
              photos: photos ?? []
            }
          })
        });
      })
    );
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: customer.email,
        type: "claim_received",
        data: {
          customerName: customer.name.trim().split(/\s+/)[0],
          guaranteedPrice,
          depositAmount,
          painterName: selectionType === "specific_painter" ? notifiedPainters[0]?.company_name : null,
          preferredDate: preferredDate || null,
          projectsUrl: verifiedCustomerId ? `${Deno.env.get("FRONTEND_URL") ?? "https://thepaintedpainter.com"}/customer/dashboard/projects` : null
        }
      })
    }).catch((err) => console.error("claim_received email failed:", err));
    const notifiedCount = emailResults.filter((r) => r.status === "fulfilled").length;
    return new Response(
      JSON.stringify({ success: true, quoteSelectionId: inserted.id, notifiedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error submitting quote claim:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
