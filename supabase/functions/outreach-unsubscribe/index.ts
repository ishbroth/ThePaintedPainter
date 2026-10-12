// supabase/functions/outreach-unsubscribe/index.ts
//
// The one-click unsubscribe in every invitation sent to a local painting company (outreach-painters).
//   GET  ?token=<invite token>  -> shows a short "you're unsubscribed" page and records the opt-out.
//   POST ?token=<invite token>  -> the same, for mail apps that use the List-Unsubscribe one-click button.
// An address that opts out is never emailed again by outreach-painters.
//
// Deploy:
//   supabase functions deploy outreach-unsubscribe --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

function page(title: string, message: string, status = 200): Response {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;margin:0;padding:40px 20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:36px 30px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{color:#2563eb;font-size:22px;margin:0 0 12px}p{color:#374151;line-height:1.6;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    if (!/^[0-9a-f-]{36}$/i.test(token)) return page('Link not valid', 'This unsubscribe link is not valid. Reply to the email and we will take you off the list.', 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return page('Something went wrong', 'Please try again in a minute.', 500)
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: lead } = await supabase.from('outreach_leads').select('email').eq('invite_token', token).maybeSingle()
    if (!lead?.email) return page('Link not valid', 'This unsubscribe link is not valid. Reply to the email and we will take you off the list.', 404)

    const email = String(lead.email).toLowerCase()
    await supabase.from('outreach_optouts').upsert({ email }, { onConflict: 'email' })
    await supabase.from('outreach_leads').update({ status: 'unsubscribed' }).ilike('email', email).eq('status', 'invited')

    return page('You\'re unsubscribed', `We won't send any more invitations to ${email.replace(/</g, '')}. We're sorry to have bothered you.`)
  } catch (error) {
    console.error('outreach-unsubscribe failed:', error)
    return page('Something went wrong', 'Please try again in a minute.', 500)
  }
})
