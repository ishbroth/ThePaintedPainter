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

function buildEmailHtml(type: string, data: Record<string, unknown>): string {
  const customerName = (data.customerName as string) || 'Valued Customer'
  const projectName = (data.projectName as string) || 'your painting project'

  // Base wrapper for consistent branding across all email types
  const wrap = (body: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 32px; }
        .header h1 { color: #2563eb; font-size: 24px; margin: 0; }
        .content { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px; }
        .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #6b7280; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>The Painted Painter</h1>
        </div>
        <div class="content">
          ${body}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} The Painted Painter. All rights reserved.</p>
          <p>Questions? Reply to this email or visit thepaintedpainter.com</p>
        </div>
      </div>
    </body>
    </html>
  `

  // Build type-specific content
  switch (type) {
    case 'estimate_ready':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Great news! Your painting estimate for <strong>${projectName}</strong> is ready.</p>
        <p>Estimated price: <strong>$${data.estimatedPrice || 'N/A'}</strong></p>
        ${data.estimateUrl ? `<p><a class="btn" href="${data.estimateUrl}">View Your Estimate</a></p>` : ''}
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
        ${data.reviewUrl ? `<p><a class="btn" href="${data.reviewUrl}">Leave a Review</a></p>` : ''}
        <p>Thank you for choosing The Painted Painter!</p>
      `)

    case 'deposit_receipt':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>We have received your payment of <strong>$${data.amount || 'N/A'}</strong> for <strong>${projectName}</strong>.</p>
        <p>Your painter is now secured and will be in touch to confirm the schedule.</p>
        ${data.receiptUrl ? `<p><a class="btn" href="${data.receiptUrl}">View Receipt</a></p>` : ''}
        <p>Thank you for your business!</p>
      `)

    case 'new_offer':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>A new job offer is available in your area!</p>
        <p>Project: <strong>${projectName}</strong></p>
        ${data.estimatedPay ? `<p>Estimated pay: <strong>$${data.estimatedPay}</strong></p>` : ''}
        ${data.offerUrl ? `<p><a class="btn" href="${data.offerUrl}">View Offer Details</a></p>` : ''}
        <p>Act fast — offers are accepted on a first-come, first-served basis.</p>
      `)

    case 'offer_accepted':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Your offer for <strong>${projectName}</strong> has been accepted by a painter!</p>
        <p>Painter: <strong>${data.painterName || 'TBD'}</strong></p>
        <p>Next steps will be shared shortly. You can track everything in your dashboard.</p>
      `)

    case 'new_review':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>You received a new review${data.rating ? ` — <strong>${data.rating}/5 stars</strong>` : ''}!</p>
        ${data.reviewText ? `<blockquote style="border-left: 3px solid #2563eb; padding-left: 12px; margin: 16px 0; color: #4b5563;">"${data.reviewText}"</blockquote>` : ''}
        ${data.reviewerName ? `<p>— ${data.reviewerName}</p>` : ''}
        <p>Keep up the great work!</p>
      `)

    case 'payment_received':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>A payment of <strong>$${data.amount || 'N/A'}</strong> has been processed for <strong>${projectName}</strong>.</p>
        ${data.receiptUrl ? `<p><a class="btn" href="${data.receiptUrl}">View Receipt</a></p>` : ''}
        <p>Thank you!</p>
      `)

    case 'deal_expiring':
      return wrap(`
        <p>Hi ${customerName},</p>
        <p>Your deal for <strong>${projectName}</strong> is expiring soon${data.expiresAt ? ` on <strong>${data.expiresAt}</strong>` : ''}.</p>
        <p>Don't miss out — lock in your price before it expires.</p>
        ${data.dealUrl ? `<p><a class="btn" href="${data.dealUrl}">Secure Your Deal</a></p>` : ''}
      `)

    case 'painter_application_received':
      return wrap(`
        <p>A new painter has applied to join the network.</p>
        <p>
          <strong>${data.companyName || 'Unknown Company'}</strong><br />
          Owner: ${data.ownerName || 'N/A'}<br />
          Email: ${data.applicantEmail || 'N/A'}<br />
          Phone: ${data.phone || 'N/A'}<br />
          Location: ${data.city || 'N/A'}, ${data.state || 'N/A'} ${data.zipCode || ''}
        </p>
        ${data.serviceTypes ? `<p>Services: ${data.serviceTypes}</p>` : ''}
        <p>Years in business: ${data.yearsInBusiness ?? 'N/A'} &middot; Crew size: ${data.crewSize ?? 'N/A'}</p>
        <p>Licensed: ${data.hasLicense ?? 'N/A'} &middot; Insured: ${data.isInsured ?? 'N/A'} &middot; Bonded: ${data.isBonded ?? 'N/A'}</p>
        <p>Log in to the admin dashboard to review and approve this application.</p>
      `)

    case 'job_offer_available': {
      const qa = Array.isArray(data.qa) ? (data.qa as { question: string; answer: string }[]) : []
      const qaHtml = qa
        .map((item) => `<p style="margin: 4px 0;"><strong>${item.question}:</strong> ${item.answer}</p>`)
        .join('')

      return wrap(`
        <p>A customer near <strong>${data.zipCode || 'your area'}</strong> is looking for a painter.</p>
        <p>
          Customer: <strong>${data.customerFirstName || 'A customer'}</strong><br />
          ZIP code: <strong>${data.zipCode || 'N/A'}</strong><br />
          Desired schedule: <strong>${data.timelineLabel || 'Not specified'}</strong>
        </p>
        <p style="font-size: 22px; font-weight: 700; color: #2563eb; margin: 20px 0;">
          You'd be paid: ${formatMoney(data.payoutAmount)}
        </p>
        ${data.acceptUrl ? `<p><a class="btn" href="${data.acceptUrl}">Accept This Job</a></p>` : ''}
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">This job is offered on a first-come, first-served basis — the first painter to accept gets it.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-weight: 600; margin-bottom: 12px;">Job details</p>
        ${qaHtml}
      `)
    }

    case 'painter_accepted_confirm_deposit':
      return wrap(`
        <p>Good news — <strong>${data.painterCompanyName || 'A painter'}</strong> has accepted your job!</p>
        <p>
          Painter: <strong>${data.painterCompanyName || 'N/A'}</strong> (${data.painterOwnerName || 'N/A'})<br />
          Email: <a href="mailto:${data.painterEmail || ''}">${data.painterEmail || 'N/A'}</a><br />
          Phone: <a href="tel:${data.painterPhone || ''}">${data.painterPhone || 'N/A'}</a>
        </p>
        <p>Job price: <strong>${formatMoney(data.guaranteedPrice)}</strong></p>
        <p>Deposit due now: <strong>${formatMoney(data.depositAmount)}</strong></p>
        ${data.confirmUrl ? `<p><a class="btn" href="${data.confirmUrl}">Confirm &amp; Pay Deposit</a></p>` : ''}
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">Once you confirm and pay the deposit, we'll share your contact details with the painter so you can coordinate directly.</p>
      `)

    case 'job_confirmed_painter_details':
      return wrap(`
        <p>The deposit has been paid — this job is confirmed!</p>
        <p>
          Customer: <strong>${data.customerName || 'N/A'}</strong><br />
          Address: ${data.customerStreetAddress || ''}, ${data.customerCity || ''}, ${data.customerState || ''} ${data.customerZip || ''}<br />
          Email: <a href="mailto:${data.customerEmail || ''}">${data.customerEmail || 'N/A'}</a><br />
          Phone: <a href="tel:${data.customerPhone || ''}">${data.customerPhone || 'N/A'}</a>
        </p>
        <p>Your payout: <strong>${formatMoney(data.payoutAmount)}</strong></p>
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">Reach out to the customer directly to schedule the work.</p>
      `)

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
    const { to, type, data } = await req.json()

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
    const emailSubject = subject || 'Update from The Painted Painter'

    // ------------------------------------------------------------------------
    // Step 4: Build the HTML email body from the type and data
    // ------------------------------------------------------------------------
    const html = buildEmailHtml(type, data || {})

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
