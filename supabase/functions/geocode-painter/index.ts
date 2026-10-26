// supabase/functions/geocode-painter/index.ts
//
// Supabase Edge Function: puts a painter on the map by looking up the exact position of their ZIP.
//
// Two callers:
//   - A signed-in painter (JWT) after saving their profile: geocodes their own ZIP. Safe to call any time; it only
//     reads the painter's own row and writes coordinates.
//   - The owner / seed script with the service role key and { all: true }: geocodes every painter that has no
//     position yet or whose ZIP changed (used once to place painters who were approved before the map existed).
//
// The map row itself is created by a database trigger when the painter is approved and has coordinates, so nothing
// here decides who is shown; it only fills in latitude/longitude.
//
// POST {} (painter) | POST { all: true } (service role)
//
// Deploy:
//   supabase functions deploy geocode-painter

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { getZipCoords } from '../_shared/geo.ts'

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
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Missing Supabase environment variables')

    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '')
    if (!bearer) return json({ error: 'Missing Authorization header' }, 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const body = await req.json().catch(() => ({})) as { all?: boolean }

    let query = supabase.from('painters').select('id, zip_code, latitude, longitude, geocoded_zip')
    // the platform has already verified the token's signature (JWT verification is on), so its role can be trusted
    let tokenRole = '';
    try { tokenRole = JSON.parse(atob(bearer.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role ?? ''; } catch { /* not a JWT */ }
    if ((bearer === serviceRoleKey || tokenRole === 'service_role') && body.all) {
      // everyone whose position is missing or out of date
      query = query.or('latitude.is.null,geocoded_zip.is.null')
    } else {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: userData, error: userError } = await authClient.auth.getUser(bearer)
      if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)
      query = query.eq('user_id', userData.user.id)
    }

    const { data: painters, error } = await query
    if (error) throw error

    let updated = 0
    const coords = await getZipCoords(supabase, (painters ?? []).map((p: { zip_code: string }) => p.zip_code))
    // ZIPs that Google actually answered (a stand-in position is used if it didn't, and is retried next time)
    const { data: exact } = await supabase.from('zip_geocodes').select('zip').in('zip', (painters ?? []).map((p: { zip_code: string }) => String(p.zip_code ?? '').slice(0, 5)))
    const exactZips = new Set((exact ?? []).map((r: { zip: string }) => r.zip))
    for (const p of (painters ?? []) as { id: string; zip_code: string; geocoded_zip: string | null; latitude: number | null }[]) {
      const zip = String(p.zip_code ?? '').slice(0, 5)
      const at = coords.get(zip)
      if (!at) continue
      if (p.latitude !== null && p.geocoded_zip === zip) continue // already up to date
      const { error: upErr } = await supabase.from('painters').update({ latitude: at[0], longitude: at[1], geocoded_zip: exactZips.has(zip) ? zip : null }).eq('id', p.id)
      if (upErr) console.error('geocode update failed:', upErr)
      else updated++
    }
    return json({ success: true, updated })
  } catch (error) {
    console.error('Error in geocode-painter:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
