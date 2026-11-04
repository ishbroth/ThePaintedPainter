const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}

patch('supabase/functions/get-my-projects/index.ts', [
  ["      address: [r.customer_street_address,", "      // for \"Work with again\" on a finished job: which painter, and the ZIP of that job\n      painterId: r.status === 'completed' ? r.accepted_by : null,\n      zip: r.quote_zip,\n      address: [r.customer_street_address,"],
]);

patch('supabase/functions/_shared/painterRanking.ts', [
  ["  /** Set when the painter is booked until later than today (only shown for flexible customers / dates that fit). */\n  availableFrom: string | null\n}",
   "  /** Set when the painter is booked until later than today (only shown for flexible customers / dates that fit). */\n  availableFrom: string | null\n  /** The customer chose \"Work with again\" for this painter: shown first, priced like any other painter. */\n  workedWithBefore?: boolean\n}\n\n/** What happened to the painter the customer asked to work with again. */\nexport interface PreferredOutcome {\n  id: string\n  companyName: string\n  status: 'listed' | 'unavailable'\n  /** When unavailable: a short reason shown to the customer, e.g. \"is booked through your dates\". */\n  reason?: string\n}"],
  ["  duration: { days: number; low: number; high: number }\n}\n\nfunction jobSpecialties",
   "  duration: { days: number; low: number; high: number }\n  preferred?: PreferredOutcome\n}\n\nfunction jobSpecialties"],
  ["  opts: { exclude?: string[]; holdUntilMs?: number; limit?: number } = {},", "  opts: { exclude?: string[]; holdUntilMs?: number; limit?: number; preferredId?: string } = {},"],
  ["  const excluded = new Set(opts.exclude ?? [])\n  const timing = timingFromCtx(ctx)\n  const today = todayIso()\n",
   `  const excluded = new Set(opts.exclude ?? [])
  const timing = timingFromCtx(ctx)
  const today = todayIso()

  // The painter the customer wants to work with again: find out up front whether they can be listed, and why not if not.
  let preferred: PreferredOutcome | undefined
  if (opts.preferredId) {
    const row = (rows ?? []).find((p: { id: string }) => p.id === opts.preferredId) as Record<string, unknown> | undefined
    if (!row) {
      const { data: gone } = await supabase.from('painters').select('company_name').eq('id', opts.preferredId).maybeSingle()
      preferred = { id: opts.preferredId, companyName: gone?.company_name ?? 'Your painter', status: 'unavailable', reason: "isn't taking new jobs right now" }
    } else {
      const d = zipDistanceMiles(zip, row.zip_code as string)
      const name = row.company_name as string
      if (excluded.has(opts.preferredId)) preferred = { id: opts.preferredId, companyName: name, status: 'unavailable', reason: "can't take this job" }
      else if (d === null || d > SERVICE_RADIUS_MILES) preferred = { id: opts.preferredId, companyName: name, status: 'unavailable', reason: "doesn't cover the area for this job" }
      else if (!evaluateAvailability(row as never, timing, duration.days, today).show) preferred = { id: opts.preferredId, companyName: name, status: 'unavailable', reason: 'is booked through your dates' }
      else preferred = { id: opts.preferredId, companyName: name, status: 'listed' }
    }
  }
`],
  ["  if (nearby.length === 0) return { painters: [], mystery, holdUntil, duration }", "  if (nearby.length === 0) return { painters: [], mystery, holdUntil, duration, preferred }"],
  ["  return { painters: opts.limit ? ranked.slice(0, opts.limit) : ranked, mystery, holdUntil, duration }",
   `  // "Work with again": that painter goes first, with their own price; everyone else follows in the usual order.
  if (preferred?.status === 'listed') {
    const at = ranked.findIndex((r) => r.id === preferred!.id)
    if (at > 0) ranked.unshift(...ranked.splice(at, 1))
    if (ranked[0]?.id === preferred.id) {
      ranked[0].workedWithBefore = true
      ranked[0].reasons = ["you've worked together before", ...ranked[0].reasons]
    }
  }

  return { painters: opts.limit ? ranked.slice(0, opts.limit) : ranked, mystery, holdUntil, duration, preferred }`],
]);

patch('supabase/functions/painter-results/index.ts', [
  ["    const result = await rankPainters(supabase, supabaseUrl, ctx, baseTotal, { exclude, holdUntilMs })\n    return json({\n      painters: result.painters,\n      mystery: result.mystery,\n      holdUntil: result.holdUntil,\n      duration: result.duration,\n    })",
   `    // "Work with again": only honored when the signed-in caller really finished a job with that painter.
    let preferredId: string | undefined
    const wantedId = typeof ctx.preferredPainterId === 'string' ? ctx.preferredPainterId : ''
    const authHeader = req.headers.get('Authorization')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (wantedId && authHeader && anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: userData } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))
      const user = userData?.user
      if (user) {
        const orFilter = user.email ? \`customer_id.eq.\${user.id},customer_email.eq.\${user.email}\` : \`customer_id.eq.\${user.id}\`
        const { data: past } = await supabase
          .from('quote_selections')
          .select('id')
          .eq('accepted_by', wantedId)
          .eq('status', 'completed')
          .or(orFilter)
          .limit(1)
        if (past && past.length > 0) preferredId = wantedId
      }
    }

    const result = await rankPainters(supabase, supabaseUrl, ctx, baseTotal, { exclude, holdUntilMs, preferredId })
    return json({
      painters: result.painters,
      mystery: result.mystery,
      holdUntil: result.holdUntil,
      duration: result.duration,
      preferred: result.preferred,
    })`],
  ["// POST { ctx: <estimator context incl. timing>, baseTotal: number, resumeToken?: string }", "// POST { ctx: <estimator context incl. timing, and preferredPainterId for \"Work with again\">, baseTotal: number, resumeToken?: string }"],
]);

patch('src/lib/realPainterMatcher.ts', [
  ["  reasons: string[];\n}\n\nexport interface PainterReview", "  reasons: string[];\n  /** The customer picked \"Work with again\" for this painter: listed first. */\n  workedWithBefore?: boolean;\n}\n\n/** What became of the painter the customer asked to work with again. */\nexport interface PreferredPainterOutcome {\n  id: string;\n  companyName: string;\n  status: 'listed' | 'unavailable';\n  /** When unavailable, e.g. \"is booked through your dates\". */\n  reason?: string;\n}\n\nexport interface PainterReview"],
  ["  duration: { days: number; low: number; high: number };\n}\n\n/**", "  duration: { days: number; low: number; high: number };\n  preferred?: PreferredPainterOutcome;\n}\n\n/**"],
]);
console.log('ok');
