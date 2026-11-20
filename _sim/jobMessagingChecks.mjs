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
function jobIsOpen(job) {
  return job.status === "confirmed" && !!job.scheduled_date;
}
function isBlocked(job) {
  return !!job.customer_blocked_messages || !!job.painter_blocked_messages;
}
function blockedByRole(job, role) {
  return role === "customer" ? !!job.customer_blocked_messages : !!job.painter_blocked_messages;
}
function canSendMessages(job) {
  return jobIsOpen(job) && !isBlocked(job);
}
function canReadMessages(job, now2 = /* @__PURE__ */ new Date()) {
  if (jobIsOpen(job)) return true;
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
var REPORT_REASONS = ["harassment", "inappropriate", "spam", "scam", "off_platform", "other"];
var MAX_REPORT_DETAILS = 500;
var REPORT_LIMIT_PER_DAY = 5;
var REPORT_SNAPSHOT_MESSAGES = 15;
function cleanReport(rawReason, rawDetails) {
  if (typeof rawReason !== "string" || !REPORT_REASONS.includes(rawReason)) return { ok: false, error: "Choose what is wrong." };
  let details = null;
  if (rawDetails !== void 0 && rawDetails !== null && rawDetails !== "") {
    if (typeof rawDetails !== "string") return { ok: false, error: "The note could not be read." };
    const t = rawDetails.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (t.length > MAX_REPORT_DETAILS) return { ok: false, error: `Keep the note under ${MAX_REPORT_DETAILS} characters.` };
    details = t || null;
  }
  return { ok: true, reason: rawReason, details };
}
function isReportLimited(recentAt, now2 = /* @__PURE__ */ new Date()) {
  const since = now2.getTime() - 864e5;
  return recentAt.filter((t) => new Date(t).getTime() >= since).length >= REPORT_LIMIT_PER_DAY;
}
function reportSnapshot(messages) {
  return messages.slice(-REPORT_SNAPSHOT_MESSAGES).map((m) => ({ from: m.sender_role, body: m.body, at: m.created_at }));
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
var blockedByCustomer = { ...JOB, customer_blocked_messages: true };
var blockedByPainter = { ...JOB, painter_blocked_messages: true };
check("a job nobody blocked is not blocked (missing flags count as off)", !isBlocked(JOB) && !isBlocked({ ...JOB, customer_blocked_messages: null, painter_blocked_messages: false }));
check("a block by the customer stops sending", isBlocked(blockedByCustomer) && !canSendMessages(blockedByCustomer));
check("a block by the painter stops sending", isBlocked(blockedByPainter) && !canSendMessages(blockedByPainter));
check("a block stops BOTH sides from sending (the sender is the same check)", !canSendMessages(blockedByCustomer) && !canSendMessages(blockedByPainter));
check("a blocked thread can still be read", canReadMessages(blockedByCustomer) && canReadMessages(blockedByPainter));
check("a blocked thread that is completed follows the 90-day read window", canReadMessages({ ...blockedByCustomer, status: "completed", completed_at: "2026-12-20T00:00:00Z" }, now) && !canReadMessages({ ...blockedByCustomer, status: "completed", completed_at: "2026-01-01T00:00:00Z" }, now));
check("a block does not open an unconfirmed job", !canReadMessages({ ...blockedByCustomer, status: "painter_accepted" }));
check("each side only owns its own block", blockedByRole(blockedByCustomer, "customer") && !blockedByRole(blockedByCustomer, "painter") && blockedByRole(blockedByPainter, "painter") && !blockedByRole(blockedByPainter, "customer"));
check("both sides blocking, then one lifting theirs, is still blocked", (() => {
  const both = { ...JOB, customer_blocked_messages: true, painter_blocked_messages: true };
  return isBlocked({ ...both, customer_blocked_messages: false }) && !canSendMessages({ ...both, customer_blocked_messages: false });
})());
check("lifting the only block reopens the job", canSendMessages({ ...blockedByCustomer, customer_blocked_messages: false }));
for (const reason of REPORT_REASONS) check(`reason ${reason} is accepted`, cleanReport(reason, void 0).ok);
check("an unknown reason is refused", !cleanReport("boring", void 0).ok && !cleanReport(void 0, void 0).ok && !cleanReport(5, void 0).ok);
check("a prototype name is not a reason", !cleanReport("constructor", void 0).ok && !cleanReport("__proto__", void 0).ok);
check("the note is optional and empty means none", (() => {
  const r = cleanReport("spam", "   ");
  return r.ok && r.details === null;
})() && (() => {
  const r = cleanReport("spam", null);
  return r.ok && r.details === null;
})());
check("the note is trimmed and cleaned", (() => {
  const r = cleanReport("other", "  rude \0 text\r\n  ");
  return r.ok && r.details === "rude  text";
})());
check("a note at the limit is accepted and one over is refused", cleanReport("other", "x".repeat(MAX_REPORT_DETAILS)).ok && !cleanReport("other", "x".repeat(MAX_REPORT_DETAILS + 1)).ok);
check("a note that is not text is refused", !cleanReport("other", { a: 1 }).ok);
var reportsNow = /* @__PURE__ */ new Date("2026-12-01T12:00:00Z");
var manyReports = Array.from({ length: REPORT_LIMIT_PER_DAY }, (_, i) => new Date(reportsNow.getTime() - i * 6e4).toISOString());
check("the report limit is reached at the cap", isReportLimited(manyReports, reportsNow));
check("one under the report cap is fine", !isReportLimited(manyReports.slice(1), reportsNow));
check("reports from over a day ago do not count", !isReportLimited(manyReports.map(() => new Date(reportsNow.getTime() - 9e7).toISOString()), reportsNow));
var thread = Array.from({ length: 40 }, (_, i) => ({ sender_role: i % 2 ? "painter" : "customer", body: `m${i}`, created_at: `2026-12-01T00:${String(i).padStart(2, "0")}:00Z` }));
var snap = reportSnapshot(thread);
check("the snapshot keeps only the latest messages, oldest first", snap.length === REPORT_SNAPSHOT_MESSAGES && snap[snap.length - 1].body === "m39" && snap[0].body === `m${40 - REPORT_SNAPSHOT_MESSAGES}`);
check("the snapshot of a short thread is the whole thread", reportSnapshot(thread.slice(0, 3)).length === 3 && reportSnapshot([]).length === 0);
console.log(`${passed} checks passed${failures ? `, ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
