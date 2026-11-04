// supabase/functions/send-reminders/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { notify } from "../_shared/notify.ts";
var DAY = 24 * 60 * 60 * 1e3;
var isoDate = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Forbidden", { status: 403 });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return new Response("Server is not configured", { status: 500 });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "https://thepaintedpainter.com";
  const email = (to, type, data) => to ? fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, type, data })
  }).catch((err) => console.error("reminder email failed:", err)) : Promise.resolve();
  const counts = {};
  const claim = async (jobId, kind) => {
    const { error } = await supabase.from("job_reminders").insert({ job_id: jobId, kind });
    return !error;
  };
  const painterUser = async (painterId) => {
    if (!painterId) return { userId: null, email: null };
    const { data } = await supabase.from("painters").select("user_id, email").eq("id", painterId).maybeSingle();
    return { userId: data?.user_id ?? null, email: data?.email ?? null };
  };
  const where = (j) => [j.customer_street_address, j.customer_city].filter(Boolean).join(", ") || "your project";
  const cols = "id, accepted_by, customer_id, customer_name, customer_email, customer_street_address, customer_city, scheduled_date";
  for (const [kind, offset] of [["week_before", 7], ["day_before", 1]]) {
    const { data: jobs } = await supabase.from("quote_selections").select(cols).eq("status", "confirmed").eq("scheduled_date", isoDate(offset));
    for (const j of jobs ?? []) {
      if (!await claim(j.id, kind)) continue;
      const when = kind === "day_before" ? "tomorrow" : "in one week";
      const painter = await painterUser(j.accepted_by);
      await notify(supabase, {
        userId: j.customer_id,
        type: "project_reminder",
        title: `Your painting project starts ${when}`,
        body: `${where(j)} \xB7 ${j.scheduled_date}`,
        link: "/customer/projects"
      });
      await notify(supabase, {
        userId: painter.userId,
        type: "project_reminder",
        title: `Job starts ${when}`,
        body: `${where(j)} \xB7 ${j.scheduled_date}`,
        link: "/painter/projects"
      });
      if (kind === "day_before") {
        await email(j.customer_email, "project_reminder", {
          customerName: j.customer_name,
          projectName: where(j),
          scheduledDate: j.scheduled_date
        });
        await email(painter.email, "new_notification", {
          title: "A job starts tomorrow",
          body: `${where(j)} \xB7 ${j.scheduled_date}`,
          link: `${frontendUrl}/painter/projects`
        });
      }
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
  }
  {
    const { data: jobs } = await supabase.from("quote_selections").select(cols).eq("status", "painter_accepted").not("scheduled_date", "is", null).lt("date_confirmed_at", new Date(Date.now() - DAY).toISOString());
    for (const j of jobs ?? []) {
      if (!await claim(j.id, "deposit_nudge")) continue;
      await notify(supabase, {
        userId: j.customer_id,
        type: "deposit_reminder",
        title: "Confirm your start date",
        body: `Pay your deposit to lock in ${j.scheduled_date}.`,
        link: "/customer/projects"
      });
      await email(j.customer_email, "new_notification", {
        title: "Your painter is waiting on your deposit",
        body: `Pay your deposit to lock in ${j.scheduled_date}.`,
        link: `${frontendUrl}/customer/projects`
      });
      counts.deposit_nudge = (counts.deposit_nudge ?? 0) + 1;
    }
  }
  {
    const { data: jobs } = await supabase.from("quote_selections").select(`${cols}, painter_availability`).eq("status", "painter_accepted").eq("date_state", "painter_offered");
    for (const j of jobs ?? []) {
      const offeredAt = j.painter_availability?.offeredAt;
      if (!offeredAt || Date.now() - new Date(offeredAt).getTime() < DAY) continue;
      if (!await claim(j.id, "confirm_nudge")) continue;
      await notify(supabase, {
        userId: j.customer_id,
        type: "dates_reminder",
        title: "Confirm your dates",
        body: "Your painter sent their available dates. Confirm and pay your deposit to lock them in.",
        link: "/customer/projects"
      });
      await email(j.customer_email, "new_notification", {
        title: "Your painter is waiting on your dates",
        body: "Pick your dates and pay your deposit to lock the job in.",
        link: `${frontendUrl}/customer/projects`
      });
      counts.confirm_nudge = (counts.confirm_nudge ?? 0) + 1;
    }
  }
  {
    const { data: jobs } = await supabase.from("quote_selections").select("id, customer_id, customer_email").eq("status", "needs_new_painter").lt("fallback_expires_at", (/* @__PURE__ */ new Date()).toISOString());
    for (const j of jobs ?? []) {
      const { error } = await supabase.from("quote_selections").update({ status: "expired", fallback_token: null, fallback_expires_at: null, fallback_suggestions: null }).eq("id", j.id).eq("status", "needs_new_painter");
      if (error) continue;
      await notify(supabase, {
        userId: j.customer_id,
        type: "request_expired",
        title: "Your painter request expired",
        body: "The 72 hours to pick another painter ended. Start a new search any time.",
        link: "/"
      });
      await email(j.customer_email, "new_notification", {
        title: "Your painter request expired",
        body: "The 72 hours to choose another painter have ended. You can start a new search any time.",
        link: frontendUrl
      });
      counts.suggestions_expired = (counts.suggestions_expired ?? 0) + 1;
    }
  }
  {
    const { data: jobs } = await supabase.from("quote_selections").select("id, customer_id, customer_email, customer_name, quote_zip, deposit_status").eq("status", "searching_painter").lt("offer_sent_at", new Date(Date.now() - 2 * DAY).toISOString());
    for (const j of jobs ?? []) {
      const { error } = await supabase.from("quote_selections").update({ status: "expired" }).eq("id", j.id).eq("status", "searching_painter");
      if (error) continue;
      await notify(supabase, {
        userId: j.customer_id,
        type: "request_expired",
        title: "We couldn't find a painter this time",
        body: "No painter in your area took the job within 48 hours. You were not charged.",
        link: "/"
      });
      await email(j.customer_email, "no_painter_closed", {
        customerName: String(j.customer_name ?? "").trim().split(/\s+/)[0] || "there",
        zipCode: j.quote_zip,
        link: frontendUrl
      });
      counts.no_painter_expired = (counts.no_painter_expired ?? 0) + 1;
    }
  }
  {
    const { data: jobs } = await supabase.from("quote_selections").select(`${cols}, claim_token`).eq("status", "painter_accepted").in("date_state", ["awaiting_painter_dates", "customer_countered"]).lt("accepted_at", new Date(Date.now() - DAY).toISOString());
    for (const j of jobs ?? []) {
      if (!await claim(j.id, "date_nudge")) continue;
      const painter = await painterUser(j.accepted_by);
      await notify(supabase, {
        userId: painter.userId,
        type: "date_reminder",
        title: "Choose a start date",
        body: "The customer can't pay their deposit until you set one.",
        link: "/painter/projects"
      });
      await email(painter.email, "new_notification", {
        title: "Choose a start date",
        body: "The customer can't pay their deposit until you set one.",
        link: `${frontendUrl}/painter/projects`
      });
      counts.date_nudge = (counts.date_nudge ?? 0) + 1;
    }
  }
  {
    const { data: jobs } = await supabase.from("quote_selections").select(cols).eq("status", "confirmed").lte("scheduled_date", isoDate(-2));
    for (const j of jobs ?? []) {
      if (!await claim(j.id, "complete_nudge")) continue;
      const painter = await painterUser(j.accepted_by);
      await notify(supabase, {
        userId: painter.userId,
        type: "complete_reminder",
        title: "Finished the job?",
        body: `Mark ${where(j)} completed so the customer can leave a review.`,
        link: "/painter/projects"
      });
      counts.complete_nudge = (counts.complete_nudge ?? 0) + 1;
    }
  }
  return new Response(JSON.stringify({ ok: true, sent: counts }), { headers: { "Content-Type": "application/json" } });
});
