// supabase/functions/analyze-quote-photo/index.ts
//
// Supabase Edge Function: vision-based assessment of a customer-uploaded
// quote photo.
//
// Some scope questions genuinely need a look, not just a description —
// "extensive repairs" and "one wire shelf" both get typed as a sentence,
// but they price very differently. This sends the uploaded photo (plus the
// customer's own description, which we treat as accurate context, not
// something to second-guess) to Claude's vision capability and asks for a
// severity/scope read, which the client then folds into the same pricing
// fields a text answer would have set (drywallRepairExtent, closetShelving)
// where a mapping exists. This NEVER computes or returns a price itself —
// same non-authoritative-signal boundary as chat-estimator-extract.
//
// If this function is unreachable, times out, or returns malformed data,
// the photo still gets attached and forwarded to the painter as normal —
// this is a pure enhancement layer, not a hard dependency.
//
// Environment variables required:
//   ANTHROPIC_API_KEY - same key as chat-estimator-extract
//
// Deploy:
//   supabase functions deploy analyze-quote-photo --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Vision calls cost more and take longer than the text-only extraction —
// keep this bucket separate and tighter than chat-estimator-extract's.
const RATE_LIMIT_WINDOW_SECONDS = 600 // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 15

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const REQUEST_TIMEOUT_MS = 15000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB — plenty for a phone photo, caps cost/abuse

const ASSESS_TOOL = {
  name: 'assess_photo',
  description: 'Record a pricing-relevant visual assessment of the uploaded photo.',
  input_schema: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: ['minor', 'moderate', 'extensive'],
        description: 'How much work/scope is visually apparent — e.g. for repair photos: minor (a few nail holes/small cracks), moderate (multiple patches, some drywall work), extensive (large holes, structural-looking damage, water damage spanning a wide area). For shelving: minor (one or two simple shelves), moderate (a standard closet shelf-and-rod system), extensive (a full built-in multi-shelf/drawer system). Only set this if the photo actually shows something assessable this way — omit for photos where a severity scale doesn\'t apply (e.g. a plain photo of a room for general context).',
      },
      matchesDescription: {
        type: 'boolean',
        description: 'Whether the photo is reasonably consistent with the customer\'s own description of it. False if the photo appears to show something substantially different.',
      },
      note: {
        type: 'string',
        description: 'ONE short sentence, plain language, suitable to show the customer directly — e.g. "That looks like a full built-in shelving system, not just a single shelf." Empty string if there is nothing worth flagging beyond the customer\'s own description.',
      },
    },
    required: ['matchesDescription', 'note'],
  },
}

const SYSTEM_PROMPT = `You are assessing a single photo a customer uploaded while getting a house-painting estimate. You do NOT set any price — a separate deterministic pricing engine uses your assessment as one input among several. Call the assess_photo tool with your reading of the image.

Rules:
- Treat the customer's own description of the photo as accurate context for what they intended to show, not something to doubt by default — matchesDescription should only be false if the photo clearly contradicts it.
- Be conservative with "severity" — only set it when the photo shows something on a genuine minor/moderate/extensive scale (repair extent, shelving scope, similar). Leave it unset for photos where that scale doesn't apply.
- Keep "note" to one short, plain-English sentence a homeowner would understand, or empty if there's nothing worth adding.`

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500)

    const clientKey = req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'unknown'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey)
      const rlResult = await Promise.race([
        admin.rpc('check_chat_rate_limit', {
          p_client_key: `photo:${clientKey}`,
          p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
          p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('rate limit check timed out') }), 3000)),
      ])
      const { data: allowed, error: rlError } = rlResult
      if (rlError) {
        console.error('Rate limit check failed:', rlError)
      } else if (allowed === false) {
        return jsonError('Rate limit exceeded, try again shortly', 429)
      }
    }

    const { photoUrl, description, label } = await req.json() as {
      photoUrl?: string; description?: string; label?: string
    }
    if (!photoUrl || typeof photoUrl !== 'string') return jsonError('Missing photoUrl', 400)

    // Only ever fetch from our own Storage bucket — never let this endpoint
    // be used as an arbitrary URL fetcher.
    if (!photoUrl.includes('/storage/v1/object/public/quote-photos/')) {
      return jsonError('photoUrl must be a quote-photos storage URL', 400)
    }

    const imgRes = await fetch(photoUrl)
    if (!imgRes.ok) return jsonError('Could not fetch photo', 502)
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return jsonError('Not an image', 400)
    const buf = await imgRes.arrayBuffer()
    if (buf.byteLength > MAX_IMAGE_BYTES) return jsonError('Photo too large to analyze', 413)
    const base64 = encodeBase64(new Uint8Array(buf))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let anthropicRes: Response
    try {
      anthropicRes = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 512,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: contentType, data: base64 } },
                {
                  type: 'text',
                  text: `The customer said this photo shows: "${label ?? 'unspecified'}".\nTheir description: "${description ?? '(none given)'}"`,
                },
              ],
            },
          ],
          tools: [ASSESS_TOOL],
          tool_choice: { type: 'tool', name: 'assess_photo' },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!anthropicRes.ok) {
      const details = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, details)
      return jsonError('Upstream vision error', 502)
    }

    const anthropicData = await anthropicRes.json()
    const toolUse = anthropicData.content?.find((c: { type: string }) => c.type === 'tool_use')
    if (!toolUse) return jsonError('No assessment returned', 502)

    const input = toolUse.input as { severity?: string; matchesDescription?: boolean; note?: string }
    const severity = ['minor', 'moderate', 'extensive'].includes(input.severity ?? '') ? input.severity : null

    return new Response(
      JSON.stringify({
        severity,
        matchesDescription: input.matchesDescription ?? true,
        note: input.note ?? '',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in analyze-quote-photo:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonError(message, 500)
  }
})
