// supabase/functions/review-conversation/index.ts
//
// Supabase Edge Function: a last look at a customer's whole conversation before a price goes out.
//
// A price leads to a deposit and to painters being contacted, so it should only come from a conversation about a real painting
// job. The browser already checks word lists (profanity, "I don't need anything painted") and that something is actually being
// priced; this adds the AI's reading of the whole thing, to catch conversations that make no sense or have nothing to do with
// painting. If this can't be reached the browser's own checks still apply.
//
// POST { messages: string[] }  // the customer's replies, in order
//   -> { ok: true } | { ok: false, reason: 'abusive' | 'dismissive' | 'nonsense' | 'no_project' }
//
// Deploy:
//   supabase functions deploy review-conversation --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = 'claude-haiku-4-5-20251001'
const RATE_LIMIT_WINDOW_SECONDS = 600
const RATE_LIMIT_MAX_REQUESTS = 20

const SYSTEM_PROMPT = `You review a customer's replies in a chat that prices a house-painting job. The assistant has asked things like what needs painting, the size, the condition, the ZIP code and the timing. You only see the customer's replies, in order.

Decide whether this is a genuine conversation about a real painting job that is worth sending to painters.

Mark it NOT ok if any of these is true:
- "abusive": cursing, insults, sexual or hateful remarks, or harassing the assistant.
- "dismissive": the customer says they don't need anything painted, need nothing, the place doesn't exist, or they are just testing or messing around.
- "nonsense": most replies are unrelated to painting, random, contradictory in a way that makes no sense, or keyboard mashing.
- "no_project": the replies never describe anything that could be painted (no rooms, surfaces, building or items).

A normal customer can be terse, vague, unsure, mildly frustrated ("ugh, fine") or make typos, and that is OK. Only reject when it is clear this is not a real request. When in doubt, mark it ok.

Always answer by calling the verdict tool.`

const VERDICT_TOOL = {
  name: 'verdict',
  description: 'Whether this conversation is a genuine painting request.',
  input_schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      reason: { type: 'string', enum: ['abusive', 'dismissive', 'nonsense', 'no_project', 'none'] },
    },
    required: ['ok', 'reason'],
  },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'Not configured' }, 500)

    // Same anti-abuse limit idea as the chat extractor, in its own bucket.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceRoleKey) {
      const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const admin = createClient(supabaseUrl, serviceRoleKey)
      const { data: allowed, error } = await admin.rpc('check_chat_rate_limit', {
        p_client_key: `review:${ip}`,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      })
      if (!error && allowed === false) return json({ error: 'Rate limit exceeded' }, 429)
    }

    const { messages } = await req.json() as { messages?: unknown }
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'Missing messages' }, 400)
    const replies = messages.filter((m): m is string => typeof m === 'string').slice(-40).map((m) => m.slice(0, 400))
    if (replies.length === 0) return json({ error: 'Missing messages' }, 400)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 200,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Customer replies, in order:\n${replies.map((m, i) => `${i + 1}. ${m}`).join('\n')}` }],
          tools: [VERDICT_TOOL],
          tool_choice: { type: 'tool', name: 'verdict' },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      console.error('Anthropic error:', res.status, await res.text())
      return json({ error: 'Upstream error' }, 502)
    }
    const data = await res.json()
    const tool = data.content?.find((b: { type: string }) => b.type === 'tool_use')
    const verdict = tool?.input as { ok?: boolean; reason?: string } | undefined
    if (!verdict || typeof verdict.ok !== 'boolean') return json({ error: 'No verdict' }, 502)
    return json(verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason && verdict.reason !== 'none' ? verdict.reason : 'nonsense' })
  } catch (error) {
    console.error('review-conversation failed:', error)
    return json({ error: 'Review failed' }, 500)
  }
})
