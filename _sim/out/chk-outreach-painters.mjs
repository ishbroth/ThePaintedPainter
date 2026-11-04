// supabase/functions/outreach-painters/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { describeTiming } from "../_shared/offers.ts";
import { ADMIN_EMAIL } from "../_shared/adminLink.ts";
var MAX_INVITES_PER_JOB = 12;
var MAX_INVITES_PER_DAY = 60;
var PAGE_TIMEOUT_MS = 6e3;
var MAX_PAGE_BYTES = 3e5;
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function findPaintingCompanies(zip, apiKey) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.businessStatus"
    },
    body: JSON.stringify({ textQuery: `house painting contractor near ${zip}`, maxResultCount: 20, regionCode: "US" })
  });
  if (!res.ok) {
    console.error("Places search failed:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return (data.places ?? []).filter((p) => p.websiteUri && (!p.businessStatus || p.businessStatus === "OPERATIONAL")).map((p) => ({ name: p.displayName?.text ?? "", website: p.websiteUri, phone: p.nationalPhoneNumber ?? "", address: p.formattedAddress ?? "" })).filter((p) => p.name);
}
async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ThePaintedPainterBot/1.0 (+https://thepaintedpainter.com; business contact lookup)", "Accept": "text/html" }
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return "";
    const text = await res.text();
    return text.slice(0, MAX_PAGE_BYTES);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
var EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
var JUNK_LOCAL = /^(?:noreply|no-reply|donotreply|do-not-reply|webmaster|postmaster|abuse|privacy|legal|support@wix|sentry|bounce|mailer-daemon|example)/i;
var JUNK_DOMAIN = /(?:example\.|sentry\.|wixpress\.|wix\.com|squarespace\.|godaddy\.|domain\.com|yourdomain|email\.com$|\.png$|\.jpe?g$|\.gif$|\.webp$|\.svg$)/i;
var GOOD_LOCAL = /^(?:info|contact|office|hello|estimates?|sales|service|quotes?|admin|painting|jobs)/i;
function bestEmail(html, siteHost) {
  const found = /* @__PURE__ */ new Set();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of html.matchAll(EMAIL_RE)) found.add(m[0].toLowerCase());
  const root = siteHost.replace(/^www\./, "");
  const candidates = [...found].filter((e) => {
    const [local, domain] = e.split("@");
    return local && domain && !JUNK_LOCAL.test(local) && !JUNK_DOMAIN.test(e) && e.length < 80;
  });
  if (candidates.length === 0) return null;
  const score = (e) => {
    const [local, domain] = e.split("@");
    return (domain === root || domain.endsWith(`.${root}`) ? 10 : 0) + (GOOD_LOCAL.test(local) ? 3 : 0);
  };
  candidates.sort((a, b) => score(b) - score(a));
  const top = candidates[0];
  const topDomain = top.split("@")[1];
  const ownDomain = topDomain === root || topDomain.endsWith(`.${root}`);
  const mailProvider = /^(?:gmail|yahoo|outlook|hotmail|aol|icloud|msn|live|comcast|att|sbcglobal|cox|verizon)\./.test(topDomain);
  return ownDomain || mailProvider ? top : null;
}
async function findEmail(website) {
  let base;
  try {
    base = new URL(website);
  } catch {
    return null;
  }
  const paths = ["/", "/contact", "/contact-us", "/contact.html", "/about"];
  for (const p of paths) {
    const html = await fetchPage(new URL(p, base).toString());
    if (!html) continue;
    const email = bestEmail(html, base.hostname);
    if (email) return email;
  }
  return null;
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Not configured" }, 500);
    if ((req.headers.get("Authorization") ?? "") !== `Bearer ${serviceRoleKey}`) return json({ error: "Forbidden" }, 403);
    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const postalAddress = Deno.env.get("OUTREACH_POSTAL_ADDRESS");
    if (!placesKey) return json({ ok: false, reason: "GOOGLE_PLACES_API_KEY is not set: no painters were looked up" });
    if (!postalAddress) return json({ ok: false, reason: "OUTREACH_POSTAL_ADDRESS is not set: commercial email must carry a postal address, so nothing was sent" });
    const { jobId } = await req.json();
    if (!jobId) return json({ error: "Missing jobId" }, 400);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "https://thepaintedpainter.com";
    const { data: job } = await supabase.from("quote_selections").select("id, status, quote_zip, painter_payout_amount, customer_preferred_date, customer_start_date, customer_end_date, dates_flexible, timeline, project_summary").eq("id", jobId).maybeSingle();
    if (!job || job.status !== "searching_painter" || !job.quote_zip) return json({ ok: false, reason: "Job is not waiting for a painter" });
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const { count: sentToday } = await supabase.from("outreach_leads").select("id", { count: "exact", head: true }).gte("invited_at", dayAgo);
    let budget = Math.min(MAX_INVITES_PER_JOB, MAX_INVITES_PER_DAY - (sentToday ?? 0));
    if (budget <= 0) return json({ ok: false, reason: "Daily invitation limit reached" });
    const places = await findPaintingCompanies(job.quote_zip, placesKey);
    const { data: members } = await supabase.from("painters").select("email");
    const memberEmails = new Set((members ?? []).map((m) => String(m.email).toLowerCase()));
    const { data: optouts } = await supabase.from("outreach_optouts").select("email");
    const optedOut = new Set((optouts ?? []).map((o) => String(o.email).toLowerCase()));
    const summary = job.project_summary ?? {};
    const invited = [];
    for (const place of places) {
      if (budget <= 0) break;
      const email = await findEmail(place.website);
      if (!email || memberEmails.has(email) || optedOut.has(email)) continue;
      const { data: lead, error: leadError } = await supabase.from("outreach_leads").insert({ job_id: job.id, company_name: place.name, email, website: place.website, phone: place.phone, zip: job.quote_zip }).select("invite_token").single();
      if (leadError || !lead) continue;
      const inviteUrl = `${frontendUrl}/painter-signup?invite=${lead.invite_token}&email=${encodeURIComponent(email)}&company=${encodeURIComponent(place.name)}`;
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/outreach-unsubscribe?token=${lead.invite_token}`;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          type: "cold_job_invite",
          data: {
            subject: `A free painting job near ${job.quote_zip}: $${Math.round(Number(job.painter_payout_amount) || 0).toLocaleString("en-US")} payout, yours to claim`,
            companyName: place.name,
            zipCode: job.quote_zip,
            payoutAmount: job.painter_payout_amount,
            timelineLabel: summary.timelineLabel,
            datesText: describeTiming(job),
            qa: summary.qa ?? [],
            breakdown: summary.breakdown ?? [],
            inviteUrl,
            unsubscribeUrl,
            postalAddress
          }
        })
      }).catch(() => null);
      if (res && res.ok) {
        invited.push(place.name);
        budget--;
      } else {
        await supabase.from("outreach_leads").delete().eq("invite_token", lead.invite_token);
      }
    }
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: ADMIN_EMAIL(),
        type: "new_notification",
        data: {
          title: `Invited ${invited.length} local painting compan${invited.length === 1 ? "y" : "ies"} for the ${job.quote_zip} job`,
          body: invited.length > 0 ? `Invited: ${invited.join(", ")}.` : "No company with a findable business email was found near that ZIP.",
          link: frontendUrl
        }
      })
    }).catch(() => null);
    return json({ ok: true, found: places.length, invited: invited.length });
  } catch (error) {
    console.error("outreach-painters failed:", error);
    return json({ error: "failed" }, 500);
  }
});
