// supabase/functions/send-email/index.ts
//
// Supabase Edge Function: Send Transactional Email via Resend
//
// Receives a POST request with recipient, email type, and template data.
// Maps the email type to a subject line and HTML template, then sends the
// email through the Resend API.
//
// Environment variables required:
//   RESEND_API_KEY - Your Resend API key (re_...)
//
// Deploy:
//   supabase functions deploy send-email --no-verify-jwt
//
// Set secret:
//   supabase secrets set RESEND_API_KEY=re_...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ---------------------------------------------------------------------------
// Email Type Mapping
//
// Each email type maps to a subject line used in outgoing emails. The `data`
// object passed in the request body provides dynamic values for the template.
// ---------------------------------------------------------------------------
const EMAIL_TYPE_MAP: Record<string, string> = {
  estimate_ready:    'Your painting estimate is ready',
  painter_assigned:  'A painter has been assigned to your project',
  project_reminder:  'Your painting project is coming up',
  project_completed: 'Your project is complete — leave a review!',
  deposit_receipt:   'Payment received — your painter is secured',
  new_offer:         'New job offer available',
  offer_accepted:    'Your offer was accepted',
  new_review:        'You received a new review',
  payment_received:  'Payment processed',
  deal_expiring:     'Your deal is expiring soon',
  painter_application_received: 'New painter application received',
  job_offer_available: 'New job available in your area',
  painter_offered_dates: 'Your painter sent their available dates — confirm to lock it in',
  customer_counter_dates: 'The customer suggested different dates',
  dates_agreed: 'Dates agreed — pay your deposit to lock it in',
  painter_declined_suggestions: 'Your painter can\'t take the job — here are your next best matches',
  job_confirmed_painter_details: 'Deposit received — job confirmed!',
  painter_accepted_notice: 'A painter accepted your job',
  job_taken: 'That job has been taken',
  job_confirmed_customer: 'Your painting project is confirmed',
  job_rescheduled: 'Your project start date changed',
  painter_application_approved: 'Welcome to The Painted Painter — you’re approved',
  painter_signup_confirm: 'Confirm your email to submit your painter application',
  painter_application_reminder: 'Painter application reminder',
  painter_application_updated: 'A painter finished their requested tasks',
  painter_needs_info: 'More information needed for your painter application',
  painter_rejected: 'Update on your painter application',
  new_notification: 'You have a new notification',
  claim_received: 'We received your request — your price is locked',
  no_painter_alert: 'A job needs a painter',
  cold_job_invite: 'A free painting job near you',
  claim_searching: 'We\'re finding a painter for you',
  no_painter_closed: 'We couldn\'t find a painter this time',
  painter_suspended: 'A painter was paused — needs re-verification',
  painter_suspended_notice: 'New leads are paused while we re-verify you',
  painter_removed: 'Your Painted Painter account has been removed from the network',
  painter_removed_admin: 'A painter was removed from the network',
  painter_bad_review_admin: 'A painter received a low review',
  contract_update: 'Your painter sent a contract update: please review',
  contract_response: 'The customer responded to your contract',
}

// The sender address for all outgoing emails
const FROM_ADDRESS = 'The Painted Painter <noreply@thepaintedpainter.com>'

// Resend API endpoint
const RESEND_API_URL = 'https://api.resend.com/emails'

// CORS headers to allow requests from the frontend app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------------------------------------------------------------------------
// Template Builder
//
// Generates an HTML email body based on the email type and dynamic data.
// In production, you would likely use a more sophisticated template engine
// or pre-built HTML templates stored externally.
// ---------------------------------------------------------------------------
function formatMoney(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!isFinite(n)) return 'N/A'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// Free-text fields (qa answers, photo descriptions) are customer-typed and
// get interpolated straight into an HTML email body — escape them so a
// customer can't inject markup/script into what the painter's mail client renders.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// All styling is inline and layout is table-based: <style> blocks and CSS classes
// are stripped or ignored by many mail apps (Outlook, some Gmail/Android modes),
// which is what made buttons show up as plain links. `href` must already be
// HTML-escaped by the caller.
function button(href: unknown, label: string, color = '#2563eb', full = false): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${full ? 'width="100%"' : ''} style="margin:10px 0;"><tr><td align="center" bgcolor="${color}" style="border-radius:6px;background:${color};"><a href="${href}" target="_blank" style="display:block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;text-align:center;">${label}</a></td></tr></table>`
}

function detailTable(title: string, rows: [string, unknown][]): string {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  if (shown.length === 0) return ''
  const cells = shown
    .map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;border-bottom:1px solid #eef0f3;font-size:14px;color:#6b7280;width:38%;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eef0f3;font-size:14px;color:#1a1a1a;vertical-align:top;">${escapeHtml(v)}</td></tr>`)
    .join('')
  return `<p style="margin:24px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">${escapeHtml(title)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e7eb;">${cells}</table>`
}

// Approve / request more / decline, straight from the email. Each opens the review
// page with that action ready; one confirming click finishes it (so a mail
// scanner opening the link can't approve anyone by itself).
function approvalButtons(reviewUrl: unknown): string {
  const base = String(reviewUrl)
  return button(`${base}&amp;action=approve`, 'Approve this painter', '#16a34a', true)
    + button(`${base}&amp;action=request`, 'Ask for more info / documents', '#2563eb', true)
    + button(`${base}&amp;action=reject`, 'Decline', '#b91c1c', true)
}

function fmtDate(v: unknown): string {
  const s = String(v ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
const dateRange = (a: unknown, b: unknown) => (b && String(b) !== String(a) ? `${fmtDate(a)} – ${fmtDate(b)}` : fmtDate(a))

const yn = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : '')
const listOf = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v)
const moneyOrEmpty = (v: unknown) => (v === null || v === undefined || v === '' ? '' : formatMoney(v))

// Plain-text twin of the HTML, sent as the text/plain part: improves delivery and
// is what shows in notification previews and text-only clients.
function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label.replace(/<[^>]+>/g, '').trim()} (${href.replace(/&amp;/g, '&')})`)
    .replace(/<\/(p|tr|table|h\d|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, '·').replace(/&copy;/g, '©')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function escapeStrings(value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? escapeHtml(v) : v
    }
  }
  return out
}

function buildEmailHtml(type: string, data: Record<string, unknown>): string {
  const customerName = (data.customerName as string) || 'Valued Customer'
  const projectName = (data.projectName as string) || 'your painting project'

  // Base wrapper for consistent branding across all email types
  const wrap = (body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>The Painted Painter</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${FONT};color:#1a1a1a;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td align="center" style="padding:6px 0 18px;font-family:${FONT};font-size:24px;font-weight:700;color:#2563eb;">The Painted Painter</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:28px;font-family:${FONT};font-size:16px;line-height:1.6;color:#1a1a1a;">
${body}
</td></tr>
<tr><td align="center" style="padding:20px 8px;font-family:${FONT};font-size:12px;color:#6b7280;">&copy; ${new Date().getFullYear()} The Painted Painter. Questions? Just reply to this email.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  // Build type-specific content
  switch (type) {
    case 'estimate_ready':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Great news! Your painting price for <strong>${projectName}</strong> is ready.</p>
        <p>Estimated price: <strong>$${data.estimatedPrice || 'N/A'}</strong></p>
        ${data.estimateUrl ? `${button(data.estimateUrl, `View Your Price`)}` : ''}
        <p>This price is valid for 30 days. If you have any questions, just reply to this email.</p>
      `)

    case 'painter_assigned':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>A painter has been assigned to <strong>${projectName}</strong>!</p>
        <p>Your painter: <strong>${data.painterName || 'TBD'}</strong></p>
        ${data.scheduledDate ? `<p>Scheduled date: <strong>${data.scheduledDate}</strong></p>` : ''}
        <p>They will reach out to confirm the details. You can also view your project status in your dashboard.</p>
      `)

    case 'project_reminder':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>This is a friendly reminder that <strong>${projectName}</strong> is coming up${data.scheduledDate ? ` on <strong>${data.scheduledDate}</strong>` : ' soon'}.</p>
        <p>Please make sure the work area is accessible and any furniture or belongings are moved away from the walls.</p>
        <p>If you need to reschedule, please let us know as soon as possible.</p>
      `)

    case 'project_completed':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Your project <strong>${projectName}</strong> has been marked as complete!</p>
        <p>We hope you love the results. Your feedback helps us and our painters improve.</p>
        ${data.reviewUrl ? `${button(data.reviewUrl, `Leave a Review`)}` : ''}
        <p>Thank you for choosing The Painted Painter!</p>
      `)

    case 'deposit_receipt':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>We have received your payment of <strong>$${data.amount || 'N/A'}</strong> for <strong>${projectName}</strong>.</p>
        <p>Your painter is now secured and will be in touch to confirm the schedule.</p>
        ${data.receiptUrl ? `${button(data.receiptUrl, `View Receipt`)}` : ''}
        <p>Thank you for your business!</p>
      `)

    case 'new_offer':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>A new job offer is available in your area!</p>
        <p>Project: <strong>${projectName}</strong></p>
        ${data.estimatedPay ? `<p>Estimated pay: <strong>$${data.estimatedPay}</strong></p>` : ''}
        ${data.offerUrl ? `${button(data.offerUrl, `View Offer Details`)}` : ''}
        <p>Act fast — offers are accepted on a first-come, first-served basis.</p>
      `)

    case 'offer_accepted':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Your offer for <strong>${projectName}</strong> has been accepted by a painter!</p>
        <p>Painter: <strong>${data.painterName || 'TBD'}</strong></p>
        <p>Next steps will be shared shortly. You can track everything in your dashboard.</p>
      `)

    case 'new_review': {
      const rating = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 0)))
      const stars = '<span style="font-size:30px;letter-spacing:3px;color:#f59e0b;">' + '\u2605'.repeat(rating) + '</span><span style="font-size:30px;letter-spacing:3px;color:#d1d5db;">' + '\u2605'.repeat(5 - rating) + '</span>'
      const body = data.body ? String(data.body).replace(/\n/g, '<br />') : ''
      const avg = Number(data.avgRating)
      const count = Number(data.reviewCount)
      return wrap(`
        <p style="margin:0 0 4px;font-size:18px;"><strong>${data.reviewerName || 'A customer'}</strong> reviewed your work${data.projectLocation ? ` at <strong>${data.projectLocation}</strong>` : ''}.</p>
        <p style="margin:14px 0 4px;">${stars}</p>
        <p style="margin:0 0 14px;color:#6b7280;font-size:14px;">${rating} out of 5</p>
        ${data.title ? `<p style="margin:0 0 8px;font-size:17px;font-weight:700;">${data.title}</p>` : ''}
        ${body ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f9fafb;border-left:4px solid #f59e0b;border-radius:4px;padding:14px 16px;font-size:15px;color:#374151;">${body}</td></tr></table>` : '<p style="color:#6b7280;font-size:14px;margin:0;">They left a rating without a written comment.</p>'}
        ${detailTable('Your rating', [
          ['Average', isFinite(avg) && avg > 0 ? `${avg.toFixed(1)} out of 5` : ''],
          ['Total reviews', isFinite(count) && count > 0 ? String(count) : ''],
          ['Job completed', data.completedDate],
        ])}
        ${data.reviewsUrl ? button(data.reviewsUrl, 'See all your reviews') : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Your average rating is shown to customers when they compare painters.${rating <= 3 ? " If anything about this review looks wrong, reply to this email and we'll take a look." : ''}</p>
      `)
    }

    case 'payment_received':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>A payment of <strong>$${data.amount || 'N/A'}</strong> has been processed for <strong>${projectName}</strong>.</p>
        ${data.receiptUrl ? `${button(data.receiptUrl, `View Receipt`)}` : ''}
        <p>Thank you!</p>
      `)

    case 'deal_expiring':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Your deal for <strong>${projectName}</strong> is expiring soon${data.expiresAt ? ` on <strong>${data.expiresAt}</strong>` : ''}.</p>
        <p>Don't miss out — lock in your price before it expires.</p>
        ${data.dealUrl ? `${button(data.dealUrl, `Secure Your Deal`)}` : ''}
      `)

    case 'painter_application_received': {
      const a = (data.application ?? {}) as Record<string, unknown>
      const address = [a.street_address, [a.city, a.state].filter(Boolean).join(', '), a.zip_code].filter(Boolean).join(' · ')
      return wrap(`
        <p style="margin:0 0 4px;font-size:20px;"><strong>${escapeHtml(a.company_name) || 'A painter'}</strong> applied to join the network</p>
        <p style="margin:0 0 6px;color:#6b7280;font-size:14px;">Review below, then decide right from this email.</p>
        ${data.previouslyRemoved ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0;"><tr><td style="background:#fef2f2;border:1px solid #b91c1c;border-radius:6px;padding:12px 14px;font-size:15px;color:#7f1d1d;"><strong>Previously removed from the network.</strong> ${data.previouslyRemoved}</td></tr></table>` : ''}
        ${data.reviewUrl ? approvalButtons(data.reviewUrl) : ''}
        ${detailTable('Company', [
          ['Company', a.company_name], ['Owner', a.owner_name], ['Email', a.email], ['Phone', a.phone],
          ['Address', address], ['Website', a.website],
          ['Years in business', a.years_in_business], ['Crew size', a.crew_size],
        ])}
        ${detailTable('Reviews elsewhere (as reported by the painter)', (['google', 'yelp', 'facebook'] as const).map((src): [string, string] => {
          const e = ((a.external_reviews ?? {}) as Record<string, { url?: string; rating?: number | null; count?: number | null }>)[src]
          if (!e?.url) return [src[0].toUpperCase() + src.slice(1), '']
          const stats = [e.rating != null ? `${e.rating} stars` : '', e.count != null ? `${e.count} reviews` : ''].filter(Boolean).join(', ')
          return [src[0].toUpperCase() + src.slice(1), `${e.url}${stats ? ` — ${stats}` : ''}`]
        }))}
        ${detailTable('Licensing & insurance', [
          ['Licensed', yn(a.has_license)], ['License #', a.license_number], ['License state', a.license_state], ['License expires', a.license_expiration],
          ['Insured', yn(a.is_insured)], ['Insurance company', a.insurance_company], ['Policy #', a.policy_number], ['Coverage', a.coverage_amount],
          ['Bonded', yn(a.is_bonded)], ['Bonding company', a.bonding_company], ['Bond amount', a.bond_amount],
          ["Workers' comp", yn(a.has_workers_comp)], ['Carrier', a.workers_comp_carrier],
          ['Certifications', [listOf(a.certifications), a.other_certification].filter((x) => x && String(x).length).join(', ')],
        ])}
        ${detailTable('Services & coverage', [
          ['Services', listOf(a.service_types)], ['Service-area ZIPs', a.service_area_zips],
          ['Largest project', ({ small: 'Small (1-2 rooms)', medium: 'Medium (whole house interior)', large: 'Large (full interior + exterior)', commercial: 'Commercial' } as Record<string, string>)[String(a.max_project_size)] ?? a.max_project_size], ['Projects per month', a.projects_per_month],
          ['Free estimates', yn(a.offers_estimates)], ['Warranty', a.offers_warranty ? (a.warranty_length || 'Yes') : yn(a.offers_warranty)],
        ])}
        ${detailTable('Pricing answers', [
          ['1BR rental, full interior + cabinets', moneyOrEmpty(a.price_1br_full)],
          ['3BR home, walls only', moneyOrEmpty(a.price_3br_walls)],
          ['3BR home, trim & doors only', moneyOrEmpty(a.price_3br_trim_doors)],
          ['3BR home, ceilings only', moneyOrEmpty(a.price_3br_ceilings)],
          ['5BR large home, full interior', moneyOrEmpty(a.price_5br_full)],
          ['5BR large home, kitchen cabinets only', moneyOrEmpty(a.price_5br_cabinets)],
        ])}
        <p style="margin:26px 0 4px;font-size:14px;"><strong>Decide:</strong></p>
        ${data.reviewUrl ? approvalButtons(data.reviewUrl) : ''}
        <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">"Ask for more info" lets you tick what you need (license, insurance, bond, company verification…) — it shows as tasks on their profile and they're emailed. Replying to this email writes to the applicant directly.</p>
      `)
    }

    case 'painter_signup_confirm':
      return wrap(`
        <p>Hi ${data.ownerName || 'there'}, thanks for applying to join The Painted Painter with <strong>${data.companyName || 'your company'}</strong>.</p>
        <p>Confirm your email to create your account and send your application to our team for review.</p>
        ${data.confirmUrl ? `${button(data.confirmUrl, `Confirm email &amp; submit application`)}` : ''}
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">This link expires in 14 days. If you don't confirm, no account is created and the information you entered is deleted. Didn't apply? You can ignore this email.</p>
      `)

    case 'painter_application_reminder':
      return wrap(`
        <p style="margin-top:0;"><strong>${data.companyName || 'A painter'}</strong> is still waiting on their application and sent a reminder.</p>
        ${data.reviewUrl ? approvalButtons(data.reviewUrl) : ''}
        <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">Replying to this email writes to the applicant directly.</p>
      `)

    case 'painter_application_updated': {
      const done = ((data.completedTasks as string[]) ?? []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      const open = ((data.openTasks as string[]) ?? []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      const docs = ((data.documents as { name: string; url: string }[]) ?? [])
        .map((d) => `<li><a href="${escapeHtml(d.url)}">${escapeHtml(d.name)}</a></li>`).join('')
      return wrap(`
        <p><strong>${data.companyName || 'A painter'}</strong> says they've completed the tasks you asked for.</p>
        ${done ? `<p>Marked done:</p><ul>${done}</ul>` : ''}
        ${open ? `<p>Still open:</p><ul>${open}</ul>` : ''}
        ${docs ? `<p>Uploaded documents (links expire in 7 days):</p><ul>${docs}</ul>` : ''}
        ${data.reviewUrl ? `${button(data.reviewUrl, `Review this application`)}` : ''}
      `)
    }

    case 'painter_needs_info': {
      const items = ((data.tasks as string[]) ?? []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      return wrap(`
        <p>Hi ${data.ownerName || 'there'}, thanks for applying with <strong>${data.companyName || 'your company'}</strong>. Before we can approve you, we need a few things:</p>
        <ul>${items}</ul>
        ${data.message ? `<p>${data.message}</p>` : ''}
        ${data.profileUrl ? `${button(data.profileUrl, `Complete these on your profile`)}` : ''}
      `)
    }

    case 'painter_rejected':
      return wrap(`
        <p>Hi ${data.ownerName || 'there'}, thank you for your interest in The Painted Painter. After reviewing your application for <strong>${data.companyName || 'your company'}</strong>, we're not able to approve it right now.</p>
        ${data.message ? `<p>${data.message}</p>` : ''}
      `)

    case 'new_notification':
      return wrap(`
        <p><strong>${data.title || 'New notification'}</strong></p>
        ${data.body ? `<p>${data.body}</p>` : ''}
        ${data.link ? `${button(data.link, `Open`)}` : ''}
      `)

    case 'job_offer_available': {
      const qa = Array.isArray(data.qa) ? (data.qa as { question: string; answer: string }[]) : []
      const qaHtml = qa
        .map((item) => `<p style="margin: 4px 0;"><strong>${escapeHtml(item.question)}:</strong> ${escapeHtml(item.answer)}</p>`)
        .join('')

      // what the price covers, line by line, in the painter's own payout amounts
      const breakdown = Array.isArray(data.breakdown) ? (data.breakdown as { description: string; amount: number; removed?: boolean }[]) : []
      const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
      const breakdownHtml = breakdown.length > 0
        ? `
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-weight: 600; margin-bottom: 4px;">What this job includes</p>
          <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Amounts are your payout for each part of the job.${breakdown.some((l) => l.removed) ? ' Struck-through items are ones the customer took off: you are welcome to suggest them when you talk.' : ''}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${breakdown.map((l) => l.removed ? `<tr><td style="padding: 4px 0; color: #9ca3af; text-decoration: line-through;">${escapeHtml(l.description)}</td><td style="padding: 4px 0; text-align: right; color: #9ca3af; text-decoration: line-through;">${money(l.amount)}</td></tr>` : `<tr><td style="padding: 4px 0; color: #374151;">${escapeHtml(l.description)}</td><td style="padding: 4px 0; text-align: right; color: #111827;">${money(l.amount)}</td></tr>`).join('')}
          </table>
        `
        : ''

      // every reply the customer typed, in order, so the painter can judge for themselves
      const conversation = Array.isArray(data.conversation) ? (data.conversation as string[]) : []
      const conversationHtml = conversation.length > 0
        ? `
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-weight: 600; margin-bottom: 4px;">What the customer typed (every reply, in order)</p>
          ${data.conversationNote ? `<p style="margin: 4px 0 8px; font-size: 13px; color: #b45309;">&#9888; ${escapeHtml(data.conversationNote)}</p>` : ''}
          <ol style="margin: 8px 0; padding-left: 20px; font-size: 13px; color: #374151;">
            ${conversation.map((line) => `<li style="margin: 3px 0;">${escapeHtml(line)}</li>`).join('')}
          </ol>
        `
        : ''

      const photos = Array.isArray(data.photos) ? (data.photos as { url: string; description: string; label: string }[]) : []
      const photosHtml = photos.length > 0
        ? `
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-weight: 600; margin-bottom: 12px;">Photos from the customer (${photos.length})</p>
          <div>
            ${photos.map((p) => `
              <div style="margin-bottom: 14px;">
                <a href="${escapeHtml(p.url)}"><img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.label)}" style="max-width: 260px; border-radius: 8px; display: block;" /></a>
                <p style="margin: 6px 0 0; font-size: 13px; color: #4b5563;">${escapeHtml(p.description)}</p>
              </div>
            `).join('')}
          </div>
        `
        : ''

      return wrap(`
        <p>A customer near <strong>${escapeHtml(data.zipCode) || 'your area'}</strong> is looking for a painter.</p>
        <p>
          Customer: <strong>${escapeHtml(data.customerFirstName) || 'A customer'}</strong><br />
          ZIP code: <strong>${escapeHtml(data.zipCode) || 'N/A'}</strong><br />
          Customer's timing: <strong>${escapeHtml(data.datesText ?? data.timelineLabel) || 'Not specified'}</strong><br />
          Pictures Included: <strong>${photos.length > 0 ? `${photos.length} (shown below)` : 'None'}</strong>
          ${data.estimatedDays ? `<br />Estimated time on site: <strong>about ${escapeHtml(data.estimatedDays)} working day${Number(data.estimatedDays) === 1 ? '' : 's'}</strong>` : ''}
        </p>
        <p style="font-size: 22px; font-weight: 700; color: #2563eb; margin: 20px 0;">
          You'd be paid: ${formatMoney(data.payoutAmount)}
        </p>
        ${data.acceptUrl ? `${button(escapeHtml(data.acceptUrl), `View job &amp; respond`, '#16a34a')}` : ''}
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;">When you accept, we prepare a standard contract from everything above (scope, price, schedule) with your company name on it. You can add your own terms or attach your own PDF or Word contract, and the customer accepts it in the same step as confirming their dates.</p>
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">This job is offered on a first-come, first-served basis — the first painter to accept gets it. Not a fit (booked, too far, wrong type of job)? You can decline on the same page and we'll offer the customer other painters.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-weight: 600; margin-bottom: 12px;">Job details</p>
        ${qaHtml}
        ${breakdownHtml}
        ${conversationHtml}
        ${photosHtml}
      `)
    }

    case 'job_confirmed_painter_details':
      return wrap(`
        <p style="margin-top:0;">The deposit has been paid — this job is confirmed! A calendar invite is attached.</p>
        ${detailTable('Customer', [
          ['Name', data.customerName],
          ['Address', [data.customerStreetAddress, data.customerCity, [data.customerState, data.customerZip].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
          ['Email', data.customerEmail], ['Phone', data.customerPhone],
        ])}
        ${detailTable('The job', [
          ['Work happens', dateRange(data.scheduledDate, data.scheduledEndDate)],
          ['Job price', moneyOrEmpty(data.guaranteedPrice)],
          ['Deposit paid to us (our fee)', moneyOrEmpty(data.depositAmount)],
          ['Balance to collect from the customer', formatMoney(data.payoutAmount)],
        ])}
        ${data.dashboardUrl ? button(data.dashboardUrl, 'Open this job in your dashboard') : ''}
        <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">Reach out to the customer to confirm details. You collect the balance from them directly. Need to move the date? Change it from your dashboard and they're notified.</p>
      `)

    case 'painter_accepted_notice':
      return wrap(`
        <p>Good news — <strong>${data.painterCompanyName || 'a painter'}</strong> accepted your job at ${formatMoney(data.guaranteedPrice)}.</p>
        <p>They're picking a start date now. We'll email you again as soon as it's set, with a link to confirm and pay your deposit.</p>
        ${data.customerPreferredDate ? `<p>Your requested date: <strong>${data.customerPreferredDate}</strong></p>` : ''}
        ${data.projectsUrl ? button(data.projectsUrl, 'View my project') : '<p style="margin-top: 8px; font-size: 13px; color: #6b7280;">Create an account with this email to follow your project, get reminders and earn loyalty points.</p>'}
      `)

    case 'job_taken':
      return wrap(`
        <p>Another painter accepted the job in ZIP ${data.zipCode || 'N/A'} before you could. Thanks for the quick look — keep an eye out for the next one.</p>
      `)

    case 'job_confirmed_customer':
      return wrap(`
        <p style="margin-top:0;">Your deposit of <strong>${formatMoney(data.depositAmount)}</strong> was received — your project is confirmed! A calendar invite is attached.</p>
        ${detailTable('Your painter', [
          ['Company', data.painterCompanyName], ['Contact', data.painterOwnerName], ['Email', data.painterEmail], ['Phone', data.painterPhone],
        ])}
        ${detailTable('Your project', [
          ['Work happens', dateRange(data.scheduledDate, data.scheduledEndDate)],
          ['Guaranteed price', formatMoney(data.guaranteedPrice)],
          ['Deposit paid', formatMoney(data.depositAmount)],
          ['Remaining balance, due to your painter', formatMoney(Number(data.guaranteedPrice) - Number(data.depositAmount))],
        ])}
        ${data.projectsUrl ? button(data.projectsUrl, 'View My Projects') : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Your painter has your contact details and will reach out to confirm. You pay the remaining balance directly to them. To change the date, use My Projects or reply here.</p>
      `)

    case 'job_rescheduled':
      return wrap(`
        <p>The start date for the job at ${data.location || 'your project'} changed${data.changedBy ? ` (requested by ${data.changedBy})` : ''}.</p>
        <p>Previous: <strong>${dateRange(data.oldDate, data.oldEndDate) || 'not set'}</strong><br />New: <strong>${dateRange(data.newDate, data.newEndDate) || 'N/A'}</strong></p>
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">If this doesn't work for you, reply to the other party directly using the contact details from your confirmation email.</p>
      `)

    case 'painter_application_approved':
      return wrap(`
        <p>Hi ${data.ownerName || 'there'}, your application for <strong>${data.companyName || 'your company'}</strong> has been approved.</p>
        <p>You'll now receive job offers by email and app notification when customers in your area claim a price.</p>
        ${data.profileUrl ? `${button(data.profileUrl, `Open your dashboard`)}` : ''}
      `)

    case 'cold_job_invite': {
      // To a local painting company that has never heard from us: a free job near them, with no customer name, address or contact details.
      const qa = (Array.isArray(data.qa) ? data.qa : []) as { question: string; answer: string }[]
      const bd = (Array.isArray(data.breakdown) ? data.breakdown : []) as { description: string; amount: number; removed?: boolean }[]
      const bdHtml = bd.length > 0
        ? `<p style="margin:24px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">What the job includes (your payout for each part)</p>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${bd.map((l) => l.removed
             ? `<tr><td style="padding:3px 0;color:#9ca3af;text-decoration:line-through;">${escapeHtml(l.description)}</td><td align="right" style="padding:3px 0;color:#9ca3af;text-decoration:line-through;">${formatMoney(l.amount)}</td></tr>`
             : `<tr><td style="padding:3px 0;color:#374151;">${escapeHtml(l.description)}</td><td align="right" style="padding:3px 0;color:#111827;">${formatMoney(l.amount)}</td></tr>`).join('')}</table>
           ${bd.some((l) => l.removed) ? '<p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Struck-through items are ones the customer took off; you are welcome to suggest them.</p>' : ''}`
        : ''
      const company = escapeHtml(data.companyName || 'there')
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="color-scheme" content="light" /><title>A free painting job near ${escapeHtml(data.zipCode)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${FONT};color:#1a1a1a;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td align="center" style="padding:6px 0 18px;font-family:${FONT};font-size:24px;font-weight:700;color:#2563eb;">The Painted Painter</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:28px;font-family:${FONT};font-size:16px;line-height:1.6;color:#1a1a1a;">
  <p style="margin-top:0;">Hi ${company},</p>
  <p>This is an invitation from The Painted Painter, a marketplace that connects homeowners with local painting companies. A homeowner near <strong>ZIP ${escapeHtml(data.zipCode)}</strong> just asked us for a painter, and we'd like you to have the job. <strong>It's a free lead.</strong></p>
  <p style="margin:18px 0 6px;font-weight:700;">The price you see is the price you make</p>
  <ul style="margin:0 0 0 20px;padding:0;">
    <li>Your payout for this job is <strong>${formatMoney(data.payoutAmount)}</strong>. That's what you can make from it. No lead fee, no bidding, no strings attached.</li>
    <li>You control the contracting and the scheduling. When you accept, we put you in direct contact with the customer and you work out the details together. Suggesting upgrades and add-ons is welcome.</li>
  </ul>
  ${detailTable('The job', [['Where', `Near ZIP ${data.zipCode}`], ['When', data.datesText || data.timelineLabel], ...qa.map((r) => [r.question, r.answer] as [string, unknown])])}
  ${bdHtml}
  <p style="margin:24px 0 6px;font-weight:700;">How to claim it</p>
  <p style="margin:0 0 4px;">Create your free painter profile (a few minutes; we check your license and insurance). As soon as you're approved, this job is offered to you automatically. The first approved painter to accept gets it.</p>
  ${button(data.inviteUrl, 'Claim this job', '#16a34a', true)}
  <p style="margin:24px 0 6px;font-weight:700;">How working with us goes</p>
  <ul style="margin:0 0 0 20px;padding:0;">
    <li>Honor the price you accept. Upselling is fine.</li>
    <li>Be licensed and insured, show up on the dates you agree, and keep the customer posted.</li>
    <li>When the job is done, the customer reports back. Painters whose jobs are reported as satisfactory, at the agreed price, get more jobs sent to them.</li>
  </ul>
</td></tr>
<tr><td align="center" style="padding:20px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:#6b7280;">
  You're receiving this one-time invitation because your company is listed publicly as a painting contractor near ZIP ${escapeHtml(data.zipCode)}. This message is a solicitation from The Painted Painter.<br />
  <a href="${escapeHtml(data.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a> and we won't contact you again.<br />
  ${escapeHtml(data.postalAddress)}
</td></tr>
</table></td></tr></table>
</body></html>`
    }

    case 'no_painter_alert': {
      // To the owner: a customer claimed a price where there is no approved painter yet. Everything needed to find one.
      const qa = (Array.isArray(data.qa) ? data.qa : []) as { question: string; answer: string }[]
      const bd = (Array.isArray(data.breakdown) ? data.breakdown : []) as { description: string; amount: number; removed?: boolean }[]
      const conv = Array.isArray(data.conversation) ? (data.conversation as string[]) : []
      const photoList = (Array.isArray(data.photos) ? data.photos : []) as { url: string; description?: string; label?: string }[]
      const bdHtml = bd.length > 0
        ? `<p style="margin:24px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">What the price covers (customer's amounts)</p>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${bd.map((l) => l.removed
             ? `<tr><td style="padding:3px 0;color:#9ca3af;text-decoration:line-through;">${escapeHtml(l.description)}</td><td align="right" style="padding:3px 0;color:#9ca3af;text-decoration:line-through;">${formatMoney(l.amount)}</td></tr>`
             : `<tr><td style="padding:3px 0;color:#374151;">${escapeHtml(l.description)}</td><td align="right" style="padding:3px 0;color:#111827;">${formatMoney(l.amount)}</td></tr>`).join('')}</table>`
        : ''
      return wrap(`
        <p style="margin-top:0;"><strong>A customer claimed a price in ZIP ${escapeHtml(data.zipCode)}, but no approved painter is within range.</strong></p>
        <p>The job is saved as <em>searching for a painter</em>. If none has taken it within 48 hours, the job closes and the customer is told (any deposit is refunded automatically). Local painting companies are being invited to claim it.</p>
        ${detailTable('Customer', [['Name', data.customerName], ['Email', data.customerEmail], ['Phone', data.customerPhone], ['Address', data.customerAddress]])}
        ${detailTable('Job', [['Customer price', formatMoney(data.guaranteedPrice)], ['Painter payout (after the platform fee)', formatMoney(data.payoutAmount)], ['Timeline', data.timelineLabel], ['Dates', data.datesText], ['Requested start date', data.preferredDate], ['Job id', data.jobId]])}
        ${bdHtml}
        ${detailTable('What the customer told the estimator', qa.map((r) => [r.question, r.answer] as [string, unknown]))}
        ${conv.length > 0 ? `<p style="margin:24px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Everything the customer typed</p><ol style="margin:8px 0;padding-left:20px;font-size:13px;color:#374151;">${conv.map((l) => `<li style="margin:3px 0;">${escapeHtml(l)}</li>`).join('')}</ol>` : ''}
        ${photoList.length > 0 ? `<p style="margin:24px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Photos</p>${photoList.map((p) => `<p style="margin:2px 0;font-size:14px;"><a href="${escapeHtml(p.url)}" style="color:#2563eb;">${escapeHtml(p.description || p.label || 'Photo')}</a></p>`).join('')}` : ''}
      `)
    }

    case 'claim_searching':
      return wrap(`
        <p style="margin-top:0;">Hi ${data.customerName || 'there'}, we've got your request.</p>
        <p>There isn't a painter featured in your area yet, so we're finding one for you now. <strong>We'll find you a painter within the next 48 hours.</strong> We'll email you the moment one accepts your job.</p>
        ${detailTable('Your request', [['Price', formatMoney(data.guaranteedPrice)], ['ZIP code', data.zipCode], ['Requested start date', data.preferredDate]])}
        <p style="margin:24px 0 6px;font-weight:700;">What happens next</p>
        <ol style="margin:0 0 0 20px;padding:0;">
          <li>Nothing is charged now. You only pay a deposit after a painter accepts and you agree on a start date.</li>
          <li>If we can't find a painter within 48 hours, we'll let you know. If you've paid a deposit by then, it is refunded automatically.</li>
        </ol>
        ${data.cancelUrl ? `<p style="margin:22px 0 4px;font-size:13px;color:#6b7280;">Changed your mind? You can cancel this request. You'll lose this guaranteed price.</p>${button(escapeHtml(data.cancelUrl), 'Cancel request', '#dc2626')}` : ''}
      `)

    case 'no_painter_closed':
      return wrap(`
        <p style="margin-top:0;">Hi ${data.customerName || 'there'},</p>
        <p>We weren't able to find a painter for your job in ZIP ${escapeHtml(data.zipCode)} within 48 hours, so we've closed the request. <strong>You haven't been charged, and any deposit you paid has been refunded automatically.</strong></p>
        <p>We're sorry we couldn't make it happen this time. You're welcome to start a new price any time. We're adding painters all the time.</p>
        ${data.link ? button(data.link, 'Start a new price') : ''}
      `)

    case 'claim_received':
      return wrap(`
        <p style="margin-top:0;">Hi ${data.customerName || 'there'}, we've got your request and your price is locked in.</p>
        ${detailTable('Your request', [
          ['Guaranteed price', formatMoney(data.guaranteedPrice)],
          ['Painter', data.painterName || 'First available painter near you'],
          ['Deposit (due after your painter picks a date)', formatMoney(data.depositAmount)],
          ['Balance, paid directly to your painter', formatMoney(Number(data.guaranteedPrice) - Number(data.depositAmount))],
          ['Requested start date', data.preferredDate],
        ])}
        <p style="margin:24px 0 6px;font-weight:700;">What happens next</p>
        <ol style="margin:0 0 0 20px;padding:0;">
          <li>${data.painterName ? 'Your painter has' : 'Painters near you have'} been notified. Nothing is charged yet.</li>
          <li>When a painter accepts and picks a start date, we'll email you to confirm and pay the deposit.</li>
          <li>After the deposit, we share contact details so you can coordinate directly.</li>
        </ol>
        ${data.cancelUrl ? `<p style="margin:22px 0 4px;font-size:13px;color:#6b7280;">Changed your mind? You can cancel this request. You'll lose this guaranteed price.</p>${button(escapeHtml(data.cancelUrl), 'Cancel request', '#dc2626')}` : ''}
        ${data.projectsUrl ? button(data.projectsUrl, 'Track this in My Projects') : '<p style="font-size:13px;color:#6b7280;">Tip: create an account with this email to track your project, get reminders and earn loyalty points.</p>'}
      `)

    case 'painter_suspended': {
      const items = (Array.isArray(data.turnedOff) ? (data.turnedOff as string[]) : []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      return wrap(`
        <p style="margin-top:0;"><strong>${data.companyName || 'A painter'}</strong> turned off a credential, so they've been <strong>paused from new leads</strong> until you re-verify them.</p>
        <p style="margin:0 0 4px;">They turned off:</p>
        <ul style="margin:0 0 8px 20px;padding:0;">${items}</ul>
        ${data.reviewUrl ? button(`${data.reviewUrl}&amp;action=approve`, 'Re-verified — reinstate them', '#16a34a', true) + button(`${data.reviewUrl}&amp;action=request`, 'Ask for proof', '#2563eb', true) : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">They've been told to expect 1\u20133 days and can upload proof from their profile; you'll get another email when they do. Jobs they already accepted aren't affected. Replying to this email writes to the painter directly.</p>
      `)
    }

    case 'contract_update':
      return wrap(`
        <p style="margin-top:0;">Hi ${data.customerFirstName || 'there'},</p>
        <p><strong>${data.painterCompanyName || 'Your painter'}</strong> sent an update to your painting contract. The earlier version stays in force until you accept this one.</p>
        ${data.changeSummary ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f9fafb;border-left:4px solid #2563eb;border-radius:4px;padding:12px 14px;font-size:15px;color:#374151;">${String(data.changeSummary).replace(/\n/g, '<br />')}</td></tr></table>` : ''}
        ${data.reviewUrl ? button(data.reviewUrl, 'Review and respond') : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">You can accept it, or decline it and tell your painter why. Nothing changes until you accept.</p>
      `)

    case 'contract_response': {
      const accepted = data.outcome === 'accepted'
      return wrap(`
        <p style="margin-top:0;"><strong>${data.customerFirstName || 'The customer'}</strong> ${accepted ? 'accepted' : 'declined'} ${data.isUpdate ? 'your contract update' : 'your contract'}.</p>
        ${!accepted && data.note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f9fafb;border-left:4px solid #b91c1c;border-radius:4px;padding:12px 14px;font-size:15px;color:#374151;">${String(data.note).replace(/\n/g, '<br />')}</td></tr></table>` : ''}
        <p>${accepted ? 'It is now in force.' : 'The last accepted version stays in force. You can change the contract and send it again.'}</p>
        ${data.link ? button(data.link, 'Open the contract') : ''}
      `)
    }

    case 'painter_bad_review_admin': {
      const rating = Math.max(1, Math.min(5, Math.round(Number(data.rating) || 0)))
      const left = Math.max(0, Number(data.moreToGo) || 0)
      return wrap(`
        <p style="margin-top:0;"><strong>${data.companyName || 'A painter'}</strong> just received a <strong>${rating}-star</strong> review from ${data.reviewerName || 'a customer'}.</p>
        ${data.title ? `<p style="margin:0 0 6px;font-weight:700;">${data.title}</p>` : ''}
        ${data.body ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#f9fafb;border-left:4px solid #b91c1c;border-radius:4px;padding:12px 14px;font-size:15px;color:#374151;">${String(data.body).replace(/\n/g, '<br />')}</td></tr></table>` : ''}
        <p style="margin:14px 0 4px;">That makes <strong>${data.badCount} low review${Number(data.badCount) === 1 ? '' : 's'} out of ${data.totalCount}</strong>. Painters are removed automatically at 3 or more low reviews once low reviews are 3 out of every 10 or more. ${left > 0 ? `${left === 1 ? 'One more low review' : `${left} more low reviews in a row`} would remove them.` : 'They have been removed from the network automatically.'}</p>
        ${data.manageUrl && left > 0 ? button(`${data.manageUrl}&amp;action=remove`, 'Remove them from the network now', '#b91c1c', true) : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">The painter was told to reach out to the customer and try to resolve it.</p>
      `)
    }

    case 'painter_removed_admin': {
      const jobs = (Array.isArray(data.activeJobs) ? (data.activeJobs as string[]) : []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      return wrap(`
        <p style="margin-top:0;"><strong>${data.companyName || 'A painter'}</strong> was removed from the network (${data.reason === 'bad_reviews' ? 'automatically, after repeated low reviews' : 'by you'}).</p>
        ${data.details ? `<p style="margin:0 0 8px;color:#374151;">${data.details}</p>` : ''}
        ${jobs ? `<p style="margin:12px 0 4px;"><strong>Jobs they still hold, which need your attention:</strong></p><ul style="margin:0 0 8px 20px;padding:0;">${jobs}</ul>` : '<p style="margin:12px 0 0;color:#6b7280;">They had no open jobs.</p>'}
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">They are off the map and out of results and job offers. If they apply again with the same name, address, phone or license number, the application email will say they were removed before.</p>
      `)
    }

    case 'painter_removed':
      return wrap(`
        <p style="margin-top:0;">Hi ${data.ownerName || 'there'},</p>
        <p>${data.companyName || 'Your company'} has been removed from The Painted Painter network${data.reason === 'bad_reviews' ? ' after several low customer reviews' : ''}. You will no longer appear on the map or in customer results, and you won't receive new job offers.</p>
        ${data.message ? `<p>${data.message}</p>` : ''}
        <p>If you think this was a mistake, or you'd like to be considered again, reply to this email.</p>
      `)

    case 'painter_suspended_notice': {
      const items = (Array.isArray(data.turnedOff) ? (data.turnedOff as string[]) : []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
      return wrap(`
        <p style="margin-top:0;">You turned off your:</p>
        <ul style="margin:0 0 12px 20px;padding:0;">${items}</ul>
        <p>Because customers rely on those, <strong>new leads are paused</strong> until we re-verify your account. This usually takes 1\u20133 days. Jobs you've already accepted aren't affected.</p>
        <p>To speed it up, upload proof from your profile and press <strong>Submit for review</strong>. If this was a mistake, tell us by replying to this email.</p>
        ${data.profileUrl ? button(data.profileUrl, 'Open your profile') : ''}
      `)
    }

    case 'painter_offered_dates': {
      const windows = (Array.isArray(data.windows) ? (data.windows as { start: string; end: string }[]) : [])
      const rows: [string, string][] = data.mode === 'flexible'
        ? [['Availability', `Flexible: around ${fmtDate(data.around)}, give or take ${data.flexDays} days`], ['What you do next', 'Pick the exact start date that works for you']]
        : windows.map((w, i): [string, string] => [windows.length > 1 ? `Option ${i + 1}` : 'Available', dateRange(w.start, w.end)])
      return wrap(`
        <p style="margin-top:0;"><strong>${data.painterCompanyName || 'Your painter'}</strong> accepted your job and sent their dates. Confirm yours and pay your deposit to lock it in.</p>
        ${detailTable('Their availability', rows)}
        ${detailTable('The job', [
          ['Guaranteed price', formatMoney(data.guaranteedPrice)],
          ['Estimated time on site', data.estimatedDays ? `about ${data.estimatedDays} working day${Number(data.estimatedDays) === 1 ? '' : 's'}` : ''],
        ])}
        ${data.note ? `<p style="margin:14px 0 0;font-size:14px;"><strong>Note from your painter:</strong> ${data.note}</p>` : ''}
        ${data.confirmUrl ? button(data.confirmUrl, data.mode === 'flexible' ? 'Pick my dates &amp; pay deposit' : 'Confirm dates &amp; pay deposit', '#16a34a', true) : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">None of these dates work? Open the page above and suggest a different timeframe; your painter will accept it or offer other dates. Your painter's contact details are shared once your deposit is paid.</p>
      `)
    }

    case 'customer_counter_dates':
      return wrap(`
        <p style="margin-top:0;"><strong>${data.customerFirstName || 'The customer'}</strong> can't make the dates you offered and suggested a different timeframe.</p>
        ${detailTable('Their suggestion', [['Dates', dateRange(data.start, data.end)], ['Note', data.note]])}
        ${data.reviewUrl ? button(data.reviewUrl, 'Accept or offer other dates', '#2563eb', true) : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Accepting sends them a link to pay the deposit and lock it in.</p>
      `)

    case 'dates_agreed':
      return wrap(`
        <p style="margin-top:0;"><strong>${data.painterCompanyName || 'Your painter'}</strong> accepted your dates. Pay your deposit to lock them in.</p>
        ${detailTable('Agreed dates', [['Work happens', dateRange(data.startDate, data.endDate)]])}
        ${data.confirmUrl ? button(data.confirmUrl, 'Pay deposit &amp; confirm', '#16a34a', true) : ''}
      `)

    case 'painter_declined_suggestions': {
      const list = (Array.isArray(data.suggestions) ? (data.suggestions as Record<string, unknown>[]) : [])
      const expires = data.expiresAt ? new Date(String(data.expiresAt)).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : ''
      const intro = data.mystery
        ? "None of the painters we sent your job to were able to take it."
        : `<strong>${data.declinedName || 'Your painter'}</strong> can't take your job.`
      const cards = list.map((p) => {
        const rating = (p.rating as { average: number | null; count: number } | undefined)
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:12px 0;"><tr><td style="padding:14px 16px;">
          <p style="margin:0;font-size:17px;font-weight:700;">${escapeHtml(p.companyName)}</p>
          <p style="margin:2px 0 6px;font-size:13px;color:#6b7280;">${escapeHtml(p.city)}, ${escapeHtml(p.state)} · about ${escapeHtml(p.distanceMiles)} mi${rating && rating.average != null ? ` · ★ ${escapeHtml(rating.average)} (${escapeHtml(rating.count)} reviews)` : ' · new on The Painted Painter'}</p>
          <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#2563eb;">${formatMoney(p.price)} <span style="font-size:12px;font-weight:400;color:#6b7280;">guaranteed price</span></p>
          ${p.availableFrom ? `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Available from ${fmtDate(p.availableFrom)}</p>` : ''}
          ${button(escapeHtml(p.chooseUrl), `Choose ${escapeHtml(p.companyName)}`, '#16a34a')}
        </td></tr></table>`
      }).join('')
      return wrap(`
        <p style="margin-top:0;">Hi ${data.customerName || 'there'}, ${intro}</p>
        ${list.length > 0 ? `<p style="margin:0 0 4px;">Here are your next best matches. Pick one right from this email and we'll send them your job:</p>${cards}` : '<p>We don\'t have another matching painter available right now, but new painters join often. You can reload your search below.</p>'}
        ${data.resumeUrl ? button(data.resumeUrl, 'See all my matching painters', '#2563eb', true) : ''}
        ${data.cancelUrl ? button(data.cancelUrl, 'No thanks, cancel my request', '#6b7280', true) : ''}
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;">${expires ? `These links and prices expire on <strong>${expires}</strong> (72 hours from now). After that your request closes and you can start a new search any time.` : ''} "See all my matching painters" asks you to sign in to The Painted Painter first, then reloads your search results.</p>
      `)
    }

    default:
      // Fallback for unknown email types — sends a generic notification
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>You have a new notification regarding <strong>${projectName}</strong>.</p>
        <p>Please log in to your dashboard for more details.</p>
      `)
  }
}

serve(async (req: Request) => {
  // --------------------------------------------------------------------------
  // Step 1: Handle CORS preflight requests
  // --------------------------------------------------------------------------
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // ------------------------------------------------------------------------
    // Step 2: Parse and validate the request body
    //
    // Expected shape:
    //   {
    //     to: "customer@example.com",
    //     type: "estimate_ready",
    //     data: { customerName: "Jane", estimatedPrice: 2500, ... }
    //   }
    // ------------------------------------------------------------------------
    const body = await req.json()
    const type = body.type
    let to = body.to
    const rawData = body.data

    // Only our own edge functions (holding the service-role key) may send
    // arbitrary email. The one thing the browser is allowed to trigger — the
    // admin "new painter application" notice at sign-up, when there is no
    // session yet — always goes to the configured admin inbox, never to a
    // caller-supplied address, so this can't be used as an open relay.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const isInternal = !!serviceRoleKey && bearer === serviceRoleKey
    if (!isInternal) {
      const adminInbox = Deno.env.get('APPLICATION_NOTIFICATION_EMAIL')
      if (type !== 'painter_application_received' || !adminInbox) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      to = adminInbox
    }

    // Optional emails respect the recipient's "email notifications" setting.
    // Anything transactional (deposit/confirmation/receipts, approval decisions,
    // sign-up confirmation) is always sent.
    const OPTIONAL_TYPES = ['job_offer_available', 'job_taken', 'project_reminder', 'new_notification', 'painter_accepted_notice', 'new_review']
    if (isInternal && OPTIONAL_TYPES.includes(type) && serviceRoleKey) {
      try {
        const prefRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/email_notifications_enabled`, {
          method: 'POST',
          headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_email: to }),
        })
        if (prefRes.ok && (await prefRes.json()) === false) {
          return new Response(JSON.stringify({ success: true, skipped: 'recipient turned off email notifications' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } catch (prefErr) {
        console.error('preference lookup failed, sending anyway:', prefErr)
      }
    }

    // Everything except job_offer_available (which escapes its own fields) is
    // interpolated raw into HTML, so escape string values up front.
    const data = type === 'job_offer_available' || type === 'no_painter_alert' || type === 'cold_job_invite' ? rawData : escapeStrings(rawData)

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Demonstration painters and their made-up customers use the reserved ".invalid" domain, which can never receive
    // mail. Skip them quietly so testing the flows doesn't generate bounces.
    if (/@[^@]*\.invalid$/i.test(to)) {
      return new Response(JSON.stringify({ success: true, skipped: 'demonstration address' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------------
    // Step 3: Look up the subject line for this email type
    // Falls back to a generic subject if the type is unrecognized.
    // ------------------------------------------------------------------------
    const subject = EMAIL_TYPE_MAP[type]
    if (!subject) {
      console.warn(`Unknown email type: "${type}". Using fallback subject.`)
    }
    const emailSubject = isInternal && (type === 'new_review' || type === 'no_painter_alert' || type === 'cold_job_invite') && rawData?.subject
      ? String(rawData.subject).slice(0, 150)
      : subject || 'Update from The Painted Painter'

    // ------------------------------------------------------------------------
    // Step 4: Build the HTML email body from the type and data
    // ------------------------------------------------------------------------
    const html = buildEmailHtml(type, data || {})

    // Replies go somewhere real (the From address is no-reply). For application
    // emails to the admin, replying writes straight to the applicant.
    const applicantEmail = rawData?.application?.email ?? rawData?.applicantEmail
    const replyTo = ['painter_application_received', 'painter_application_reminder', 'painter_application_updated', 'painter_suspended'].includes(type) && applicantEmail
      ? String(applicantEmail)
      : (Deno.env.get('REPLY_TO_EMAIL') ?? 'iw@thepaintedpainter.com')

    // ------------------------------------------------------------------------
    // Step 5: Retrieve the Resend API key from environment
    // ------------------------------------------------------------------------
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not set in environment')
    }

    // ------------------------------------------------------------------------
    // Step 6: Send the email via the Resend API
    //
    // Resend is a modern email API that handles delivery, bounce tracking,
    // and analytics. We send a simple POST with the email details.
    // See: https://resend.com/docs/api-reference/emails/send-email
    // ------------------------------------------------------------------------
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject: emailSubject,
        html,
        text: htmlToText(html),
        reply_to: replyTo,
        ...(type === 'cold_job_invite' && rawData?.unsubscribeUrl
          ? { headers: { 'List-Unsubscribe': `<${String(rawData.unsubscribeUrl)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
          : {}),
        ...(isInternal && Array.isArray(body.attachments) ? { attachments: body.attachments } : {}),
      }),
    })

    // ------------------------------------------------------------------------
    // Step 7: Handle the Resend API response
    // ------------------------------------------------------------------------
    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData)
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: resendData,
        }),
        {
          status: resendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // ------------------------------------------------------------------------
    // Step 8: Return success response with the Resend email ID
    // The ID can be used to track delivery status via the Resend dashboard.
    // ------------------------------------------------------------------------
    console.log(`Email sent successfully: type=${type}, to=${to}, id=${resendData.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendData.id,
        type,
        to,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    // ------------------------------------------------------------------------
    // Error handling
    // ------------------------------------------------------------------------
    console.error('Error sending email:', error)

    const message = error instanceof Error ? error.message : 'Internal server error'

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
