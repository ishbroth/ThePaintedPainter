// supabase/functions/tts/index.ts
//
// Supabase Edge Function: a natural-sounding voice for phones and tablets.
//
// Desktop browsers (Edge, Chrome) offer cloud "neural" voices that sound realistic. An iPhone's browser only offers the voices built into
// the phone, which sound robotic. This function turns the estimator's words into speech with Google Cloud Text-to-Speech (neural voice)
// so a phone can play the same quality. If it isn't set up (no key), it answers 503 and the site falls back to the phone's own voice.
//
// POST { text: string } -> { audio: <base64 mp3> }   (503 { error: 'no_key' } when not configured)
//
// Setup (once):
//   1. In the Google Cloud project, enable "Cloud Text-to-Speech API" and make an API key allowed to call it.
//   2. supabase secrets set GOOGLE_TTS_API_KEY=<that key>
//      (optional) supabase secrets set TTS_VOICE=en-US-Neural2-D   TTS_RATE=1.0
//   3. supabase functions deploy tts --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_WINDOW_SECONDS = 600
const RATE_LIMIT_MAX_REQUESTS = 120
const MAX_CHARS = 3000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY')
    if (!apiKey) return json({ error: 'no_key' }, 503)

    // A speaking voice costs money per character, so it has its own anti-abuse limit.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceRoleKey) {
      const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const admin = createClient(supabaseUrl, serviceRoleKey)
      const { data: allowed, error } = await admin.rpc('check_chat_rate_limit', {
        p_client_key: `tts:${ip}`,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      })
      if (!error && allowed === false) return json({ error: 'rate_limited' }, 429)
    }

    const { text } = (await req.json()) as { text?: unknown }
    if (typeof text !== 'string' || !text.trim()) return json({ error: 'Missing text' }, 400)
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)

    const voice = Deno.env.get('TTS_VOICE') ?? 'en-US-Neural2-D'
    const rate = Math.min(1.3, Math.max(0.8, parseFloat(Deno.env.get('TTS_RATE') ?? '1.0') || 1.0))

    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { text: clean },
        voice: { languageCode: voice.split('-').slice(0, 2).join('-'), name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: rate, sampleRateHertz: 24000 },
      }),
    })
    if (!res.ok) {
      console.error('Google TTS error:', res.status, await res.text())
      return json({ error: 'upstream' }, 502)
    }
    const data = await res.json()
    if (!data.audioContent) return json({ error: 'no_audio' }, 502)
    return json({ audio: data.audioContent })
  } catch (error) {
    console.error('tts failed:', error)
    return json({ error: 'failed' }, 500)
  }
})
