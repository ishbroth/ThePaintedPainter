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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Anti-abuse: cap requests per client (by IP) so this can't be used to burn
// through Anthropic API credits by spamming the endpoint directly. Backed by
// the check_chat_rate_limit() Postgres function (see migrations), which is a
// single atomic UPSERT so concurrent requests can't race past the limit.
const RATE_LIMIT_WINDOW_SECONDS = 600 // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 40 // generous for a real conversation (~10-20 messages), blocks spamming

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
        description: 'One or more intents for the LATEST user message, most confident first. Always include at least one; default to "provide_info" if the message is just describing the job. "restart" covers any request to clear/reset/wipe everything and start over ("clear this", "start fresh", "reset", "forget what I said"), not just the literal word "restart".',
      },
      acknowledgements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short factual phrases (2-4 words) about the PAINTING JOB ONLY, e.g. "2-bedroom", "vacant", "picket fence". NEVER describe the user\'s tone, the conversation, or your own reasoning (e.g. never write things like "user frustrated" or "confirmed prior details") — those are not job facts. Empty array if the message contains no new job detail, which is normal and expected for questions, complaints, or filler like "ok" or "not sure".',
      },
      zipCode: { type: 'string', description: '5-digit US ZIP code, if mentioned.' },
      squareFeet: { type: 'number', description: 'Total square footage of the property/unit, if explicitly stated.' },
      bedroomCount: { type: 'integer', description: 'Number of bedrooms, if mentioned.' },
      stories: { type: 'integer', enum: [1, 2, 3], description: 'Number of stories of the building, if mentioned.' },
      propertyType: {
        type: 'string', enum: ['residential', 'rental', 'multi_unit', 'commercial'],
        description: 'Who occupies it and why that changes pricing: "residential" = owner lives there (default assumption, standard finish quality). "rental" = a landlord\'s rental/investment unit — these get a price DISCOUNT because rentals don\'t need showroom-perfect finish. "multi_unit" = an apartment building/complex with multiple units — gets a volume DISCOUNT. "commercial" = office/retail/warehouse — costs MORE due to insurance/scheduling overhead. Only set when the message actually implies ownership/use, not just building type.',
      },
      timeline: {
        type: 'string', enum: ['asap', 'this_month', 'no_rush'],
        description: '"asap" = rush job, needed urgently — this adds a rush-scheduling premium since it usually means pulling a crew off another job. "no_rush" = flexible, no discount but no premium either. "this_month" = normal near-term timing.',
      },
      yearBuilt: {
        type: 'integer',
        description: 'The year the home was built, if mentioned or clearly implied (e.g. "built in the 60s", "historic home" implies pre-1978). Homes built before 1978 legally require EPA lead-safe work practices, which adds meaningfully to prep cost — flag this whenever the message gives any hint of an older home\'s age, even approximately.',
      },
      accessRestrictions: {
        type: 'string', enum: ['some', 'significant'],
        description: 'Physical difficulty getting equipment/ladders to the work area: "some" = tight side yard, narrow driveway, gated community. "significant" = no ladder/truck access, steep roof, no elevator to a high floor. This adds real labor time, so it raises the price.',
      },
      hoa: {
        type: 'string', enum: ['yes', 'no'],
        description: 'Set to "yes" if an HOA/homeowners association is mentioned — HOAs often require board approval for exterior color changes (informational, not a price change).',
      },
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
      ceilingHeight: {
        type: 'string', enum: ['nine_foot', 'ten_plus', 'vaulted_mixed'],
        description: 'A real multiplier on wall/ceiling square footage — independent of ceilingType (which is about texture, not height). Set from "9 foot ceilings", "10+ foot/high ceilings", or "vaulted/cathedral ceilings".',
      },
      wallTexture: {
        type: 'string', enum: ['smooth', 'textured', 'heavy_texture'],
        description: 'Wall surface texture — "textured" (orange peel, light knockdown) costs a bit more than smooth, "heavy_texture" (heavy knockdown) more still.',
      },
      trimCondition: {
        type: 'string', enum: ['new', 'existing_fair'],
        description: '"new" = trim was just installed (needs full caulk/prime prep). "existing_fair" = trim is chipped/damaged/rough shape (needs sanding/degloss prep). Leave unset for normal existing trim in decent shape.',
      },
      crownMolding: { type: 'string', enum: ['yes'], description: 'Set when crown molding is mentioned as needing paint.' },
      wainscoting: { type: 'string', enum: ['yes'], description: 'Set when wainscoting, beadboard, or wall paneling is mentioned.' },
      accentWalls: { type: 'string', enum: ['yes'], description: 'Set when an accent/feature wall (different color on one wall) is mentioned.' },
      hasStainedWood: {
        type: 'string', enum: ['yes'],
        description: 'Set when existing stained (not painted) wood trim/doors/cabinets need to be painted over — this needs a bonding primer, real extra prep cost.',
      },
      closetShelving: {
        type: 'string', enum: ['wire', 'built_in'],
        description: 'Only relevant when closets are being painted — wire shelving or built-in shelving needing masking/care.',
      },
      woodRotExtent: {
        type: 'string', enum: ['moderate', 'major'],
        description: 'Set the EXTENT of wood rot when the user gives any indication of how bad it is (e.g. "some wood rot" = moderate, "extensive/severe rot" = major). Leave unset for a bare mention with no extent given.',
      },
      sidingType: { type: 'string', enum: ['stucco', 'wood', 'vinyl', 'hardie', 'brick', 'stone', 'aluminum', 'mixed'] },
      garageDoor: { type: 'string', enum: ['none', 'single', 'double'] },
      entryDoor: { type: 'string', enum: ['yes', 'no'] },
      deck: { type: 'string', enum: ['none', 'yes'] },
      deckSize: { type: 'string', enum: ['small', 'medium', 'large'] },
      fence: { type: 'string', enum: ['none', 'yes'] },
      fenceType: { type: 'string', enum: ['picket_4ft', 'privacy_6ft', 'chain_link'] },
      fenceLinearFeet: { type: 'number' },
      railings: {
        type: 'string', enum: ['none', 'yes'],
        description: 'EXTERIOR railings only — deck, porch, or balcony. Do NOT set this for interior staircase railings/bannisters; use stairwayDetails="walls_and_railings" for those instead.',
      },
      railingType: { type: 'string', enum: ['simple', 'spindles', 'both'], description: 'Only relevant when railings is set (exterior deck/porch/balcony railings).' },
      balconies: { type: 'string', enum: ['none', 'yes'] },
      gutters: { type: 'string', enum: ['yes', 'no'] },
      foundation: { type: 'string', enum: ['yes', 'no'] },
      overhangs: { type: 'string', enum: ['yes', 'no'] },
      soffitsEaves: { type: 'string', enum: ['yes', 'no'] },
      exteriorShutters: { type: 'string', enum: ['yes', 'no'] },
      exteriorWindows: { type: 'string', enum: ['none', 'trim_only', 'full'] },
      exteriorColorChange: {
        type: 'string', enum: ['same', 'different'],
        description: 'Whether the EXTERIOR is going back the same color or a different one (separate from interiorColorChange). A different color adds an extra coat.',
      },
      exteriorCondition: {
        type: 'string', enum: ['fair', 'poor'],
        description: '"poor" = exterior paint is peeling/failing/in bad shape. "fair" = some fading or minor wear. Leave unset for a normal repaint with no condition complaints.',
      },
      stuccoCondition: {
        type: 'string', enum: ['new_stucco', 'needs_repair'],
        description: '"new_stucco" needs a primer/sealer coat before paint. "needs_repair" (cracked/damaged stucco) needs patching first. Only relevant when sidingType is stucco.',
      },
      exteriorTrim: { type: 'string', enum: ['yes'], description: 'Set when exterior trim/fascia boards are mentioned as needing paint.' },
      exteriorRailingMaterial: {
        type: 'string', enum: ['metal', 'composite', 'cable'],
        description: 'Material of exterior deck/porch/balcony railings, if mentioned — metal costs more (rust treatment), composite/cable cost less than wood (default).',
      },
      fireplaceType: {
        type: 'string', enum: ['brick_paint', 'brick_whitewash', 'stone', 'mantel_only'],
        description: 'Only relevant when a fireplace is mentioned — what kind of fireplace work.',
      },
      beamLocation: { type: 'string', enum: ['vaulted'], description: 'Only relevant when exposed beams are mentioned — set if they\'re in a vaulted/cathedral ceiling area (more labor to reach).' },
      windowTypesAdd: { type: 'array', items: { type: 'string', enum: ['french_pane', 'bay'] } },
      doorTypesAdd: { type: 'array', items: { type: 'string', enum: ['french'] } },
      specialtyServicesAdd: {
        type: 'array', items: { type: 'string', enum: ['fireplace', 'beams', 'built_ins', 'epoxy', 'furniture', 'brick'] },
        description: 'Specialty items that each have their own dedicated pricing — a fireplace/mantel, exposed wood beams, built-in bookshelves/cabinetry, a garage floor epoxy coating, or a specific furniture piece to paint. Easy to miss since they\'re rarely the main topic of a message — watch for them mentioned in passing.',
      },
      occupancy: { type: 'string', enum: ['vacant', 'furnished', 'occupied'] },
      prepWorkAdd: { type: 'array', items: { type: 'string', enum: ['caulking', 'stain_cover', 'drywall_repair', 'wood_rot', 'wallpaper_removal', 'power_washing', 'lead_test', 'mold_treatment'] } },
      drywallRepairExtent: { type: 'string', enum: ['minor', 'moderate', 'major'] },
      multiTripRequired: {
        type: 'string', enum: ['yes'],
        description: 'Set to "yes" when the job needs a SECOND visit due to sequencing or cure time — e.g. "paint the trim before it\'s installed, touch up after", "window glazing needs to set before painting", "prime now, final coat after the other trades finish", "spray the cabinet doors off-site then reinstall". This is a real scheduling/travel cost, not optional.',
      },
      specialEquipment: {
        type: 'string', enum: ['extended_ladder', 'scaffolding', 'lift'],
        description: 'Set when the user mentions needing a boom/scissor lift, scaffolding/swing stage, or an unusually tall extension ladder / fall protection for a high peak or wall. This is real rental equipment cost.',
      },
      fixtureRemoval: {
        type: 'string', enum: ['minor', 'extensive'],
        description: 'Set when hardware/fixtures need removing and reinstalling around the paint work — towel bars, curtain rods, switch plates, outlet/vent covers, mirrors, light fixtures, thermostats, smoke detectors, blinds. "extensive" if it sounds like many items across the whole house/job, "minor" for just one or two items.',
      },
      hardwareReplacement: {
        type: 'string', enum: ['yes'],
        description: 'Set to "yes" when the user wants NEW hardware INSTALLED (not just removed/reinstalled) — e.g. "replace the cabinet hinges", "swap out the knobs", "install new switch plates". This is handyman-adjacent labor separate from the paint job; the hardware itself is a separate material cost.',
      },
      lowVocRequested: {
        type: 'string', enum: ['yes'],
        description: 'Set to "yes" for an explicit low-odor/eco-friendly/non-toxic paint request, OR when someone mentions allergies/asthma/pregnancy/fume sensitivity in the context of the paint job. This is a real premium-material upcharge.',
      },
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
- If the bot's last question directly asked "interior, exterior, or both?" and the user answers with just one of those words (or an unambiguous synonym), set projectType to EXACTLY that word. Do not upgrade a plain "exterior" (or "interior") answer to "both" based on other fields appearing in "Already known" — those are separate facts already gathered, not a signal that the OTHER side of the job is also in scope.
- Only populate selectedRooms when the user names specific rooms while implying others are excluded (e.g. "just the kitchen and master bedroom").
- A rental unit/apartment/condo/duplex/studio being repainted almost always means interior, even if not stated explicitly. If it's phrased as a landlord's unit between tenants, ALSO set propertyType="rental".
- "Staircase railings" or "bannisters" are an INTERIOR detail (stairwayDetails="walls_and_railings") — never also set the top-level railings field for those, since that field means exterior deck/porch/balcony railings only.
- If the user's message is a question to the bot, an expression of uncertainty, a complaint, a greeting, or otherwise not job details, still extract any incidental facts but make sure the intents array reflects it.
- Keep acknowledgements short (2-4 words each) and only for genuinely new information.

Painting-industry pricing knowledge — apply these whenever the message implies them, even if the user doesn't use these exact terms:
- Rentals/investment properties don't need a flawless finish the way an owner-occupied home does — cheaper standard-grade paint, single coat where the color matches, less meticulous cutting-in. This is a real, expected price DECREASE, not a compromise to apologize for.
- A multi-unit building or property-management job (several units at once) gets a volume discount, same logic as any bulk contract work.
- A rush/urgent timeline costs more — fitting a job in fast usually means displacing another customer or paying crew overtime.
- Homes built before 1978 legally require EPA lead-safe work practices (containment, HEPA cleanup, certified disposal) whenever interior surfaces are disturbed — this is federal law, not optional, and adds real cost. Infer an approximate era from any hint ("older home", "built in the 60s", "historic") even without an exact year.
- Difficult physical access (steep roofs, no ladder/truck clearance, gated communities, walk-up units with no elevator) adds real labor time and cost — this is independent of whether the surface itself is easy to paint.
- An HOA/homeowners association usually means exterior color changes need board approval — worth flagging, though it doesn't change the price itself.
- None of this is optional flavor text — a customer describing any of these scenarios should have the relevant field set so the pricing engine can account for it.`

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

    // Rate limit by client IP before spending anything on an LLM call.
    const clientKey = req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'unknown'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey)
      // Never let a DB hiccup hang the whole request — race against a short
      // timeout and fail OPEN (same policy as an actual RPC error) if it's slow.
      const rlResult = await Promise.race([
        admin.rpc('check_chat_rate_limit', {
          p_client_key: clientKey,
          p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
          p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('rate limit check timed out') }), 3000)),
      ])
      const { data: allowed, error: rlError } = rlResult
      if (rlError) {
        // Fail OPEN — a rate-limit infra hiccup shouldn't take down the whole feature.
        console.error('Rate limit check failed:', rlError)
      } else if (allowed === false) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again shortly' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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
