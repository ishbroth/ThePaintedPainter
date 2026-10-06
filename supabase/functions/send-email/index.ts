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
  painter_accepted_confirm_deposit: 'A painter accepted your job — confirm & pay deposit',
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
  painter_suspended: 'A painter was paused — needs re-verification',
  painter_suspended_notice: 'New leads are paused while we re-verify you',
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
        <p>Great news! Your painting estimate for <strong>${projectName}</strong> is ready.</p>
        <p>Estimated price: <strong>$${data.estimatedPrice || 'N/A'}</strong></p>
        ${data.estimateUrl ? `${button(data.estimateUrl, `View Your Estimate`)}` : ''}
        <p>This estimate is valid for 30 days. If you have any questions, just reply to this email.</p>
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
          Desired schedule: <strong>${escapeHtml(data.timelineLabel) || 'Not specified'}</strong>
          ${data.customerPreferredDate ? `<br />Requested start date: <strong>${escapeHtml(data.customerPreferredDate)}</strong>` : ''}
        </p>
        <p style="font-size: 22px; font-weight: 700; color: #2563eb; margin: 20px 0;">
          You'd be paid: ${formatMoney(data.payoutAmount)}
        </p>
        ${data.acceptUrl ? `${button(escapeHtml(data.acceptUrl), `Accept this job`, '#16a34a')}` : ''}
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">This job is offered on a first-come, first-served basis — the first painter to accept gets it.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-weight: 600; margin-bottom: 12px;">Job details</p>
        ${qaHtml}
        ${photosHtml}
      `)
    }

    case 'painter_accepted_confirm_deposit':
      return wrap(`
        <p style="margin-top:0;">Good news — <strong>${data.painterCompanyName || 'a painter'}</strong> accepted your job and picked a start date. Confirm it and pay your deposit to lock it in.</p>
        ${detailTable('Your painter', [
          ['Company', data.painterCompanyName], ['Contact', data.painterOwnerName], ['Email', data.painterEmail], ['Phone', data.painterPhone],
        ])}
        ${detailTable('The job', [
          ['Start date', data.scheduledDate],
          ['Guaranteed price', formatMoney(data.guaranteedPrice)],
          ['Deposit due now', formatMoney(data.depositAmount)],
          ['Balance, paid directly to your painter', formatMoney(Number(data.guaranteedPrice) - Number(data.depositAmount))],
        ])}
        ${data.confirmUrl ? button(data.confirmUrl, 'Confirm &amp; pay deposit', '#16a34a', true) : ''}
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Your deposit secures the date. Once it's paid we share your contact details with the painter so you can coordinate directly. Need a different date? Reply to this email.</p>
      `)

    case 'job_confirmed_painter_details':
      return wrap(`
        <p style="margin-top:0;">The deposit has been paid — this job is confirmed! A calendar invite is attached.</p>
        ${detailTable('Customer', [
          ['Name', data.customerName],
          ['Address', [data.customerStreetAddress, data.customerCity, [data.customerState, data.customerZip].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
          ['Email', data.customerEmail], ['Phone', data.customerPhone],
        ])}
        ${detailTable('The job', [
          ['Start date', data.scheduledDate],
          ['Job price', moneyOrEmpty(data.guaranteedPrice)],
          ['Deposit paid to us (our fee)', moneyOrEmpty(data.depositAmount)],
          ['Balance to collect from the customer', formatMoney(data.payoutAmount)],
        ])}
        <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">Reach out to the customer to confirm details. You collect the balance from them directly. Need to move the date? Change it from your dashboard and they're notified.</p>
      `)

    case 'painter_accepted_notice':
      return wrap(`
        <p>Good news — <strong>${data.painterCompanyName || 'a painter'}</strong> accepted your job at ${formatMoney(data.guaranteedPrice)}.</p>
        <p>They're picking a start date now. We'll email you again as soon as it's set, with a link to confirm and pay your deposit.</p>
        ${data.customerPreferredDate ? `<p>Your requested date: <strong>${data.customerPreferredDate}</strong></p>` : ''}
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">You can follow progress anytime under My Projects.</p>
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
          ['Start date', data.scheduledDate],
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
        <p>Previous: <strong>${data.oldDate || 'not set'}</strong><br />New: <strong>${data.newDate || 'N/A'}</strong></p>
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">If this doesn't work for you, reply to the other party directly using the contact details from your confirmation email.</p>
      `)

    case 'painter_application_approved':
      return wrap(`
        <p>Hi ${data.ownerName || 'there'}, your application for <strong>${data.companyName || 'your company'}</strong> has been approved.</p>
        <p>You'll now receive job offers by email and app notification when customers in your area claim a price.</p>
        ${data.profileUrl ? `${button(data.profileUrl, `Open your dashboard`)}` : ''}
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
    const data = type === 'job_offer_available' ? rawData : escapeStrings(rawData)

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

    // ------------------------------------------------------------------------
    // Step 3: Look up the subject line for this email type
    // Falls back to a generic subject if the type is unrecognized.
    // ------------------------------------------------------------------------
    const subject = EMAIL_TYPE_MAP[type]
    if (!subject) {
      console.warn(`Unknown email type: "${type}". Using fallback subject.`)
    }
    const emailSubject = isInternal && type === 'new_review' && rawData?.subject
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
