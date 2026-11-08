// supabase/functions/_shared/jobMessages.ts
var MAX_MESSAGE_LENGTH = 1e3;
var RATE_LIMIT_COUNT = 20;
var RATE_LIMIT_WINDOW_MS = 10 * 60 * 1e3;
var READ_AFTER_COMPLETE_DAYS = 90;
function participantRole(job, caller, painterRowForCaller) {
  if (painterRowForCaller && job.accepted_by && painterRowForCaller.id === job.accepted_by) return "painter";
  if (job.customer_id && job.customer_id === caller.userId) return "customer";
  if (!job.customer_id && caller.confirmedEmail && job.customer_email && job.customer_email.trim().toLowerCase() === caller.confirmedEmail.trim().toLowerCase()) return "customer";
  return null;
}
function canSendMessages(job) {
  return job.status === "confirmed" && !!job.scheduled_date;
}
function canReadMessages(job, now2 = /* @__PURE__ */ new Date()) {
  if (canSendMessages(job)) return true;
  if (job.status === "completed") {
    if (!job.completed_at) return true;
    return now2.getTime() - new Date(job.completed_at).getTime() <= READ_AFTER_COMPLETE_DAYS * 864e5;
  }
  return false;
}
function cleanMessageBody(raw) {
  if (typeof raw !== "string") return { ok: false, error: "Write a message first." };
  const text = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { ok: false, error: "Write a message first." };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` };
  return { ok: true, body: text };
}
function isRateLimited(recentSentAt, now2 = /* @__PURE__ */ new Date()) {
  const since = now2.getTime() - RATE_LIMIT_WINDOW_MS;
  return recentSentAt.filter((t) => new Date(t).getTime() >= since).length >= RATE_LIMIT_COUNT;
}
function snippet(body, max = 110) {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}\u2026`;
}
function threadLink(recipient, jobId) {
  return `/${recipient}/dashboard/projects?messages=${encodeURIComponent(jobId)}`;
}
function firstName(full, fallback) {
  const first = String(full ?? "").trim().split(/\s+/)[0];
  return first || fallback;
}

// scripts/jobMessagingChecks.ts
var failures = 0;
var passed = 0;
function check(name, ok2, detail = "") {
  if (ok2) passed++;
  else {
    failures++;
    console.error(`FAIL: ${name}${detail ? ` (${detail})` : ""}`);
  }
}
var JOB = { id: "job-1", status: "confirmed", scheduled_date: "2026-12-01", customer_id: "cust-1", customer_email: "pat@example.com", accepted_by: "painter-1", completed_at: null };
var CUSTOMER = { userId: "cust-1", confirmedEmail: "pat@example.com" };
var PAINTER_USER = { userId: "user-painter-1", confirmedEmail: "crew@paint.example" };
var STRANGER = { userId: "someone-else", confirmedEmail: "other@example.com" };
check("the painter who accepted the job is the painter", participantRole(JOB, PAINTER_USER, { id: "painter-1" }) === "painter");
check("the customer on the job is the customer", participantRole(JOB, CUSTOMER, null) === "customer");
check("another painter is nobody", participantRole(JOB, PAINTER_USER, { id: "painter-2" }) === null);
check("a stranger is nobody", participantRole(JOB, STRANGER, null) === null);
check("a painter who was only offered the job (not accepted_by) is nobody", participantRole({ ...JOB, accepted_by: null }, PAINTER_USER, { id: "painter-1" }) === null);
var guestJob = { ...JOB, customer_id: null };
check("a guest claim matches the customer by confirmed email", participantRole(guestJob, { userId: "new-account", confirmedEmail: "PAT@example.com " }, null) === "customer");
check("an unconfirmed email proves nothing", participantRole(guestJob, { userId: "new-account", confirmedEmail: null }, null) === null);
check("a different email is nobody", participantRole(guestJob, STRANGER, null) === null);
check("an account job is not claimable by email", participantRole(JOB, { userId: "impostor", confirmedEmail: "pat@example.com" }, null) === null);
check("a confirmed, scheduled job can be messaged", canSendMessages(JOB));
for (const status of ["offer_sent", "searching_painter", "painter_accepted", "needs_new_painter", "cancelled", "expired", "completed"]) {
  check(`no sending while the job is ${status}`, !canSendMessages({ ...JOB, status }));
}
check("no sending without a scheduled date", !canSendMessages({ ...JOB, scheduled_date: null }));
check("a confirmed job can be read", canReadMessages(JOB));
check("a painter_accepted job cannot be read", !canReadMessages({ ...JOB, status: "painter_accepted" }));
var now = /* @__PURE__ */ new Date("2027-01-01T00:00:00Z");
check("a recently completed job stays readable", canReadMessages({ ...JOB, status: "completed", completed_at: "2026-12-20T00:00:00Z" }, now));
check("a long-completed job is no longer readable", !canReadMessages({ ...JOB, status: "completed", completed_at: "2026-01-01T00:00:00Z" }, now));
check("a completed job is never writable", !canSendMessages({ ...JOB, status: "completed" }));
var ok = cleanMessageBody("  Hi there!\r\n\r\n\r\n\r\nSee you Monday.  ");
check("whitespace is trimmed and blank runs collapsed", ok.ok && ok.body === "Hi there!\n\nSee you Monday.", JSON.stringify(ok));
check("control characters are dropped", (() => {
  const r = cleanMessageBody("a\0b\x07c\u202Ed");
  return r.ok && r.body === "abcd";
})());
check("markup is kept as plain text (the pages never render it as HTML)", (() => {
  const r = cleanMessageBody("<img src=x onerror=alert(1)>");
  return r.ok && r.body === "<img src=x onerror=alert(1)>";
})());
check("an empty message is refused", !cleanMessageBody("   \n  ").ok);
check("a non-string is refused", !cleanMessageBody({ body: "x" }).ok && !cleanMessageBody(void 0).ok && !cleanMessageBody(42).ok);
check("exactly the limit is accepted", cleanMessageBody("x".repeat(MAX_MESSAGE_LENGTH)).ok);
check("one over the limit is refused", !cleanMessageBody("x".repeat(MAX_MESSAGE_LENGTH + 1)).ok);
check("emoji and accents survive", (() => {
  const r = cleanMessageBody("Gracias! \u{1F600} caf\xE9");
  return r.ok && r.body === "Gracias! \u{1F600} caf\xE9";
})());
var at = /* @__PURE__ */ new Date("2026-12-01T12:00:00Z");
var justNow = Array.from({ length: RATE_LIMIT_COUNT }, (_, i) => new Date(at.getTime() - i * 1e3).toISOString());
check("the limit is reached at the cap", isRateLimited(justNow, at));
check("one under the cap is fine", !isRateLimited(justNow.slice(1), at));
var old = justNow.map(() => new Date(at.getTime() - RATE_LIMIT_WINDOW_MS - 6e4).toISOString());
check("old messages do not count", !isRateLimited(old, at));
check("the preview is one short line", snippet("Line one\n\nline   two " + "x".repeat(300)).length <= 110 && !snippet("a\nb").includes("\n"));
check("a short message is previewed whole", snippet("See you at 8") === "See you at 8");
check("the painter is sent to the painter projects page with the thread open", threadLink("painter", "abc") === "/painter/dashboard/projects?messages=abc");
check("the customer is sent to the customer projects page with the thread open", threadLink("customer", "abc") === "/customer/dashboard/projects?messages=abc");
check("a job id cannot break out of the link", !threadLink("painter", "a&b=c#x").includes("&b=") && !threadLink("painter", "a&b=c#x").includes("#"));
check("only a first name goes in a title", firstName("Pat  Lee Smith", "Your client") === "Pat" && firstName("", "Your client") === "Your client" && firstName(null, "x") === "x");
console.log(`${passed} checks passed${failures ? `, ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
