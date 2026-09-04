// supabase/functions/chat-estimator-extract/index.ts
//
// Supabase Edge Function: LLM-backed understanding layer for the chat estimator.
//
// Receives the user's latest message plus enough conversation context, asks
// Claude to (a) classify the message's intent and (b) extract any NEW
// estimate facts as structured fields via a forced tool call. This function
// NEVER computes or returns a price — it only fills out the same
// EstimatorContext fields the client-side rules engine (extractors.ts) fills
// out today. The actual dollar amount is always computed client-side by the
// existing deterministic pricing engine (estimateEngine.ts), so a bad or
// hallucinated model response can only affect which questions get asked
// next, never the price itself.
//
// If this function is unreachable, times out, or returns malformed data, the
// client falls back to the local rules engine automatically — this is a
// pure enhancement layer, not a hard dependency.
//
// Environment variables required:
//   ANTHROPIC_API_KEY - a dedicated Anthropic API key for this site
//                        (create at console.anthropic.com; do not reuse a
//                        personal/dev key so spend and usage stay separate)
//
// Deploy:
//   supabase functions deploy chat-estimator-extract --no-verify-jwt
//
// Set secret:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const REQUEST_TIMEOUT_MS = 8000

// ---------------------------------------------------------------------------
// Tool schema — the structured shape Claude must fill out. Field names match
// EstimatorContext directly wherever possible; the "*Add" fields are for
// array properties that accumulate rather than replace (the client merges
// them by concatenation, not overwrite).
// ---------------------------------------------------------------------------
const ROOM_KEYS = [
  'master_bedroom', 'bedroom_2', 'bedroom_3', 'bedroom_4', 'living_room',
  'dining_room', 'kitchen', 'bathroom_master', 'bathroom_2', 'bathroom_3',
  'office', 'laundry', 'hallway', 'entryway', 'garage', 'bonus_room',
]

const INTENTS = [
  'greeting', 'ask_clarification', 'ask_example', 'express_uncertainty',
  'meta_cost', 'meta_how_it_works', 'meta_bot_check', 'meta_real_person',
  'meta_time', 'meta_privacy', 'off_topic', 'deflection', 'negation',
  'confirmation', 'scope_limiter', 'frustration', 'ready_to_finish',
  'restart', 'color_question', 'recommend_question', 'painter_question',
  'booking_question', 'provide_info',
]

const UPDATE_TOOL = {
  name: 'update_estimate',
  description: 'Record the intents behind the user\'s latest message and any new painting-job facts it contains.',
  input_schema: {
    type: 'object',
    properties: {
      intents: {
        type: 'array',
        items: { type: 'string', enum: INTENTS },
        description: 'One or more intents for the LATEST user message, most confident first. Always include at least one; default to "provide_info" if the message is just describing the job.',
      },
      acknowledgements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short human-readable phrases summarizing what you newly understood from this message, e.g. "2-bedroom", "vacant", "picket fence". Empty array if nothing new.',
      },
      zipCode: { type: 'string', description: '5-digit US ZIP code, if mentioned.' },
      squareFeet: { type: 'number', description: 'Total square footage of the property/unit, if explicitly stated.' },
      bedroomCount: { type: 'integer', description: 'Number of bedrooms, if mentioned.' },
      stories: { type: 'integer', enum: [1, 2, 3], description: 'Number of stories of the building, if mentioned.' },
      projectType: {
        type: 'string', enum: ['interior', 'exterior', 'both'],
        description: 'Infer confidently: a rental unit/apartment/condo/duplex/studio repaint is almost always interior; siding/deck/fence/garage-door/roofline mentions are exterior.',
      },
      projectCondition: { type: 'string', enum: ['repaint', 'new_construction', 'renovation'] },
      interiorScope: {
        type: 'string', enum: ['whole_house', 'specific_rooms'],
        description: '"whole_house" when the user describes the whole property/unit (by bedroom/bathroom count, "the whole place", "a rental unit", "a studio", or total sqft) rather than naming specific rooms. "specific_rooms" ONLY when they name particular rooms to paint, implying other rooms are excluded.',
      },
      selectedRooms: {
        type: 'array', items: { type: 'string', enum: ROOM_KEYS },
        description: 'Only set when interiorScope is "specific_rooms" — the specific named rooms.',
      },
      interiorWalls: { type: 'string', enum: ['yes', 'no'] },
      interiorCeilings: { type: 'string', enum: ['yes', 'no'] },
      interiorTrim: { type: 'string', enum: ['yes', 'no'] },
      interiorDoors: { type: 'string', enum: ['none', 'some', 'all'] },
      doorFrames: { type: 'string', enum: ['yes', 'no'] },
      cabinets: { type: 'string', enum: ['none', 'kitchen', 'bathroom', 'laundry', 'multiple'] },
      cabinetScope: { type: 'string', enum: ['fronts_only', 'inside_too'] },
      closets: { type: 'string', enum: ['none', 'standard', 'walkin', 'both'] },
      stairways: { type: 'string', enum: ['none', 'yes'] },
      stairwayDetails: { type: 'string', enum: ['walls_only', 'walls_and_railings', 'full'] },
      interiorShutters: { type: 'string', enum: ['yes', 'no'] },
      interiorColorChange: { type: 'string', enum: ['same', 'different', 'dramatic'] },
      ceilingType: { type: 'string', enum: ['flat', 'popcorn', 'vaulted'] },
      sidingType: { type: 'string', enum: ['stucco', 'wood', 'vinyl', 'hardie', 'brick', 'stone', 'aluminum', 'mixed'] },
      garageDoor: { type: 'string', enum: ['none', 'single', 'double'] },
      entryDoor: { type: 'string', enum: ['yes', 'no'] },
      deck: { type: 'string', enum: ['none', 'yes'] },
      deckSize: { type: 'string', enum: ['small', 'medium', 'large'] },
      fence: { type: 'string', enum: ['none', 'yes'] },
      fenceType: { type: 'string', enum: ['picket_4ft', 'privacy_6ft', 'chain_link'] },
      fenceLinearFeet: { type: 'number' },
      railings: { type: 'string', enum: ['none', 'yes'] },
      railingType: { type: 'string', enum: ['simple', 'spindles', 'both'] },
      balconies: { type: 'string', enum: ['none', 'yes'] },
      gutters: { type: 'string', enum: ['yes', 'no'] },
      foundation: { type: 'string', enum: ['yes', 'no'] },
      overhangs: { type: 'string', enum: ['yes', 'no'] },
      soffitsEaves: { type: 'string', enum: ['yes', 'no'] },
      exteriorShutters: { type: 'string', enum: ['yes', 'no'] },
      exteriorWindows: { type: 'string', enum: ['none', 'trim_only', 'full'] },
      windowTypesAdd: { type: 'array', items: { type: 'string', enum: ['french_pane', 'bay'] } },
      doorTypesAdd: { type: 'array', items: { type: 'string', enum: ['french'] } },
      specialtyServicesAdd: { type: 'array', items: { type: 'string', enum: ['fireplace', 'beams', 'built_ins', 'epoxy', 'furniture', 'brick'] } },
      occupancy: { type: 'string', enum: ['vacant', 'furnished', 'occupied'] },
      prepWorkAdd: { type: 'array', items: { type: 'string', enum: ['caulking', 'stain_cover', 'drywall_repair', 'wood_rot', 'wallpaper_removal', 'power_washing', 'lead_test'] } },
      drywallRepairExtent: { type: 'string', enum: ['minor', 'moderate', 'major'] },
    },
    required: ['intents', 'acknowledgements'],
  },
}

const SYSTEM_PROMPT = `You are the natural-language understanding layer for a house-painting estimate chatbot. You do NOT set any price — a separate deterministic pricing engine computes the dollar amount from the structured fields you extract. Your only job is to call the update_estimate tool with:
1. The intent(s) behind the user's LATEST message.
2. Any NEW facts about the painting job it contains.

Rules:
- Only include fields the LATEST message gives new information for. Do not repeat facts already known (see "Already known" below) unless the user is clearly correcting or changing a prior answer.
- Be decisive about implied scope: "2 bed 1 bath", "4 bed 3 bath", "a rental unit", "an apartment", "a studio", "the whole place" all describe the WHOLE property, not a single room — set interiorScope to "whole_house" and do NOT add a room to selectedRooms just because "bath" or "bed" appears in a count.
- Only populate selectedRooms when the user names specific rooms while implying others are excluded (e.g. "just the kitchen and master bedroom").
- A rental unit/apartment/condo/duplex/studio being repainted almost always means interior, even if not stated explicitly.
- If the user's message is a question to the bot, an expression of uncertainty, a complaint, a greeting, or otherwise not job details, still extract any incidental facts but make sure the intents array reflects it.
- Keep acknowledgements short (2-4 words each) and only for genuinely new information.`

interface ChatTurn { role: 'bot' | 'user'; text: string }

function buildUserPrompt(
  message: string,
  history: ChatTurn[],
  ctx: Record<string, unknown>,
  lastBotQuestion: string | null,
): string {
  const recentHistory = history.slice(-10)
    .map((h) => `${h.role === 'bot' ? 'Bot' : 'User'}: ${h.text}`)
    .join('\n')

  // Only surface the subset of context useful for "already known" — omit
  // tracking/contact fields that are irrelevant noise for extraction.
  const relevantCtx = Object.fromEntries(
    Object.entries(ctx).filter(([, v]) => v !== '' && v !== null && v !== 'none' && v !== 'no' &&
      !(Array.isArray(v) && v.length === 0)),
  )

  return [
    `Conversation so far:\n${recentHistory || '(none yet)'}`,
    lastBotQuestion ? `\nBot's last question: ${lastBotQuestion}` : '',
    `\nAlready known (JSON): ${JSON.stringify(relevantCtx)}`,
    `\nUser's new message: ${message}`,
  ].join('\n')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { message, history, ctx, lastBotQuestion } = await req.json() as {
      message: string
      history: ChatTurn[]
      ctx: Record<string, unknown>
      lastBotQuestion: string | null
    }

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
          max_tokens: 1024,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: buildUserPrompt(message, history ?? [], ctx ?? {}, lastBotQuestion ?? null) },
          ],
          tools: [UPDATE_TOOL],
          tool_choice: { type: 'tool', name: 'update_estimate' },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!anthropicRes.ok) {
      const details = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, details)
      return new Response(JSON.stringify({ error: 'Upstream LLM error', details }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await anthropicRes.json()
    const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use')
    if (!toolUse) {
      return new Response(JSON.stringify({ error: 'No tool call in LLM response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ result: toolUse.input }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('chat-estimator-extract error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
