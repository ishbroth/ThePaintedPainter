// supabase/functions/delete-account/index.ts
//
// Supabase Edge Function: a signed-in user deletes their own account
//
// POST { password }   (re-entering the password proves it's really them)
//
// Refuses while the user has a job in progress (painter accepted / deposit
// paid, not yet completed) — those involve another person and money. Otherwise:
//   - customers: any open (unaccepted) offers are cancelled so no painter can
//     claim them afterwards; past job records stay (they belong to a paid
//     transaction) but are detached from the account.
//   - painters: the company record can't be deleted outright (past jobs point at
//     it), so it is anonymized and closed, portfolio images and uploaded
//     documents are removed, and they stop appearing in results.
// Then the auth user is deleted (profile, notifications, push subscriptions and
// loyalty history cascade).
//
// Deployed WITH JWT verification on.
//
// Deploy:
//   supabase functions deploy delete-account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server is not configured' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: userData, error: userError } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)
    const user = userData.user

    const { password } = await req.json() as { password?: string }
    if (!password || !user.email) return json({ error: 'Enter your password to delete your account.' }, 400)
    const verifier = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error: pwError } = await verifier.auth.signInWithPassword({ email: user.email, password })
    if (pwError) return json({ error: 'That password isn\'t correct.' }, 403)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: painter } = await supabase.from('painters').select('id').eq('user_id', user.id).maybeSingle()

    // Block while a job is in progress.
    const activeStatuses = ['painter_accepted', 'confirmed']
    if (painter) {
      const { count } = await supabase.from('quote_selections').select('id', { count: 'exact', head: true })
        .eq('accepted_by', painter.id).in('status', activeStatuses)
      if ((count ?? 0) > 0) return json({ error: 'You have jobs in progress. Finish or hand them off before deleting your account.' }, 409)
    }
    const { count: customerActive } = await supabase.from('quote_selections').select('id', { count: 'exact', head: true })
      .or(`customer_id.eq.${user.id},customer_email.eq.${user.email}`).in('status', activeStatuses)
    if ((customerActive ?? 0) > 0) return json({ error: 'You have projects in progress. Wait until they\'re completed before deleting your account.' }, 409)

    // Customer side: cancel open, unaccepted offers.
    await supabase.from('quote_selections').update({ status: 'cancelled' })
      .or(`customer_id.eq.${user.id},customer_email.eq.${user.email}`).eq('status', 'offer_sent')

    // Painter side: anonymize + close the company record, remove their files.
    if (painter) {
      await supabase.from('painter_portfolio').delete().eq('painter_id', painter.id)
      for (const bucket of ['painter-portfolio', 'painter-documents']) {
        const { data: files } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 })
        if (files && files.length > 0) await supabase.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`))
      }
      const { error: anonError } = await supabase.from('painters').update({
        company_name: 'Former painter',
        owner_name: '',
        email: `deleted-${painter.id}@invalid.example`,
        phone: '',
        street_address: '',
        city: '',
        state: '',
        zip_code: '',
        website: null,
        bio: null,
        license_number: null,
        policy_number: null,
        status: 'closed',
        verified: false,
        application_tasks: [],
        admin_message: null,
      }).eq('id', painter.id)
      if (anonError) throw anonError
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return json({ success: true })
  } catch (error) {
    console.error('Error in delete-account:', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
